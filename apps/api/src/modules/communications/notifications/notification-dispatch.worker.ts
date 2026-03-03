// ---------------------------------------------------------------------------
// Notification Dispatch Worker — BullMQ worker for async channel delivery
// E9-1 Task 5.2
// ---------------------------------------------------------------------------

import { Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { PrismaClient } from '@nexa/db';
import { NotificationChannel, NotificationStatus } from '@nexa/db';

import type { NotificationDispatchJobData } from './notification-dispatch.queue.js';
import { NOTIFICATION_DISPATCH_QUEUE_NAME } from './notification-dispatch.queue.js';
import { pushNotificationToUser, pushUnreadCountToUser } from './notification.websocket.js';
import type { EmailSender } from '../email/email-sender.service.js';
import {
  renderNotificationEmailHtml,
  renderNotificationEmailText,
} from '../email/notification-email-template.js';
import { eventBus } from '../../../core/events/event-bus.js';

type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

// ---------------------------------------------------------------------------
// Channel delivery stubs
// ---------------------------------------------------------------------------

/**
 * IN_APP delivery: mark notification as DELIVERED, then push via WebSocket.
 * WebSocket push is best-effort — failures do NOT revert DELIVERED status.
 */
async function deliverInApp(
  prisma: PrismaClient,
  notificationId: string,
  logger: Logger,
): Promise<void> {
  const delivered = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.DELIVERED,
      deliveredAt: new Date(),
    },
    select: {
      id: true,
      userId: true,
      title: true,
      body: true,
      priority: true,
      actionUrl: true,
      entityType: true,
      entityId: true,
      status: true,
      createdAt: true,
    },
  });

  logger.debug({ notificationId, channel: 'IN_APP' }, 'notification-dispatch: IN_APP delivered');

  // Best-effort WebSocket push — failures must not revert DELIVERED status
  try {
    pushNotificationToUser(delivered.userId, {
      id: delivered.id,
      title: delivered.title,
      body: delivered.body,
      priority: delivered.priority,
      actionUrl: delivered.actionUrl,
      entityType: delivered.entityType,
      entityId: delivered.entityId,
      status: delivered.status,
      createdAt: delivered.createdAt.toISOString(),
    });

    // Push updated unread count
    const unreadCount = await prisma.notification.count({
      where: {
        userId: delivered.userId,
        status: { in: [NotificationStatus.PENDING, NotificationStatus.DELIVERED] },
      },
    });
    pushUnreadCountToUser(delivered.userId, unreadCount);
  } catch (err) {
    logger.warn(
      { notificationId, userId: delivered.userId, error: (err as Error).message },
      'notification-dispatch: WebSocket push failed — notification still DELIVERED',
    );
  }
}

/**
 * EMAIL delivery: looks up user email, renders HTML template, sends via SMTP.
 *
 * If emailSender is null (SMTP not configured), marks as FAILED (not DELIVERED)
 * to honestly reflect that the email was never sent. If sendEmail() throws, the
 * error propagates to BullMQ which handles retry via exponential backoff.
 *
 * NOTE: At-least-once delivery semantics — if the process crashes after
 * sendEmail() succeeds but before the DELIVERED status update, BullMQ will
 * retry and the email will be sent again. A PROCESSING state would be needed
 * for exactly-once guarantees (future scope).
 */
async function deliverEmail(
  prisma: PrismaClient,
  notification: {
    id: string;
    userId: string;
    title: string;
    body: string;
    actionUrl: string | null;
  },
  emailSender: EmailSender | null,
  logger: Logger,
): Promise<void> {
  const notificationId = notification.id;

  // 1. If email sender is not configured, mark FAILED — do not pretend it was delivered
  if (!emailSender) {
    logger.warn(
      { notificationId },
      'notification-dispatch: EMAIL sender not configured — marking FAILED (email not sent)',
    );
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.FAILED },
    });
    return;
  }

  // 2. Look up user's email address (notification object passed from processor — no duplicate fetch)
  const user = await prisma.user.findUnique({
    where: { id: notification.userId },
    select: { email: true, firstName: true, companyId: true },
  });
  if (!user?.email) {
    logger.warn(
      { notificationId, userId: notification.userId },
      'notification-dispatch: user has no email — marking FAILED',
    );
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.FAILED },
    });
    return;
  }

  // 3. Validate email format before wasting SMTP retries on obviously invalid addresses
  if (!isValidEmailFormat(user.email)) {
    logger.warn(
      { notificationId, userId: notification.userId, email: user.email },
      'notification-dispatch: invalid email format — marking FAILED',
    );
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.FAILED },
    });
    return;
  }

  // 4. Optionally fetch company branding
  const company = await prisma.companyProfile.findUnique({
    where: { id: user.companyId },
    select: { name: true, logoUrl: true },
  });

  // 5. Render HTML email from notification content
  const html = renderNotificationEmailHtml({
    title: notification.title,
    body: notification.body,
    actionUrl: notification.actionUrl,
    companyName: company?.name,
    logoUrl: company?.logoUrl,
  });
  const text = renderNotificationEmailText({
    title: notification.title,
    body: notification.body,
    actionUrl: notification.actionUrl,
  });

  // 6. Send email (throws on failure — BullMQ will retry)
  await emailSender.sendEmail({
    to: user.email,
    subject: notification.title,
    html,
    text,
  });

  // 7. Atomically mark notification as DELIVERED only if still PENDING.
  //    Uses updateMany with status condition to avoid race with concurrent workers.
  //    If count === 0, the notification was already processed elsewhere — skip.
  const updateResult = await prisma.notification.updateMany({
    where: { id: notificationId, status: NotificationStatus.PENDING },
    data: { status: NotificationStatus.DELIVERED, deliveredAt: new Date() },
  });
  if (updateResult.count === 0) {
    logger.debug(
      { notificationId },
      'notification-dispatch: notification no longer PENDING after EMAIL send — skipping status update',
    );
    return;
  }

  // 8. Emit email.sent event per event catalog §14
  eventBus.emit('email.sent', {
    emailMessageId: notificationId,
    recipientEmail: user.email,
    subject: notification.title,
    documentType: 'notification',
  });

  logger.debug(
    { notificationId, to: user.email, channel: 'EMAIL' },
    'notification-dispatch: EMAIL delivered',
  );
}

/** Basic email format validation — catches obviously invalid addresses before SMTP. */
function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * PUSH delivery stub: marks as DELIVERED and logs.
 * Push notification sending is future scope (mobile app not built yet).
 */
async function deliverPush(
  prisma: PrismaClient,
  notificationId: string,
  logger: Logger,
): Promise<void> {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.DELIVERED,
      deliveredAt: new Date(),
    },
  });
  logger.debug({ notificationId, channel: 'PUSH' }, 'notification-dispatch: PUSH stub delivered');
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

/**
 * Create and return a BullMQ Worker that processes notification delivery jobs.
 *
 * Each job dispatches to the appropriate channel handler. On failure, the
 * notification is marked as FAILED after all retries are exhausted (BullMQ
 * handles retry with exponential backoff configured on the queue).
 */
export function createNotificationDispatchWorker(
  prisma: PrismaClient,
  logger: Logger,
  connection: ConnectionOptions,
  emailSender: EmailSender | null = null,
): Worker<NotificationDispatchJobData> {
  const worker = new Worker<NotificationDispatchJobData>(
    NOTIFICATION_DISPATCH_QUEUE_NAME,
    async (job: Job<NotificationDispatchJobData>) => {
      const { notificationId, channel } = job.data;

      // Verify notification exists and is still PENDING
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        logger.warn({ notificationId }, 'notification-dispatch: notification not found — skipping');
        return;
      }

      if (notification.status !== NotificationStatus.PENDING) {
        logger.debug(
          { notificationId, currentStatus: notification.status },
          'notification-dispatch: notification no longer PENDING — skipping',
        );
        return;
      }

      // Dispatch to channel-specific handler
      switch (channel) {
        case NotificationChannel.IN_APP:
          await deliverInApp(prisma, notificationId, logger);
          break;
        case NotificationChannel.EMAIL:
          await deliverEmail(prisma, notification, emailSender, logger);
          break;
        case NotificationChannel.PUSH:
          await deliverPush(prisma, notificationId, logger);
          break;
        default:
          logger.warn(
            { notificationId, channel },
            'notification-dispatch: unknown channel — skipping',
          );
      }
    },
    {
      connection,
      concurrency: 5,
      settings: {
        // Custom backoff strategy matching story spec: [30s, 120s, 300s]
        backoffStrategy: (attemptsMade: number): number => {
          const delays = [30_000, 120_000, 300_000];
          return (
            delays[Math.min(attemptsMade - 1, delays.length - 1)] ?? delays[delays.length - 1]!
          );
        },
      },
    },
  );

  // -- Event listeners --

  worker.on('completed', (job) => {
    logger.debug(
      { jobId: job?.id, notificationId: job?.data.notificationId, channel: job?.data.channel },
      'notification-dispatch: job completed',
    );
  });

  worker.on('failed', async (job, err) => {
    if (job) {
      const { notificationId, channel } = job.data;

      // If all retries exhausted, mark notification as FAILED
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        try {
          await prisma.notification.update({
            where: { id: notificationId },
            data: { status: NotificationStatus.FAILED },
          });
          logger.warn(
            {
              jobId: job.id,
              notificationId,
              channel,
              attempts: job.attemptsMade,
              error: err.message,
            },
            'notification-dispatch: all retries exhausted — marked FAILED',
          );
        } catch (updateErr) {
          logger.error(
            { jobId: job.id, notificationId, error: (updateErr as Error).message },
            'notification-dispatch: failed to mark notification as FAILED',
          );
        }
      } else {
        logger.warn(
          { jobId: job.id, notificationId, channel, attempt: job.attemptsMade, error: err.message },
          'notification-dispatch: job failed — will retry',
        );
      }
    } else {
      logger.error(
        { error: err.message },
        'notification-dispatch: job failed with no job reference',
      );
    }
  });

  return worker;
}
