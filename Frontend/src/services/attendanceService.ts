import { api, ApiResponse } from './api';

export interface Attendance {
  id: string;
  session_id: string;
  trainee_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  check_in_time?: string;
  check_out_time?: string;
  scanned_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
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
    program?: {
      id: string;
      name: string;
    };
  };
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate?: number;
}

export interface MarkAttendanceData {
  session_id: string;
  trainee_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

export interface ScanAttendanceData {
  session_id: string;
  qr_code: string;
}

class AttendanceService {
  async getAttendanceBySession(sessionId: string): Promise<ApiResponse<Attendance[]>> {
    return api.get<Attendance[]>('/attendance', { session_id: sessionId });
  }

  async getAttendanceByTrainee(traineeId: string): Promise<ApiResponse<Attendance[]>> {
    return api.get<Attendance[]>('/attendance', { trainee_id: traineeId });
  }

  async getAttendanceStats(programId: string): Promise<ApiResponse<AttendanceStats>> {
    return api.get<AttendanceStats>('/attendance', { program_id: programId, stats: 'true' });
  }

  async getTraineeAttendanceStats(traineeId: string): Promise<ApiResponse<AttendanceStats>> {
    return api.get<AttendanceStats>('/attendance', { trainee_id: traineeId, stats: 'true' });
  }

  async markAttendance(data: MarkAttendanceData): Promise<ApiResponse<Attendance>> {
    return api.post<Attendance>('/attendance', data);
  }

  async scanAttendance(data: ScanAttendanceData): Promise<ApiResponse<Attendance>> {
    return api.post<Attendance>('/attendance?action=scan', data);
  }

  async bulkMarkAbsent(sessionId: string): Promise<ApiResponse<{ markedAbsent: number }>> {
    return api.post<{ markedAbsent: number }>('/attendance?action=bulk_absent', { session_id: sessionId });
  }

  /**
   * Get current trainee's own attendance records (trainee role)
   */
  async getMyAttendance(): Promise<ApiResponse<Attendance[]>> {
    return api.get<Attendance[]>('/attendance/me');
  }

  /**
   * Get current trainee's own attendance statistics (trainee role)
   */
  async getMyAttendanceStats(): Promise<ApiResponse<AttendanceStats>> {
    return api.get<AttendanceStats>('/attendance/me', { type: 'stats' });
  }
}

export const attendanceService = new AttendanceService();
export default attendanceService;
