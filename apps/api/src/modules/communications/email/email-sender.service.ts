// ---------------------------------------------------------------------------
// Email Sender Service — Nodemailer wrapper for sending emails
// E9-3 Task 2.1
// ---------------------------------------------------------------------------

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { AppError } from '../../../core/errors/index.js';
import type { EmailConfig } from './email-config.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailSender {
  sendEmail(options: EmailSendOptions): Promise<void>;
  verifyConnection(): Promise<boolean>;
  close(): void;
}

type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Creates an email sender backed by a Nodemailer SMTP transport.
 *
 * Factory pattern (not a singleton) so it can be instantiated with different
 * configs in tests.
 */
export function createEmailSender(config: EmailConfig, logger: Logger): EmailSender {
  const transport: Transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 30_000, // 30s — fail fast if SMTP server unreachable
    greetingTimeout: 15_000, // 15s — fail fast if SMTP server unresponsive after connect
    socketTimeout: 60_000, // 60s — fail fast if SMTP stalls mid-transfer
  });

  const from = `${config.fromName} <${config.fromEmail}>`;

  return {
    async sendEmail(options: EmailSendOptions): Promise<void> {
      try {
        await transport.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo,
        });
        logger.debug({ to: options.to, subject: options.subject }, 'email-sender: email sent');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
          { to: options.to, subject: options.subject, error: message },
          'email-sender: send failed',
        );
        throw new AppError('EMAIL_SEND_FAILED', `Failed to send email: ${message}`, 502);
      }
    },

    async verifyConnection(): Promise<boolean> {
      try {
        await transport.verify();
        logger.info('email-sender: SMTP connection verified');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(
          { error: message },
          'email-sender: SMTP connection verification failed — emails may not be delivered',
        );
        return false;
      }
    },

    close(): void {
      transport.close();
      logger.debug('email-sender: transport closed');
    },
  };
}
