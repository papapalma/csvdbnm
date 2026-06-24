/**
 * Notification Orchestration Service
 *
 * Implements Requirement 12.5:
 *   - 12.5  Notifications are sent only to trainees within the same tenant
 *           as the training program (no cross-tenant notifications)
 *
 * This service is the single entry point for all notification triggers.
 * It coordinates WhatsApp and email delivery, enforces tenant boundaries,
 * and respects trainee notification preferences (Req 12.11).
 *
 * Notification triggers:
 *   - Enrollment confirmation  (WhatsApp + email, Req 12.1)
 *   - Schedule change          (WhatsApp + email, Req 12.2)
 *   - Training reminder        (WhatsApp + email, Req 12.3, 24h before start)
 *   - Training completion      (WhatsApp + email, Req 12.4)
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/utils/logger';
import {
  sendEnrollmentConfirmation,
  sendScheduleChangeNotification,
  sendTrainingReminder,
  sendCompletionNotification,
} from './whatsappService';
import {
  sendEnrollmentConfirmationEmail,
  sendScheduleChangeEmail,
  sendTrainingReminderEmail,
  sendCompletionEmail,
} from './emailService';
import type { NotificationResult } from './whatsappService';
import type { EmailResult } from './emailService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationOutcome {
  whatsapp?: NotificationResult;
  email?: EmailResult;
  skippedWhatsApp?: string;
  skippedEmail?: string;
}

/**
 * Trainee notification preferences stored in the `notification_preferences`
 * JSONB column on the `trainees` table (Req 12.11).
 */
export interface TraineeNotificationPreferences {
  /** Opt out of all non-critical notifications */
  optOutAll?: boolean;
  /** Opt out of enrollment confirmations */
  optOutEnrollment?: boolean;
  /** Opt out of schedule change notifications */
  optOutScheduleChange?: boolean;
  /** Opt out of training reminders */
  optOutReminders?: boolean;
  /** Opt out of completion notifications */
  optOutCompletion?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a trainee's contact details and notification preferences.
 * Returns null if the trainee is not found or belongs to a different tenant.
 *
 * Enforces tenant boundary: trainee must belong to the same tenant as the
 * program (Req 12.5).
 */
async function getTraineeContactInfo(
  traineeId: string,
  tenantId: string
): Promise<{
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  notificationPreferences: TraineeNotificationPreferences;
} | null> {
  const { data, error } = await supabaseAdmin
    .from('trainees')
    .select('id, first_name, last_name, phone, email, tenant_id, notification_preferences')
    .eq('id', traineeId)
    .eq('tenant_id', tenantId) // Enforce tenant boundary (Req 12.5)
    .maybeSingle();

  if (error) {
    logger.error('[NOTIFICATION] Failed to fetch trainee contact info', { error, traineeId });
    return null;
  }

  if (!data) return null;

  return {
    phone: data.phone,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    tenantId: data.tenant_id,
    notificationPreferences: (data.notification_preferences as TraineeNotificationPreferences) ?? {},
  };
}

/**
 * Fetch the LGU name for a tenant (used in email templates).
 */
async function getTenantName(tenantId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle();
  return data?.name ?? 'Training Management System';
}

// ---------------------------------------------------------------------------
// Notification triggers
// ---------------------------------------------------------------------------

/**
 * Send enrollment confirmation to a trainee via WhatsApp and email (Req 12.1).
 *
 * Respects opt-out preferences (Req 12.11).
 * Enforces tenant boundary — trainee must belong to the same tenant as the
 * program (Req 12.5).
 */
export async function notifyEnrollmentConfirmation(params: {
  tenantId: string;
  traineeId: string;
  programName: string;
  startDate: string;
}): Promise<NotificationOutcome> {
  const trainee = await getTraineeContactInfo(params.traineeId, params.tenantId);
  if (!trainee) {
    logger.warn('[NOTIFICATION] Trainee not found or cross-tenant access blocked', {
      traineeId: params.traineeId,
      tenantId: params.tenantId,
    });
    return {
      skippedWhatsApp: 'Trainee not found in tenant',
      skippedEmail: 'Trainee not found in tenant',
    };
  }

  const prefs = trainee.notificationPreferences;
  const traineeName = `${trainee.firstName} ${trainee.lastName}`;
  const lguName = await getTenantName(params.tenantId);
  const outcome: NotificationOutcome = {};

  // WhatsApp
  if (prefs.optOutAll || prefs.optOutEnrollment) {
    outcome.skippedWhatsApp = 'Trainee opted out of enrollment notifications';
  } else if (trainee.phone) {
    outcome.whatsapp = await sendEnrollmentConfirmation({
      tenantId: params.tenantId,
      recipientPhone: trainee.phone,
      traineeName,
      programName: params.programName,
      startDate: params.startDate,
    });
  } else {
    outcome.skippedWhatsApp = 'No phone number on record';
  }

  // Email
  if (prefs.optOutAll || prefs.optOutEnrollment) {
    outcome.skippedEmail = 'Trainee opted out of enrollment notifications';
  } else if (trainee.email) {
    outcome.email = await sendEnrollmentConfirmationEmail({
      tenantId: params.tenantId,
      recipientEmail: trainee.email,
      traineeName,
      programName: params.programName,
      startDate: params.startDate,
      lguName,
    });
  } else {
    outcome.skippedEmail = 'No email address on record';
  }

  return outcome;
}

/**
 * Send training schedule change notification (Req 12.2).
 *
 * Sends to all active trainees enrolled in the program within the same tenant.
 * Respects opt-out preferences (Req 12.11).
 */
export async function notifyScheduleChange(params: {
  tenantId: string;
  programId: string;
  programName: string;
  changeDescription: string;
}): Promise<NotificationOutcome[]> {
  // Fetch all active enrollments for this program within the tenant (Req 12.5)
  const { data: enrollments, error } = await supabaseAdmin
    .from('enrollments')
    .select('trainee_id')
    .eq('program_id', params.programId)
    .eq('tenant_id', params.tenantId)
    .in('status', ['enrolled', 'active']);

  if (error) {
    logger.error('[NOTIFICATION] Failed to fetch enrollments for schedule change', { error });
    return [];
  }

  const lguName = await getTenantName(params.tenantId);
  const outcomes: NotificationOutcome[] = [];

  for (const enrollment of enrollments ?? []) {
    const trainee = await getTraineeContactInfo(enrollment.trainee_id, params.tenantId);
    if (!trainee) continue;

    const prefs = trainee.notificationPreferences;
    const traineeName = `${trainee.firstName} ${trainee.lastName}`;
    const outcome: NotificationOutcome = {};

    // WhatsApp
    if (prefs.optOutAll || prefs.optOutScheduleChange) {
      outcome.skippedWhatsApp = 'Trainee opted out';
    } else if (trainee.phone) {
      outcome.whatsapp = await sendScheduleChangeNotification({
        tenantId: params.tenantId,
        recipientPhone: trainee.phone,
        traineeName,
        programName: params.programName,
        changeDescription: params.changeDescription,
      });
    }

    // Email
    if (prefs.optOutAll || prefs.optOutScheduleChange) {
      outcome.skippedEmail = 'Trainee opted out';
    } else if (trainee.email) {
      outcome.email = await sendScheduleChangeEmail({
        tenantId: params.tenantId,
        recipientEmail: trainee.email,
        traineeName,
        programName: params.programName,
        changeDescription: params.changeDescription,
        lguName,
      });
    }

    outcomes.push(outcome);
  }

  return outcomes;
}

/**
 * Send 24-hour training reminder to a trainee (Req 12.3).
 *
 * Respects opt-out preferences (Req 12.11).
 */
export async function notifyTrainingReminder(params: {
  tenantId: string;
  traineeId: string;
  programName: string;
  sessionDate: string;
  sessionTime: string;
  location?: string;
}): Promise<NotificationOutcome> {
  const trainee = await getTraineeContactInfo(params.traineeId, params.tenantId);
  if (!trainee) {
    return {
      skippedWhatsApp: 'Trainee not found in tenant',
      skippedEmail: 'Trainee not found in tenant',
    };
  }

  const prefs = trainee.notificationPreferences;
  const traineeName = `${trainee.firstName} ${trainee.lastName}`;
  const lguName = await getTenantName(params.tenantId);
  const outcome: NotificationOutcome = {};

  // WhatsApp
  if (prefs.optOutAll || prefs.optOutReminders) {
    outcome.skippedWhatsApp = 'Trainee opted out of reminders';
  } else if (trainee.phone) {
    outcome.whatsapp = await sendTrainingReminder({
      tenantId: params.tenantId,
      recipientPhone: trainee.phone,
      traineeName,
      programName: params.programName,
      sessionDate: params.sessionDate,
      sessionTime: params.sessionTime,
      location: params.location,
    });
  }

  // Email
  if (prefs.optOutAll || prefs.optOutReminders) {
    outcome.skippedEmail = 'Trainee opted out of reminders';
  } else if (trainee.email) {
    outcome.email = await sendTrainingReminderEmail({
      tenantId: params.tenantId,
      recipientEmail: trainee.email,
      traineeName,
      programName: params.programName,
      sessionDate: params.sessionDate,
      sessionTime: params.sessionTime,
      location: params.location,
      lguName,
    });
  }

  return outcome;
}

/**
 * Send training completion notification with certificate access (Req 12.4).
 *
 * Respects opt-out preferences (Req 12.11).
 */
export async function notifyTrainingCompletion(params: {
  tenantId: string;
  traineeId: string;
  programName: string;
  certificateUrl: string;
}): Promise<NotificationOutcome> {
  const trainee = await getTraineeContactInfo(params.traineeId, params.tenantId);
  if (!trainee) {
    return {
      skippedWhatsApp: 'Trainee not found in tenant',
      skippedEmail: 'Trainee not found in tenant',
    };
  }

  const prefs = trainee.notificationPreferences;
  const traineeName = `${trainee.firstName} ${trainee.lastName}`;
  const lguName = await getTenantName(params.tenantId);
  const outcome: NotificationOutcome = {};

  // WhatsApp
  if (prefs.optOutAll || prefs.optOutCompletion) {
    outcome.skippedWhatsApp = 'Trainee opted out of completion notifications';
  } else if (trainee.phone) {
    outcome.whatsapp = await sendCompletionNotification({
      tenantId: params.tenantId,
      recipientPhone: trainee.phone,
      traineeName,
      programName: params.programName,
      certificateUrl: params.certificateUrl,
    });
  }

  // Email
  if (prefs.optOutAll || prefs.optOutCompletion) {
    outcome.skippedEmail = 'Trainee opted out of completion notifications';
  } else if (trainee.email) {
    outcome.email = await sendCompletionEmail({
      tenantId: params.tenantId,
      recipientEmail: trainee.email,
      traineeName,
      programName: params.programName,
      certificateUrl: params.certificateUrl,
      lguName,
    });
  }

  return outcome;
}
