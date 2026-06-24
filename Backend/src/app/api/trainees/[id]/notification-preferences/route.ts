/**
 * GET   /api/trainees/:id/notification-preferences  — get preferences (Req 12.11)
 * PATCH /api/trainees/:id/notification-preferences  — update preferences (Req 12.11)
 *
 * Implements Requirement 12.11:
 *   Trainees can opt out of non-critical notifications. Preferences are stored
 *   in the notification_preferences JSONB column on the trainees table.
 *
 * Access rules:
 *   - A trainee can only manage their own preferences
 *   - Staff and admins can manage preferences for trainees in their tenant
 */
import { NextRequest } from 'next/server';
import { requireTenantContext } from '@/middleware/tenantContext';
import { successResponse, notFoundResponse, forbiddenResponse } from '@/utils/responses';
import { withErrorHandler } from '@/middleware/errorHandler';
import { handleOptionsRequest } from '@/middleware/cors';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { activityLogService } from '@/services/activityLogService';
import { z } from 'zod';

// Validation schema for notification preferences (Req 12.11)
const notificationPreferencesSchema = z.object({
  /** Opt out of ALL non-critical notifications */
  optOutAll: z.boolean().optional(),
  /** Opt out of enrollment confirmation notifications */
  optOutEnrollment: z.boolean().optional(),
  /** Opt out of schedule change notifications */
  optOutScheduleChange: z.boolean().optional(),
  /** Opt out of 24-hour training reminders */
  optOutReminders: z.boolean().optional(),
  /** Opt out of training completion notifications */
  optOutCompletion: z.boolean().optional(),
});

// OPTIONS /api/trainees/:id/notification-preferences
export async function OPTIONS(request: NextRequest) {
  return handleOptionsRequest(request);
}

// GET /api/trainees/:id/notification-preferences — retrieve current preferences (Req 12.11)
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const ctxResult = requireTenantContext(request);
    if (ctxResult.error) return ctxResult.error;
    const { tenantId, userId, role, isSuperAdmin } = ctxResult.context;

    const { id } = await params;

    // Trainees can only read their own preferences; staff/admin can read any
    const isTraineeRole = role === 'trainee';
    if (isTraineeRole) {
      // Verify the trainee's user account maps to this trainee record
      const { data: account } = await supabaseAdmin
        .from('trainee_accounts')
        .select('trainee_id')
        .eq('user_id', userId)
        .eq('trainee_id', id)
        .maybeSingle();

      if (!account) {
        return forbiddenResponse('You can only view your own notification preferences');
      }
    }

    let query = supabaseAdmin
      .from('trainees')
      .select('id, notification_preferences')
      .eq('id', id);

    if (!isSuperAdmin) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return notFoundResponse('Trainee not found');

    return successResponse({
      traineeId: data.id,
      preferences: data.notification_preferences ?? {},
    });
  }
);

// PATCH /api/trainees/:id/notification-preferences — update preferences (Req 12.11)
export const PATCH = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const ctxResult = requireTenantContext(request);
    if (ctxResult.error) return ctxResult.error;
    const { tenantId, userId, role, isSuperAdmin } = ctxResult.context;

    const { id } = await params;

    // Trainees can only update their own preferences; staff/admin can update any
    const isTraineeRole = role === 'trainee';
    if (isTraineeRole) {
      const { data: account } = await supabaseAdmin
        .from('trainee_accounts')
        .select('trainee_id')
        .eq('user_id', userId)
        .eq('trainee_id', id)
        .maybeSingle();

      if (!account) {
        return forbiddenResponse('You can only update your own notification preferences');
      }
    }

    // Verify trainee exists and belongs to this tenant
    let checkQuery = supabaseAdmin
      .from('trainees')
      .select('id, notification_preferences')
      .eq('id', id);

    if (!isSuperAdmin) {
      checkQuery = checkQuery.eq('tenant_id', tenantId);
    }

    const { data: existing, error: checkError } = await checkQuery.maybeSingle();
    if (checkError) throw checkError;
    if (!existing) return notFoundResponse('Trainee not found');

    const body = await request.json();
    const validatedPrefs = notificationPreferencesSchema.parse(body);

    // Merge with existing preferences (partial update)
    const mergedPreferences = {
      ...(existing.notification_preferences ?? {}),
      ...validatedPrefs,
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('trainees')
      .update({ notification_preferences: mergedPreferences })
      .eq('id', id)
      .select('id, notification_preferences')
      .single();

    if (updateError) throw updateError;

    await activityLogService.logAction(
      userId,
      'update_notification_preferences',
      'trainee',
      id,
      { preferences: validatedPrefs }
    );

    return successResponse(
      {
        traineeId: updated.id,
        preferences: updated.notification_preferences,
      },
      'Notification preferences updated successfully'
    );
  }
);
