/**
 * Dynamic Email Notification Service
 *
 * Implements Requirements 12.7, 12.8:
 *   - 12.7  Local Admin configures Dynamic_Email_Configuration per tenant
 *           (sender address, SMTP host, port, authentication, templates)
 *   - 12.8  Staff Training Coordinator sends email using tenant-specific config
 *
 * Each tenant stores its own SMTP credentials in the tenant configuration
 * JSONB column. If a tenant has no email config, the service falls back to
 * platform-level environment variables so notifications still work during
 * initial setup.
 *
 * Template rendering uses simple {{variable}} substitution so no external
 * templating library is required.
 */

import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getTenantConfiguration } from './tenantConfigurationService';
import type { EmailConfig } from './tenantConfigurationService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailMessage {
  /** Tenant whose SMTP credentials to use */
  tenantId: string;
  /** Recipient email address */
  recipientEmail: string;
  /** Email subject line */
  subject: string;
  /** Template name (used for logging; actual body is rendered from templateBody) */
  templateName: string;
  /** HTML body with {{variable}} placeholders */
  templateBody: string;
  /** Variable substitution map: { variable: value } */
  templateVariables?: Record<string, string>;
  /** Optional plain-text fallback */
  textBody?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryStatus: 'sent' | 'failed' | 'queued';
  attempts: number;
  usedFallbackConfig: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum send attempts before giving up */
const MAX_RETRIES = 3;

/** Base backoff delay in milliseconds */
const BASE_BACKOFF_MS = 1000;

// ---------------------------------------------------------------------------
// Built-in email templates
// ---------------------------------------------------------------------------

/**
 * Pre-built HTML templates for common notification types.
 * Each template uses {{variable}} placeholders.
 */
export const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  enrollment_confirmation: {
    subject: 'Enrollment Confirmed — {{programName}}',
    body: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#2563eb;">Enrollment Confirmed</h2>
  <p>Dear <strong>{{traineeName}}</strong>,</p>
  <p>You have been successfully enrolled in <strong>{{programName}}</strong>.</p>
  <p><strong>Start Date:</strong> {{startDate}}</p>
  <p>Please arrive on time and bring a valid ID. We look forward to seeing you!</p>
  <hr/>
  <p style="font-size:12px;color:#6b7280;">{{lguName}} — Training Management System</p>
</div>`,
  },

  schedule_change: {
    subject: 'Schedule Update — {{programName}}',
    body: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#d97706;">Training Schedule Update</h2>
  <p>Dear <strong>{{traineeName}}</strong>,</p>
  <p>There has been a change to the schedule for <strong>{{programName}}</strong>:</p>
  <blockquote style="border-left:4px solid #d97706;padding-left:12px;color:#374151;">
    {{changeDescription}}
  </blockquote>
  <p>Please check the training portal for the latest schedule details.</p>
  <hr/>
  <p style="font-size:12px;color:#6b7280;">{{lguName}} — Training Management System</p>
</div>`,
  },

  training_reminder: {
    subject: 'Reminder: {{programName}} starts tomorrow',
    body: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#059669;">Training Reminder</h2>
  <p>Dear <strong>{{traineeName}}</strong>,</p>
  <p>This is a reminder that <strong>{{programName}}</strong> is scheduled for tomorrow.</p>
  <ul>
    <li><strong>Date:</strong> {{sessionDate}}</li>
    <li><strong>Time:</strong> {{sessionTime}}</li>
    <li><strong>Location:</strong> {{location}}</li>
  </ul>
  <p>Please be on time. See you there!</p>
  <hr/>
  <p style="font-size:12px;color:#6b7280;">{{lguName}} — Training Management System</p>
</div>`,
  },

  training_completion: {
    subject: 'Congratulations! You completed {{programName}}',
    body: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#7c3aed;">Congratulations, {{traineeName}}!</h2>
  <p>You have successfully completed <strong>{{programName}}</strong>.</p>
  <p>Your certificate is now available for download:</p>
  <p style="text-align:center;">
    <a href="{{certificateUrl}}"
       style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
      Download Certificate
    </a>
  </p>
  <p>Thank you for your dedication and hard work!</p>
  <hr/>
  <p style="font-size:12px;color:#6b7280;">{{lguName}} — Training Management System</p>
</div>`,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compute exponential backoff delay for a given attempt number (0-indexed).
 */
function backoffDelay(attempt: number): number {
  return BASE_BACKOFF_MS * Math.pow(2, attempt);
}

/**
 * Render a template string by substituting {{variable}} placeholders.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

/**
 * Build a Nodemailer transporter from an EmailConfig.
 */
function createTransporter(config: EmailConfig): Transporter {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465, // true for port 465, false for 587
    requireTLS: config.useTls && config.smtpPort !== 465,
    auth: {
      user: config.smtpUsername,
      pass: config.smtpPassword,
    },
  });
}

/**
 * Build a Nodemailer transporter from platform-level environment variables.
 * Used as fallback when a tenant has no email config (Req 12.7).
 */
function createFallbackTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
  });
}

/**
 * Derive the sender address from config or environment fallback.
 */
function getSenderAddress(config: EmailConfig | null): string {
  if (config?.senderName && config?.senderEmail) {
    return `"${config.senderName}" <${config.senderEmail}>`;
  }
  const fallbackName = process.env.SMTP_SENDER_NAME ?? 'Training Management System';
  const fallbackEmail = process.env.SMTP_SENDER_EMAIL ?? 'noreply@example.com';
  return `"${fallbackName}" <${fallbackEmail}>`;
}

/**
 * Persist a notification attempt record to the audit_logs table (Req 12.9).
 */
async function logEmailAttempt(params: {
  tenantId: string;
  recipientEmail: string;
  templateName: string;
  deliveryStatus: 'sent' | 'failed' | 'queued';
  messageId?: string;
  error?: string;
  attempts: number;
  usedFallbackConfig: boolean;
}): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: params.tenantId,
      action: 'email_notification',
      entity_type: 'notification',
      entity_id: null,
      details: {
        channel: 'email',
        recipient_email: params.recipientEmail,
        template_name: params.templateName,
        delivery_status: params.deliveryStatus,
        message_id: params.messageId ?? null,
        error: params.error ?? null,
        attempts: params.attempts,
        used_fallback_config: params.usedFallbackConfig,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (logError) {
    logger.warn('[EMAIL] Failed to write notification audit log', { logError });
  }
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

/**
 * Send an email notification using the tenant's configured SMTP settings.
 *
 * Falls back to platform-level SMTP config if the tenant has none (Req 12.7).
 * Implements retry logic with exponential backoff.
 * Logs all attempts to audit_logs (Req 12.9).
 *
 * @returns EmailResult describing the outcome.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const {
    tenantId,
    recipientEmail,
    subject,
    templateName,
    templateBody,
    templateVariables = {},
    textBody,
  } = message;

  // ── 1. Retrieve tenant email configuration ───────────────────────────────
  let emailConfig: EmailConfig | null = null;
  let usedFallbackConfig = false;

  try {
    const tenantConfig = await getTenantConfiguration(tenantId);
    emailConfig = tenantConfig?.notifications?.email ?? null;
  } catch (configError) {
    logger.warn('[EMAIL] Failed to retrieve tenant email config, will use fallback', {
      tenantId,
      configError,
    });
  }

  // ── 2. Build transporter ─────────────────────────────────────────────────
  let transporter: Transporter | null = null;

  if (emailConfig?.smtpHost && emailConfig?.smtpUsername && emailConfig?.smtpPassword) {
    transporter = createTransporter(emailConfig);
  } else {
    // Fall back to platform defaults (Req 12.7)
    transporter = createFallbackTransporter();
    usedFallbackConfig = true;

    if (!transporter) {
      const result: EmailResult = {
        success: false,
        error: 'No email configuration available (tenant config missing and no platform fallback)',
        deliveryStatus: 'failed',
        attempts: 0,
        usedFallbackConfig: true,
      };

      await logEmailAttempt({ tenantId, recipientEmail, templateName, ...result });
      return result;
    }
  }

  // ── 3. Render template ───────────────────────────────────────────────────
  const renderedSubject = renderTemplate(subject, templateVariables);
  const renderedHtml = renderTemplate(templateBody, templateVariables);
  const renderedText = textBody ? renderTemplate(textBody, templateVariables) : undefined;
  const from = getSenderAddress(usedFallbackConfig ? null : emailConfig);

  // ── 4. Send with retry logic ─────────────────────────────────────────────
  let lastError: string | undefined;
  let messageId: string | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = backoffDelay(attempt - 1);
      logger.info(`[EMAIL] Retrying send (attempt ${attempt + 1}/${MAX_RETRIES}) after ${delay}ms`, {
        tenantId,
        recipientEmail,
        templateName,
      });
      await sleep(delay);
    }

    try {
      const info = await transporter.sendMail({
        from,
        to: recipientEmail,
        subject: renderedSubject,
        html: renderedHtml,
        ...(renderedText ? { text: renderedText } : {}),
      });

      messageId = info.messageId;

      const result: EmailResult = {
        success: true,
        messageId,
        deliveryStatus: 'sent',
        attempts: attempt + 1,
        usedFallbackConfig,
      };

      await logEmailAttempt({ tenantId, recipientEmail, templateName, ...result });

      logger.info('[EMAIL] Message sent successfully', {
        tenantId,
        recipientEmail,
        templateName,
        messageId,
        attempts: attempt + 1,
        usedFallbackConfig,
      });

      return result;
    } catch (sendError: any) {
      lastError = sendError?.message ?? 'Unknown send error';
      logger.warn(`[EMAIL] Send attempt ${attempt + 1} failed`, {
        tenantId,
        recipientEmail,
        templateName,
        error: lastError,
      });
    }
  }

  // ── 5. All attempts exhausted ────────────────────────────────────────────
  const failedResult: EmailResult = {
    success: false,
    error: lastError ?? 'All retry attempts failed',
    deliveryStatus: 'failed',
    attempts: MAX_RETRIES,
    usedFallbackConfig,
  };

  await logEmailAttempt({ tenantId, recipientEmail, templateName, ...failedResult });

  logger.error('[EMAIL] All send attempts failed', {
    tenantId,
    recipientEmail,
    templateName,
    error: lastError,
  });

  return failedResult;
}

// ---------------------------------------------------------------------------
// Convenience wrappers for specific notification types
// ---------------------------------------------------------------------------

/**
 * Send enrollment confirmation email (Req 12.1).
 */
export async function sendEnrollmentConfirmationEmail(params: {
  tenantId: string;
  recipientEmail: string;
  traineeName: string;
  programName: string;
  startDate: string;
  lguName?: string;
}): Promise<EmailResult> {
  const tpl = EMAIL_TEMPLATES.enrollment_confirmation;
  return sendEmail({
    tenantId: params.tenantId,
    recipientEmail: params.recipientEmail,
    subject: tpl.subject,
    templateName: 'enrollment_confirmation',
    templateBody: tpl.body,
    templateVariables: {
      traineeName: params.traineeName,
      programName: params.programName,
      startDate: params.startDate,
      lguName: params.lguName ?? 'Training Management System',
    },
  });
}

/**
 * Send schedule change email (Req 12.2).
 */
export async function sendScheduleChangeEmail(params: {
  tenantId: string;
  recipientEmail: string;
  traineeName: string;
  programName: string;
  changeDescription: string;
  lguName?: string;
}): Promise<EmailResult> {
  const tpl = EMAIL_TEMPLATES.schedule_change;
  return sendEmail({
    tenantId: params.tenantId,
    recipientEmail: params.recipientEmail,
    subject: tpl.subject,
    templateName: 'schedule_change',
    templateBody: tpl.body,
    templateVariables: {
      traineeName: params.traineeName,
      programName: params.programName,
      changeDescription: params.changeDescription,
      lguName: params.lguName ?? 'Training Management System',
    },
  });
}

/**
 * Send 24-hour training reminder email (Req 12.3).
 */
export async function sendTrainingReminderEmail(params: {
  tenantId: string;
  recipientEmail: string;
  traineeName: string;
  programName: string;
  sessionDate: string;
  sessionTime: string;
  location?: string;
  lguName?: string;
}): Promise<EmailResult> {
  const tpl = EMAIL_TEMPLATES.training_reminder;
  return sendEmail({
    tenantId: params.tenantId,
    recipientEmail: params.recipientEmail,
    subject: tpl.subject,
    templateName: 'training_reminder',
    templateBody: tpl.body,
    templateVariables: {
      traineeName: params.traineeName,
      programName: params.programName,
      sessionDate: params.sessionDate,
      sessionTime: params.sessionTime,
      location: params.location ?? 'TBA',
      lguName: params.lguName ?? 'Training Management System',
    },
  });
}

/**
 * Send training completion email with certificate link (Req 12.4).
 */
export async function sendCompletionEmail(params: {
  tenantId: string;
  recipientEmail: string;
  traineeName: string;
  programName: string;
  certificateUrl: string;
  lguName?: string;
}): Promise<EmailResult> {
  const tpl = EMAIL_TEMPLATES.training_completion;
  return sendEmail({
    tenantId: params.tenantId,
    recipientEmail: params.recipientEmail,
    subject: tpl.subject,
    templateName: 'training_completion',
    templateBody: tpl.body,
    templateVariables: {
      traineeName: params.traineeName,
      programName: params.programName,
      certificateUrl: params.certificateUrl,
      lguName: params.lguName ?? 'Training Management System',
    },
  });
}
