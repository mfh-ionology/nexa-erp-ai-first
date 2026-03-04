// ---------------------------------------------------------------------------
// Email Send Worker — BullMQ worker for async SMTP email delivery
// E10-1 Task 5
// ---------------------------------------------------------------------------

import { Worker, type ConnectionOptions, type Job } from 'bullmq';
import nodemailer from 'nodemailer';
import type { PrismaClient } from '@nexa/db';
import {
  EmailMessageStatus,
  EmailQueueStatus,
  NotificationChannel,
  NotificationPriority,
} from '@nexa/db';

import type { EmailSendJobData } from './email-send.queue.js';
import { EMAIL_SEND_QUEUE_NAME } from './email-send.queue.js';
import type { EmailConfig } from './email-config.js';
import { getEmailConfig, isEmailConfigured } from './email-config.js';
import type { EmailSender } from './email-sender.service.js';
import { generatePresignedGetUrl } from '../../../core/storage/index.js';
import type { EventBus } from '../../../core/events/event-bus.js';
import { enqueueNotificationDelivery } from '../notifications/notification-dispatch.queue.js';

type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

// ---------------------------------------------------------------------------
// Per-company SMTP config resolution — Task 5.4
// ---------------------------------------------------------------------------

const SMTP_SETTING_KEYS = [
  'smtp.host',
  'smtp.port',
  'smtp.secure',
  'smtp.user',
  'smtp.pass',
  'smtp.fromName',
  'smtp.fromEmail',
] as const;

/**
 * Resolve SMTP configuration for a specific company.
 *
 * 1. Query SystemSettings for per-company smtp.* keys
 * 2. If smtp.host exists at minimum, build per-company config
 * 3. Otherwise, fall back to global env-based config via getEmailConfig()
 *
 * Returns null if neither per-company nor global SMTP is configured.
 */
export async function resolveSmtpConfig(
  prisma: PrismaClient,
  companyId: string,
): Promise<EmailConfig | null> {
  // Query all smtp.* settings for this company in one query
  const settings = await prisma.systemSetting.findMany({
    where: {
      companyId,
      key: { in: [...SMTP_SETTING_KEYS] },
    },
    select: { key: true, value: true },
  });

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  // Per-company config requires smtp.host AND smtp.fromEmail at minimum.
  // Without fromEmail, the SMTP host alone produces invalid sender addresses
  // (e.g. noreply@smtp.gmail.com) that will be rejected by SMTP servers.
  const host = settingsMap.get('smtp.host');
  const fromEmail = settingsMap.get('smtp.fromEmail');
  if (host && fromEmail) {
    return {
      host,
      port: parseInt(settingsMap.get('smtp.port') ?? '587', 10),
      secure: settingsMap.get('smtp.secure') === 'true',
      user: settingsMap.get('smtp.user') ?? '',
      pass: settingsMap.get('smtp.pass') ?? '',
      fromName: settingsMap.get('smtp.fromName') ?? 'Nexa ERP',
      fromEmail,
    };
  }

  // Fall back to global env-based config
  if (isEmailConfigured()) {
    return getEmailConfig();
  }

  return null;
}

// ---------------------------------------------------------------------------
// Worker factory — Task 5.1
// ---------------------------------------------------------------------------

/**
 * Create and return a BullMQ Worker that processes email sending jobs.
 *
 * Each job loads the email queue entry, resolves SMTP config (per-company or
 * global), sends via Nodemailer, and updates delivery status. On failure,
 * BullMQ handles retry with exponential backoff [30s, 120s, 300s].
 *
 * @param prisma      Prisma client for DB access
 * @param logger      Structured logger
 * @param connection  BullMQ Redis connection options
 * @param emitter     EventBus instance for emitting email.sent events (DI, not singleton)
 * @param globalEmailSender  Optional pre-configured EmailSender from E9 (used as fallback)
 */
/** Worker + cleanup handle returned by createEmailSendWorker */
export interface EmailSendWorkerHandle {
  worker: Worker<EmailSendJobData>;
  /** Close all cached SMTP transports. Call during graceful shutdown after worker.close(). */
  closeTransports: () => void;
}

export function createEmailSendWorker(
  prisma: PrismaClient,
  logger: Logger,
  connection: ConnectionOptions,
  emitter: EventBus,
  _globalEmailSender?: EmailSender | null,
): EmailSendWorkerHandle {
  // Per-company transport cache to avoid re-creating TCP connections per email.
  // Keyed by companyId, entries expire after TRANSPORT_TTL_MS.
  const TRANSPORT_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const transportCache = new Map<
    string,
    { transport: nodemailer.Transporter; configHash: string; createdAt: number }
  >();

  function getOrCreateTransport(companyId: string, config: EmailConfig): nodemailer.Transporter {
    const configHash = `${config.host}:${config.port}:${config.user}`;
    const cached = transportCache.get(companyId);
    const now = Date.now();

    if (cached && cached.configHash === configHash && now - cached.createdAt < TRANSPORT_TTL_MS) {
      return cached.transport;
    }

    // Close stale transport before replacing
    if (cached) {
      cached.transport.close();
    }

    const hasAuth = config.user && config.pass;
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(hasAuth ? { auth: { user: config.user, pass: config.pass } } : {}),
      connectionTimeout: 30_000,
      greetingTimeout: 15_000,
      socketTimeout: 60_000,
    });

    transportCache.set(companyId, { transport, configHash, createdAt: now });
    return transport;
  }

  const worker = new Worker<EmailSendJobData>(
    EMAIL_SEND_QUEUE_NAME,
    async (job: Job<EmailSendJobData>) => {
      const { emailQueueId } = job.data;

      // -- Task 5.2: Worker processor --

      // 1. Load the EmailQueue entry
      const queueEntry = await prisma.emailQueue.findUnique({
        where: { id: emailQueueId },
        include: {
          emailMessage: {
            include: {
              recipients: true,
            },
          },
        },
      });

      if (!queueEntry) {
        logger.warn({ emailQueueId }, 'email-send: queue entry not found — skipping');
        return;
      }

      // 2. Verify queue entry is PENDING or RETRYING
      if (
        queueEntry.status !== EmailQueueStatus.PENDING &&
        queueEntry.status !== EmailQueueStatus.RETRYING
      ) {
        logger.debug(
          { emailQueueId, currentStatus: queueEntry.status },
          'email-send: queue entry not PENDING/RETRYING — skipping',
        );
        return;
      }

      const emailMessage = queueEntry.emailMessage;
      const { companyId } = emailMessage;

      // 3. Set status to PROCESSING atomically (prevent race with concurrent workers)
      const processingUpdate = await prisma.emailQueue.updateMany({
        where: {
          id: emailQueueId,
          status: { in: [EmailQueueStatus.PENDING, EmailQueueStatus.RETRYING] },
        },
        data: {
          status: EmailQueueStatus.PROCESSING,
          processedAt: new Date(),
        },
      });

      if (processingUpdate.count === 0) {
        logger.debug(
          { emailQueueId },
          'email-send: queue entry already claimed by another worker — skipping',
        );
        return;
      }

      // 4. Resolve SMTP configuration (per-company, then global fallback)
      const smtpConfig = await resolveSmtpConfig(prisma, companyId);

      if (!smtpConfig) {
        // No SMTP configured at all (neither per-company nor global env) — mark as FAILED
        logger.warn(
          { emailQueueId, companyId },
          'email-send: no SMTP config found (per-company or global) — marking FAILED',
        );
        await markFailed(prisma, emailQueueId, emailMessage.id, 'No SMTP configuration available');
        return;
      }

      // 5. Resolve recipients by type
      const toAddresses = emailMessage.recipients
        .filter((r) => r.recipientType === 'TO')
        .map((r) => r.emailAddress);
      const ccAddresses = emailMessage.recipients
        .filter((r) => r.recipientType === 'CC')
        .map((r) => r.emailAddress);
      const bccAddresses = emailMessage.recipients
        .filter((r) => r.recipientType === 'BCC')
        .map((r) => r.emailAddress);
      const fromRecipient = emailMessage.recipients.find((r) => r.recipientType === 'FROM');

      // 6. Validate at least one TO recipient exists (SMTP requires non-empty TO header)
      if (toAddresses.length === 0) {
        logger.warn(
          { emailQueueId, emailMessageId: emailMessage.id },
          'email-send: no TO recipients — marking FAILED',
        );
        await markFailed(
          prisma,
          emailQueueId,
          emailMessage.id,
          'No TO recipients on email message',
        );
        return;
      }

      // 7. Load attachments linked to the EmailMessage (via Attachment table)
      const attachments = await prisma.attachment.findMany({
        where: { entityType: 'EmailMessage', entityId: emailMessage.id },
        select: {
          fileName: true,
          mimeType: true,
          storageKey: true,
          storageBucket: true,
        },
      });

      // Build Nodemailer attachment array with presigned URLs
      const mailAttachments = await Promise.all(
        attachments.map(async (att) => {
          const { url } = await generatePresignedGetUrl(
            att.storageBucket,
            att.storageKey,
            3600, // 1 hour expiry
          );
          return {
            filename: att.fileName,
            path: url,
            contentType: att.mimeType,
          };
        }),
      );

      // 8. Resolve from address
      const fromName = smtpConfig.fromName;
      const fromEmail = fromRecipient?.emailAddress ?? smtpConfig.fromEmail;
      const from = `${fromName} <${fromEmail}>`;

      // 9. Send the email via cached Nodemailer transport (reuses TCP connections per company)
      try {
        const transport = getOrCreateTransport(companyId, smtpConfig);

        const result = await transport.sendMail({
          from,
          to: toAddresses.join(', '),
          cc: ccAddresses.length > 0 ? ccAddresses.join(', ') : undefined,
          bcc: bccAddresses.length > 0 ? bccAddresses.join(', ') : undefined,
          subject: emailMessage.subject,
          html: emailMessage.bodyHtml ?? undefined,
          text: emailMessage.bodyText ?? undefined,
          attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
        });

        const smtpResponse =
          result.response ?? `Message accepted: ${result.messageId ?? 'unknown'}`;

        // 10. Success: update EmailMessage + EmailQueue statuses
        const now = new Date();

        await prisma.$transaction(async (tx) => {
          await (tx as unknown as PrismaClient).emailMessage.update({
            where: { id: emailMessage.id },
            data: {
              status: EmailMessageStatus.SENT,
              sentAt: now,
            },
          });

          await (tx as unknown as PrismaClient).emailQueue.update({
            where: { id: emailQueueId },
            data: {
              status: EmailQueueStatus.SENT,
              deliveredAt: now,
              smtpResponse: smtpResponse.slice(0, 500),
            },
          });
        });

        // 11. Emit email.sent event per event catalog §14
        const primaryRecipient = toAddresses[0] ?? fromEmail;
        emitter.emit('email.sent', {
          emailMessageId: emailMessage.id,
          recipientEmail: primaryRecipient,
          subject: emailMessage.subject,
          documentType: emailMessage.sourceEntityType ?? undefined,
        });

        logger.info(
          {
            emailQueueId,
            emailMessageId: emailMessage.id,
            to: toAddresses,
            smtpResponse: smtpResponse.slice(0, 100),
          },
          'email-send: email sent successfully',
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        logger.warn(
          {
            emailQueueId,
            emailMessageId: emailMessage.id,
            error: message,
            attempt: job.attemptsMade,
          },
          'email-send: SMTP send failed — will retry',
        );

        // Update queue entry with attempt info before throwing for BullMQ retry
        const delays = [30_000, 120_000, 300_000];
        const nextDelay =
          delays[Math.min(job.attemptsMade, delays.length - 1)] ?? delays[delays.length - 1]!;
        const nextRetryAt = new Date(Date.now() + nextDelay);

        await prisma.emailQueue.update({
          where: { id: emailQueueId },
          data: {
            status: EmailQueueStatus.RETRYING,
            attempts: job.attemptsMade + 1,
            lastError: message.slice(0, 5000),
            nextRetryAt,
          },
        });

        // Re-throw to trigger BullMQ retry
        throw err;
      }
    },
    {
      connection,
      concurrency: 5,
      settings: {
        // Task 5.3: Custom backoff strategy matching spec [30s, 120s, 300s]
        backoffStrategy: (attemptsMade: number): number => {
          const delays = [30_000, 120_000, 300_000];
          return (
            delays[Math.min(attemptsMade - 1, delays.length - 1)] ?? delays[delays.length - 1]!
          );
        },
      },
    },
  );

  // -- Task 5.3: Event listeners for retry/failure handling --

  worker.on('completed', (job) => {
    logger.debug(
      { jobId: job?.id, emailQueueId: job?.data.emailQueueId },
      'email-send: job completed',
    );
  });

  worker.on('failed', async (job, err) => {
    if (!job) {
      logger.error({ error: err.message }, 'email-send: job failed with no job reference');
      return;
    }

    const { emailQueueId } = job.data;

    // If all retries exhausted, mark as permanently FAILED
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      try {
        // Load the queue entry to get emailMessageId and createdBy
        const queueEntry = await prisma.emailQueue.findUnique({
          where: { id: emailQueueId },
          select: {
            emailMessageId: true,
            emailMessage: {
              select: { id: true, createdBy: true, companyId: true, subject: true },
            },
          },
        });

        if (queueEntry) {
          await markFailed(prisma, emailQueueId, queueEntry.emailMessageId, err.message);

          // Create a notification for the email creator and dispatch via E9 pipeline
          try {
            const notification = await prisma.notification.create({
              data: {
                userId: queueEntry.emailMessage.createdBy,
                title: 'Email delivery failed',
                body: `Failed to send email "${queueEntry.emailMessage.subject}" after 3 attempts. Error: ${err.message.slice(0, 200)}`,
                priority: NotificationPriority.HIGH,
                channel: NotificationChannel.IN_APP,
                entityType: 'EmailMessage',
                entityId: queueEntry.emailMessageId,
                actionUrl: `/email/messages/${queueEntry.emailMessageId}`,
              },
              select: { id: true, userId: true, channel: true },
            });

            // Dispatch through E9's notification delivery queue (handles WebSocket push, etc.)
            await enqueueNotificationDelivery(notification.id, NotificationChannel.IN_APP);

            // Emit notification.sent event per E9 conventions
            emitter.emit('notification.sent', {
              notificationId: notification.id,
              userId: notification.userId,
              channel: notification.channel,
              templateEventName: 'email.failed',
            });
          } catch (notifyErr) {
            logger.error(
              { emailQueueId, error: (notifyErr as Error).message },
              'email-send: failed to create failure notification',
            );
          }
        }

        logger.warn(
          {
            jobId: job.id,
            emailQueueId,
            attempts: job.attemptsMade,
            error: err.message,
          },
          'email-send: all retries exhausted — marked FAILED',
        );
      } catch (updateErr) {
        logger.error(
          { jobId: job.id, emailQueueId, error: (updateErr as Error).message },
          'email-send: failed to mark email as FAILED',
        );
      }
    } else {
      logger.warn(
        { jobId: job.id, emailQueueId, attempt: job.attemptsMade, error: err.message },
        'email-send: job failed — will retry',
      );
    }
  });

  // Cleanup function for graceful shutdown — close all cached SMTP transports
  function closeTransports(): void {
    for (const [, entry] of transportCache) {
      try {
        entry.transport.close();
      } catch {
        // Ignore — transport may already be closed
      }
    }
    transportCache.clear();
  }

  return { worker, closeTransports };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mark both the EmailMessage and EmailQueue as FAILED.
 */
async function markFailed(
  prisma: PrismaClient,
  emailQueueId: string,
  emailMessageId: string,
  errorMessage: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await (tx as unknown as PrismaClient).emailMessage.update({
      where: { id: emailMessageId },
      data: { status: EmailMessageStatus.FAILED },
    });

    await (tx as unknown as PrismaClient).emailQueue.update({
      where: { id: emailQueueId },
      data: {
        status: EmailQueueStatus.FAILED,
        lastError: errorMessage.slice(0, 5000),
      },
    });
  });
}
