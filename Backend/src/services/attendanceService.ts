/**
 * Attendance Service — tenant-scoped attendance tracking.
 *
 * All query methods accept an optional `tenantId` parameter. When provided,
 * queries are filtered to that tenant. Super Admin callers pass `undefined`
 * to bypass tenant filtering.
 *
 * QR code scanning validates that the scanned code belongs to the same
 * tenant as the scanner (Req 17.2, 17.3, 17.4).
 */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { nonAttendanceDateService } from './nonAttendanceDateService';

export interface Attendance {
  id: string;
  session_id: string;
  trainee_id: string;
  tenant_id?: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  check_in_time?: string;
  check_out_time?: string;
  scanned_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceWithDetails extends Attendance {
  trainee?: {
    id: string;
    first_name: string;
    last_name: string;
    middle_name: string;
    qr_code: string;
    photo_path?: string;
  };
  session?: {
    id: string;
    title: string;
    session_date: string;
    start_time: string;
    end_time: string;
    program_id: string;
  };
}

export interface MarkAttendanceData {
  session_id: string;
  trainee_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  scanned_by?: string;
  notes?: string;
  tenant_id?: string;
}

class AttendanceService {
  /**
   * Get attendance records for a session, scoped to the given tenant.
   * Req 7.5, 17.2
   */
  async getAttendanceBySession(sessionId: string, tenantId?: string) {
    let query = supabaseAdmin
      .from('attendance')
      .select(`
        *,
        trainee:trainees(id, first_name, last_name, middle_name, qr_code, photo_path)
      `)
      .eq('session_id', sessionId);

    // Tenant isolation — filter by tenant_id when provided
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    query = query.order('created_at', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Get attendance records for a trainee, scoped to the given tenant.
   * Req 7.5, 17.2
   */
  async getAttendanceByTrainee(traineeId: string, tenantId?: string) {
    let query = supabaseAdmin
      .from('attendance')
      .select(`
        *,
        session:program_sessions(id, title, session_date, start_time, end_time, program_id, program:programs(id, name))
      `)
      .eq('trainee_id', traineeId);

    // Tenant isolation
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Record or update an attendance entry.
   * Injects tenant_id when provided so the record is properly scoped.
   */
  async markAttendance(data: MarkAttendanceData) {
    const attendanceData: Record<string, unknown> = {
      session_id: data.session_id,
      trainee_id: data.trainee_id,
      status: data.status,
      notes: data.notes ?? null,
    };

    if (data.status === 'present' || data.status === 'late') {
      attendanceData.check_in_time = new Date().toISOString();
      attendanceData.check_out_time = null;
    } else {
      attendanceData.check_in_time = null;
      attendanceData.check_out_time = null;
    }

    if (data.scanned_by) {
      attendanceData.scanned_by = data.scanned_by;
    }

    // Inject tenant_id from the caller's context (Req 7.5)
    if (data.tenant_id) {
      attendanceData.tenant_id = data.tenant_id;
    }

    // Use upsert to handle duplicate entries
    const { data: result, error } = await supabaseAdmin
      .from('attendance')
      .upsert(attendanceData, {
        onConflict: 'session_id,trainee_id',
        ignoreDuplicates: false,
      })
      .select(`
        *,
        trainee:trainees(id, first_name, last_name, middle_name, qr_code, photo_path)
      `)
      .single();

    if (error) throw error;
    return result;
  }

  /**
   * Mark attendance by scanning a QR code.
   *
   * Validates that the QR code belongs to the same tenant as the scanner
   * (Req 17.2, 17.3). Rejects codes from other tenants with a clear error.
   *
   * @param sessionId  - The session being attended.
   * @param qrCode     - The scanned QR code value.
   * @param scannedBy  - User ID of the scanner.
   * @param tenantId   - Tenant of the scanner (used for cross-tenant validation).
   */
  async markAttendanceByQR(
    sessionId: string,
    qrCode: string,
    scannedBy: string,
    tenantId?: string
  ) {
    // Find the trainee by QR code
    let traineeQuery = supabaseAdmin
      .from('trainees')
      .select('id, first_name, last_name, program_id, tenant_id')
      .eq('qr_code', qrCode);

    const { data: trainee, error: traineeError } = await traineeQuery.maybeSingle();

    if (traineeError) throw traineeError;
    if (!trainee) {
      throw new Error('Trainee not found with this QR code');
    }

    // Validate tenant context — reject QR codes from other tenants (Req 17.3)
    if (tenantId && trainee.tenant_id && trainee.tenant_id !== tenantId) {
      throw new Error(
        'QR code belongs to a different tenant. Cross-tenant attendance scanning is not allowed.'
      );
    }

    // Check if session exists and get program info
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('program_sessions')
      .select('id, program_id, session_date, start_time')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      throw new Error('Session not found');
    }

    // Verify trainee is enrolled in this program
    if (trainee.program_id !== session.program_id) {
      throw new Error('Trainee is not enrolled in this program');
    }

    // Check if late (more than 15 minutes after start time) — Req 17.4
    const now = new Date();
    const sessionStart = new Date(`${session.session_date}T${session.start_time}`);
    const isLate = now > new Date(sessionStart.getTime() + 15 * 60 * 1000);

    // Mark attendance with tenant context
    return this.markAttendance({
      session_id: sessionId,
      trainee_id: trainee.id,
      status: isLate ? 'late' : 'present',
      scanned_by: scannedBy,
      notes: isLate ? 'Marked as late (arrived after 15 minutes)' : undefined,
      tenant_id: tenantId,
    });
  }

  async checkOut(sessionId: string, traineeId: string) {
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .update({ check_out_time: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('trainee_id', traineeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Bulk mark absent for all trainees in a session who have no attendance record.
   * Scoped to the given tenant.
   */
  async bulkMarkAbsent(sessionId: string, tenantId?: string) {
    // Get the session's program
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('program_sessions')
      .select('program_id')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Get all active trainees in the program (tenant-scoped)
    let traineesQuery = supabaseAdmin
      .from('trainees')
      .select('id')
      .eq('program_id', session.program_id)
      .eq('status', 'active');

    if (tenantId) {
      traineesQuery = traineesQuery.eq('tenant_id', tenantId);
    }

    const { data: trainees, error: traineesError } = await traineesQuery;
    if (traineesError) throw traineesError;

    // Get existing attendance records for this session
    const { data: existingAttendance, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .select('trainee_id')
      .eq('session_id', sessionId);

    if (attendanceError) throw attendanceError;

    const existingTraineeIds = new Set(existingAttendance?.map((a) => a.trainee_id) || []);

    // Create absent records for trainees without attendance
    const absentRecords = (trainees || [])
      .filter((t) => !existingTraineeIds.has(t.id))
      .map((t) => ({
        session_id: sessionId,
        trainee_id: t.id,
        status: 'absent' as const,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      }));

    if (absentRecords.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('attendance')
        .insert(absentRecords);

      if (insertError) throw insertError;
    }

    return { markedAbsent: absentRecords.length };
  }

  /**
   * Get attendance statistics for a program, scoped to the given tenant.
   */
  async getAttendanceStats(programId: string, tenantId?: string) {
    let query = supabaseAdmin
      .from('attendance')
      .select(`
        status,
        session:program_sessions!inner(program_id, session_date)
      `)
      .eq('session.program_id', programId);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get excluded dates for this program
    const excludedDates = await nonAttendanceDateService.getAllNonAttendanceDates({
      program_id: programId,
    });
    const excludedDateSet = new Set(excludedDates.map((d) => d.date));

    // Filter out attendance records on excluded dates
    const validAttendance = (data || []).filter((a) => {
      const sessionDate = (a.session as any).session_date;
      return !excludedDateSet.has(sessionDate);
    });

    return {
      total: validAttendance.length,
      present: validAttendance.filter((a) => a.status === 'present').length,
      absent: validAttendance.filter((a) => a.status === 'absent').length,
      late: validAttendance.filter((a) => a.status === 'late').length,
      excused: validAttendance.filter((a) => a.status === 'excused').length,
    };
  }

  /**
   * Get attendance statistics for a trainee, scoped to the given tenant.
   */
  async getTraineeAttendanceStats(
    traineeId: string,
    programId?: string,
    tenantId?: string
  ) {
    let query = supabaseAdmin
      .from('attendance')
      .select(`
        status,
        session:program_sessions!inner(session_date, program_id)
      `)
      .eq('trainee_id', traineeId);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get excluded dates (program-specific if programId provided)
    const excludedDates = await nonAttendanceDateService.getAllNonAttendanceDates(
      programId ? { program_id: programId } : undefined
    );
    const excludedDateSet = new Set(excludedDates.map((d) => d.date));

    // Filter out attendance records on excluded dates
    const validAttendance = (data || []).filter((a) => {
      const session = a.session as any;
      return !excludedDateSet.has(session.session_date);
    });

    const stats = {
      total: validAttendance.length,
      present: validAttendance.filter((a) => a.status === 'present').length,
      absent: validAttendance.filter((a) => a.status === 'absent').length,
      late: validAttendance.filter((a) => a.status === 'late').length,
      excused: validAttendance.filter((a) => a.status === 'excused').length,
      attendanceRate: 0,
    };

    if (stats.total > 0) {
      stats.attendanceRate = Math.round(
        ((stats.present + stats.late) / stats.total) * 100
      );
    }

    return stats;
  }
}

export const attendanceService = new AttendanceService();
