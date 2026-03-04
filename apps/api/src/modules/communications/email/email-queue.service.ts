// ---------------------------------------------------------------------------
// Email Queue Service — E10-1 Task 4
// Manages the email sending queue: transitions DRAFT → QUEUED, creates
// EmailQueue records, and enqueues BullMQ jobs for async SMTP delivery.
// ---------------------------------------------------------------------------

import { EmailMessageStatus, EmailQueueStatus } from '@nexa/db';
import type { PrismaClient, EmailQueue } from '@nexa/db';

import { AppError } from '../../../core/errors/index.js';
import { enqueueEmailSend } from './email-send.queue.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

// ---------------------------------------------------------------------------
// EmailQueueService
// ---------------------------------------------------------------------------

export class EmailQueueService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  // -------------------------------------------------------------------------
  // queueEmail (AC #2) — Task 4.2
  // -------------------------------------------------------------------------

  /**
   * Queue an email message for SMTP delivery.
   *
   * - Validates the EmailMessage exists and belongs to the caller's company
   * - Guards: rejects SENT or already-QUEUED emails (BR-COM-003)
   * - Allows re-queue of FAILED emails (resets attempts to 0)
   * - Transitions EmailMessage.status DRAFT → QUEUED
   * - Creates EmailQueue record with PENDING status
   * - Adds BullMQ job for async processing
   */
  async queueEmail(emailMessageId: string, companyId: string): Promise<EmailQueue> {
    // Load the email and verify company ownership
    const email = await this.prisma.emailMessage.findFirst({
      where: { id: emailMessageId, companyId },
      select: { id: true, status: true },
    });

    if (!email) {
      throw new AppError(
        'EMAIL_NOT_FOUND',
        'Email message not found',
        404,
        undefined,
        'errors.email.notFound',
      );
    }

    // BR-COM-003: cannot re-queue sent emails
    if (email.status === EmailMessageStatus.SENT) {
      throw new AppError(
        'EMAIL_ALREADY_SENT',
        'Cannot queue an already-sent email',
        409,
        undefined,
        'errors.email.alreadySent',
      );
    }

    // Reject if already QUEUED (prevent double-enqueue)
    if (email.status === EmailMessageStatus.QUEUED) {
      throw new AppError(
        'EMAIL_ALREADY_QUEUED',
        'Email is already queued for sending',
        409,
        undefined,
        'errors.email.alreadyQueued',
      );
    }

    // Allow re-queue of FAILED emails — reset the queue entry
    if (email.status === EmailMessageStatus.FAILED) {
      return this.reQueueFailedEmail(emailMessageId);
    }

    // Normal path: DRAFT → QUEUED
    if (email.status !== EmailMessageStatus.DRAFT) {
      throw new AppError(
        'EMAIL_INVALID_STATUS',
        `Cannot queue email with status ${email.status}`,
        409,
        undefined,
        'errors.email.invalidStatusForQueue',
      );
    }

    // Create queue entry and transition status in a single transaction
    const queueEntry = await this.prisma.$transaction(async (tx) => {
      // Transition EmailMessage.status → QUEUED
      await (tx as unknown as PrismaClient).emailMessage.update({
        where: { id: emailMessageId },
        data: { status: EmailMessageStatus.QUEUED },
      });

      // Create EmailQueue record
      return (tx as unknown as PrismaClient).emailQueue.create({
        data: {
          emailMessageId,
          status: EmailQueueStatus.PENDING,
          priority: 0,
          attempts: 0,
          maxAttempts: 3,
        },
      });
    });

    // Enqueue BullMQ job for async processing.
    // If enqueue fails, roll back DB state to prevent stuck-QUEUED emails.
    try {
      await enqueueEmailSend(queueEntry.id);
    } catch (enqueueErr) {
      this.logger.error(
        { emailMessageId, emailQueueId: queueEntry.id, error: (enqueueErr as Error).message },
        'email-queue: BullMQ enqueue failed — rolling back DB state',
      );

      await this.prisma.$transaction(async (tx) => {
        await (tx as unknown as PrismaClient).emailMessage.update({
          where: { id: emailMessageId },
          data: { status: EmailMessageStatus.DRAFT },
        });
        await (tx as unknown as PrismaClient).emailQueue.delete({
          where: { id: queueEntry.id },
        });
      });

      throw new AppError(
        'EMAIL_QUEUE_FAILED',
        'Failed to enqueue email for sending — please retry',
        503,
        undefined,
        'errors.email.queueFailed',
      );
    }

    this.logger.info({ emailMessageId, emailQueueId: queueEntry.id }, 'email queued for sending');

    return queueEntry;
  }

  // -------------------------------------------------------------------------
  // getQueueStatus — Task 4.3
  // -------------------------------------------------------------------------

  /**
   * Return the queue entry for an email message (for monitoring delivery status).
   */
  async getQueueStatus(emailMessageId: string): Promise<EmailQueue | null> {
    return this.prisma.emailQueue.findUnique({
      where: { emailMessageId },
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Re-queue a FAILED email: reset attempts, set status back to PENDING,
   * transition EmailMessage.status back to QUEUED.
   */
  private async reQueueFailedEmail(emailMessageId: string): Promise<EmailQueue> {
    const queueEntry = await this.prisma.$transaction(async (tx) => {
      // Transition EmailMessage.status → QUEUED
      await (tx as unknown as PrismaClient).emailMessage.update({
        where: { id: emailMessageId },
        data: { status: EmailMessageStatus.QUEUED },
      });

      // Reset the existing queue entry
      return (tx as unknown as PrismaClient).emailQueue.update({
        where: { emailMessageId },
        data: {
          status: EmailQueueStatus.PENDING,
          attempts: 0,
          lastError: null,
          nextRetryAt: null,
          smtpResponse: null,
          processedAt: null,
          queuedAt: new Date(),
        },
      });
    });

    // Enqueue BullMQ job for async processing.
    // If enqueue fails, roll back DB state to prevent stuck-QUEUED emails.
    try {
      await enqueueEmailSend(queueEntry.id);
    } catch (enqueueErr) {
      this.logger.error(
        { emailMessageId, emailQueueId: queueEntry.id, error: (enqueueErr as Error).message },
        'email-queue: BullMQ re-enqueue failed — rolling back DB state',
      );

      await this.prisma.$transaction(async (tx) => {
        await (tx as unknown as PrismaClient).emailMessage.update({
          where: { id: emailMessageId },
          data: { status: EmailMessageStatus.FAILED },
        });
        await (tx as unknown as PrismaClient).emailQueue.update({
          where: { emailMessageId },
          data: { status: EmailQueueStatus.FAILED },
        });
      });

      throw new AppError(
        'EMAIL_QUEUE_FAILED',
        'Failed to enqueue email for sending — please retry',
        503,
        undefined,
        'errors.email.queueFailed',
      );
    }

    this.logger.info(
      { emailMessageId, emailQueueId: queueEntry.id },
      'failed email re-queued for sending',
    );

    return queueEntry;
  }
}
