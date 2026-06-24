/**
 * GET    /api/enrollments/:id  — get enrollment by ID (tenant-scoped, Req 7.4)
 * PATCH  /api/enrollments/:id  — update enrollment status (tenant-scoped, Req 7.4)
 * DELETE /api/enrollments/:id  — remove enrollment (tenant-scoped, Req 7.4)
 *
 * Requirements: 7.4
 */
import { NextRequest } from 'next/server';
import { requireTenantContext } from '@/middleware/tenantContext';
import { successResponse, notFoundResponse, noContentResponse, forbiddenResponse, errorResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { activityLogService } from '@/services/activityLogService';
import { handleOptionsRequest } from '@/middleware/cors';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { z } from 'zod';

const updateEnrollmentStatusSchema = z.object({
  status: z.enum(['enrolled', 'active', 'completed', 'dropped', 'failed']),
  completion_date: z.string().optional().nullable(),
  final_grade: z.number().min(0).max(100).optional().nullable(),
});

// OPTIONS /api/enrollments/:id - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/enrollments/:id - Get enrollment by ID (tenant-scoped, Req 7.4)
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const ctxResult = requireTenantContext(request);
    if (ctxResult.error) return ctxResult.error;
    const { tenantId, isSuperAdmin } = ctxResult.context;

    const { id } = await params;

    let query = supabaseAdmin
      .from('enrollments')
      .select(`
        *,
        trainee:trainees(id, first_name, last_name, middle_name, email, qr_code, photo_path),
        program:programs(id, name, description, start_date, end_date, status)
      `)
      .eq('id', id);

    if (!isSuperAdmin) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    if (!data) {
      return notFoundResponse('Enrollment not found');
    }

    return successResponse(data);
  }
);

// PATCH /api/enrollments/:id - Update enrollment status (tenant-scoped, Req 7.4)
export const PATCH = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const ctxResult = requireTenantContext(request);
    if (ctxResult.error) return ctxResult.error;
    const { tenantId, userId, role, isSuperAdmin } = ctxResult.context;

    const allowedRoles = ['local_admin', 'staff_training_coordinator'];
    if (!allowedRoles.includes(role)) {
      return forbiddenResponse('Insufficient permissions to update enrollments');
    }

    const { id } = await params;

    // Verify enrollment belongs to this tenant before updating
    let checkQuery = supabaseAdmin
      .from('enrollments')
      .select('id, tenant_id, status')
      .eq('id', id);

    if (!isSuperAdmin) {
      checkQuery = checkQuery.eq('tenant_id', tenantId);
    }

    const { data: existing, error: checkError } = await checkQuery.maybeSingle();
    if (checkError) throw checkError;
    if (!existing) {
      return notFoundResponse('Enrollment not found');
    }

    const body = await request.json();
    const validatedData = updateEnrollmentStatusSchema.parse(body);

    const updatePayload: Record<string, unknown> = {
      status: validatedData.status,
      updated_at: new Date().toISOString(),
    };

    if (validatedData.completion_date !== undefined) {
      updatePayload.completion_date = validatedData.completion_date;
    }
    if (validatedData.final_grade !== undefined) {
      updatePayload.final_grade = validatedData.final_grade;
    }

    const { data: enrollment, error: updateError } = await supabaseAdmin
      .from('enrollments')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        trainee:trainees(id, first_name, last_name, middle_name, email),
        program:programs(id, name, start_date, end_date)
      `)
      .single();

    if (updateError) throw updateError;

    await activityLogService.logAction(userId, 'update', 'enrollment', id, {
      status: validatedData.status,
      tenantId,
    });

    return successResponse(enrollment, 'Enrollment updated successfully');
  }
);

// DELETE /api/enrollments/:id - Remove enrollment (tenant-scoped, Req 7.4)
export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const ctxResult = requireTenantContext(request);
    if (ctxResult.error) return ctxResult.error;
    const { tenantId, userId, role, isSuperAdmin } = ctxResult.context;

    const adminRoles = ['local_admin', 'super_admin'];
    if (!adminRoles.includes(role)) {
      return forbiddenResponse('Insufficient permissions to delete enrollments');
    }

    const { id } = await params;

    // Verify enrollment belongs to this tenant before deleting
    let checkQuery = supabaseAdmin
      .from('enrollments')
      .select('id, tenant_id')
      .eq('id', id);

    if (!isSuperAdmin) {
      checkQuery = checkQuery.eq('tenant_id', tenantId);
    }

    const { data: existing, error: checkError } = await checkQuery.maybeSingle();
    if (checkError) throw checkError;
    if (!existing) {
      return notFoundResponse('Enrollment not found');
    }

    const { error: deleteError } = await supabaseAdmin
      .from('enrollments')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    await activityLogService.logAction(userId, 'delete', 'enrollment', id);

    return noContentResponse();
  }
);
