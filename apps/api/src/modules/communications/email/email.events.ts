// ---------------------------------------------------------------------------
// Email Event Bus Subscribers — E10-1 Task 8.2
// Subscribe to email-related events for logging and activity tracking.
// Handlers wrap in try/catch so failures NEVER block the primary operation.
//
// Note: BullMQ permanent failure handling (notification creation on exhausted
// retries) is handled directly in email-send.worker.ts's `failed` event
// listener, NOT via the event bus. This avoids a round-trip through the bus
// for worker-internal state transitions.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';

import type { EventBus } from '../../../core/events/event-bus.js';

type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

/**
 * Register event bus subscribers for email-related events.
 *
 * Called during app startup from the communications module plugin.
 * Each subscriber wraps its handler in try/catch — failures must
 * NEVER propagate to the event emitter or block the primary operation.
 */
export function registerEmailEventSubscribers(
  eventBus: EventBus,
  prisma: PrismaClient,
  logger?: Logger,
): void {
  // ── email.sent → info log + audit trail if sent from a document context ──
  eventBus.on('email.sent', async (payload) => {
    try {
      const log = logger ?? console;
      log.info(
        {
          emailMessageId: payload.emailMessageId,
          recipient: payload.recipientEmail,
          subject: payload.subject,
        },
        '[email-events] email.sent — delivery confirmed',
      );

      // Create an AuditLog record if this email was sent from a source entity
      // (e.g. CustomerInvoice, PurchaseOrder). This links the email activity
      // back to the originating document for traceability.
      if (payload.documentType) {
        // Load the email message to get companyId, createdBy, and sourceEntityId
        const emailMessage = await prisma.emailMessage.findUnique({
          where: { id: payload.emailMessageId },
          select: {
            companyId: true,
            createdBy: true,
            sourceEntityId: true,
            sourceEntityType: true,
          },
        });

        if (emailMessage) {
          await prisma.auditLog.create({
            data: {
              companyId: emailMessage.companyId,
              entityType: emailMessage.sourceEntityType ?? 'EmailMessage',
              entityId: emailMessage.sourceEntityId ?? payload.emailMessageId,
              action: 'EMAIL_SENT',
              afterData: {
                emailMessageId: payload.emailMessageId,
                recipientEmail: payload.recipientEmail,
                subject: payload.subject,
                documentType: payload.documentType,
              },
              userId: emailMessage.createdBy,
            },
          });
        }
      }
    } catch (error) {
      const log = logger ?? console;
      log.warn('[email-events] Failed to process email.sent event:', error);
    }
  });
}
