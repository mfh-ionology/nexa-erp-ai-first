// ---------------------------------------------------------------------------
// Notification Event Bus Subscribers — E9-1 Task 6
// Subscribe to business events that should trigger notifications.
// Each handler calls createNotificationsFromEvent() and wraps in try/catch
// so notification failures NEVER block the primary business operation.
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';

import type { EventBus } from '../../../core/events/event-bus.js';
import type { BusinessEvents } from '../../../core/events/event-bus.types.js';

import { createNotificationsFromEvent } from './notification.service.js';

/**
 * Curated list of business events that should trigger notifications.
 * Each event name must exist in BusinessEvents interface.
 * When a template is configured for the event, notifications are created
 * for target users. If no template exists, the handler is a silent no-op.
 */
const NOTIFICATION_TRIGGERING_EVENTS: (keyof BusinessEvents)[] = [
  // Approvals
  'approval.requested',
  'approval.completed',
  'approval.rejected',
  'approval.escalated',
  'approval.forwarded',
  'approval.cancelled',

  // AR / Sales
  'invoice.approved',
  'payment.posted',
  'order.confirmed',
  'dispatch.shipped',

  // Inventory
  'stock.reorder.triggered',

  // Access Groups (RBAC)
  'user.accessGroups.assigned',
  'user.accessGroups.revoked',
  'accessGroup.deleted',

  // AI Automation
  'ai.automation.completed',
  'ai.automation.failed',
  'ai.automation.paused',
];

/**
 * Register event bus subscribers for notification-triggering events.
 *
 * Called during app startup from the communications module plugin.
 * Each subscriber wraps its handler in try/catch — notification failures
 * must NEVER propagate to the event emitter or block the primary business
 * operation that fired the event.
 */
export function registerNotificationSubscribers(
  eventBus: EventBus,
  prisma: PrismaClient,
  logger?: { warn: (...args: unknown[]) => void },
): void {
  for (const eventName of NOTIFICATION_TRIGGERING_EVENTS) {
    eventBus.on(eventName, async (payload: Record<string, unknown>) => {
      try {
        await createNotificationsFromEvent(prisma, eventName, payload, logger);
      } catch (error) {
        const log = logger ?? console;
        log.warn(
          `[notification-events] Failed to process notification for event "${eventName}":`,
          error,
        );
      }
    });
  }
}
