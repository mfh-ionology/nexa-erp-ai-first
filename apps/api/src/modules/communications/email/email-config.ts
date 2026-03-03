import { AppError } from '../../../core/errors/index.js';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

/**
 * Returns true only if SMTP_HOST is set and non-empty.
 */
export function isEmailConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

/**
 * Reads SMTP configuration from environment variables.
 * Throws AppError if SMTP_HOST is not set.
 */
export function getEmailConfig(): EmailConfig {
  const host = process.env.SMTP_HOST;
  if (!host) {
    throw new AppError(
      'EMAIL_CONFIG_MISSING',
      'SMTP_HOST environment variable is required for email configuration',
      500,
    );
  }

  return {
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.SMTP_FROM_NAME || 'Nexa ERP',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@nexa-erp.com',
  };
}
