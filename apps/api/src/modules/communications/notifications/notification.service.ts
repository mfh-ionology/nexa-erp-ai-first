import { Prisma, NotificationChannel, NotificationStatus } from '@nexa/db';
import type { PrismaClient } from '@nexa/db';

import type { RequestContext } from '../../../core/types/request-context.js';
import { AppError, NotFoundError } from '../../../core/errors/index.js';
import { eventBus } from '../../../core/events/event-bus.js';

import { renderNotificationTemplate } from './template-renderer.js';
import { resolveTargetUsers } from './target-resolver.js';
import { enqueueNotificationDelivery } from './notification-dispatch.queue.js';
import type { NotificationListQuery } from './notification.schema.js';

// ---------------------------------------------------------------------------
// Channel resolution helpers
// ---------------------------------------------------------------------------

/**
 * Determine active channels for a user/template pair using the BR-COM-014
 * preference cascade:
 *   1. User preference (if exists) → enableInApp/enableEmail/enablePush
 *   2. Template defaults (NotificationTemplate.defaultChannels)
 */
function resolveChannels(
  templateDefaults: NotificationChannel[],
  preference: { enableInApp: boolean; enableEmail: boolean; enablePush: boolean } | null,
): NotificationChannel[] {
  if (!preference) {
    return templateDefaults;
  }

  const channels: NotificationChannel[] = [];
  if (preference.enableInApp) channels.push(NotificationChannel.IN_APP);
  if (preference.enableEmail) channels.push(NotificationChannel.EMAIL);
  if (preference.enablePush) channels.push(NotificationChannel.PUSH);
  return channels;
}

// ---------------------------------------------------------------------------
// createNotificationsFromEvent (AC: #1, #2, #3, #4, #5)
// ---------------------------------------------------------------------------

/**
 * Process a business event and create notifications for target users.
 *
 * Called from event bus subscribers (Task 6). No RequestContext — this is
 * system-initiated, not user-initiated.
 *
 * Steps:
 * 1. Look up matching NotificationTemplate
 * 2. Resolve target users (Task 4)
 * 3. Render template content once
 * 4. Batch-fetch preferences (single query)
 * 5. Batch dedup check (single query)
 * 6. Create notifications in serializable transaction (race-safe)
 * 7. Dispatch + emit events outside transaction
 */
export async function createNotificationsFromEvent(
  prisma: PrismaClient,
  eventName: string,
  eventPayload: Record<string, unknown>,
  logger?: { warn: (...args: unknown[]) => void },
): Promise<void> {
  const log = logger ?? console;

  // 1. Look up active template matching this event
  const template = await prisma.notificationTemplate.findFirst({
    where: { eventName, isActive: true },
  });
  if (!template) return;

  // Task status change notifications only fire for COMPLETED transitions
  if (eventName === 'task.status_changed' && eventPayload.toStatus !== 'COMPLETED') {
    return;
  }

  // 2. Resolve target users
  const targetUserIds = await resolveTargetUsers(prisma, template, eventPayload, logger);
  if (targetUserIds.length === 0) return;

  // 3. Render template content once (same for all users)
  const rendered = renderNotificationTemplate(
    template.titleTemplate,
    template.bodyTemplate,
    template.actionUrl,
    { ...eventPayload, eventName },
    logger,
  );

  // 4. Batch-fetch all preferences for target users (single query, fixes N+1)
  const preferences = await prisma.notificationPreference.findMany({
    where: {
      notificationTemplateId: template.id,
      userId: { in: targetUserIds },
    },
  });
  const prefByUserId = new Map(preferences.map((p) => [p.userId, p]));

  const entityType = (eventPayload.entityType as string) ?? null;
  const entityId = (eventPayload.entityId as string) ?? null;
  const now = new Date();
  const deduplicationWindow = new Date(now.getTime() - 60_000);

  // 5. Build notification specs (filter muted users, resolve channels)
  interface NotificationSpec {
    userId: string;
    channel: NotificationChannel;
    priority: typeof template.defaultPriority;
  }
  const specs: NotificationSpec[] = [];

  for (const userId of targetUserIds) {
    const preference = prefByUserId.get(userId) ?? null;

    if (preference) {
      if (preference.isMuted) continue;
      if (preference.muteUntil && preference.muteUntil > now) continue;
    }

    const channels = resolveChannels(template.defaultChannels, preference);
    for (const channel of channels) {
      specs.push({
        userId,
        channel,
        priority: preference?.priorityOverride ?? template.defaultPriority,
      });
    }
  }
  if (specs.length === 0) return;

  // 6. Batch dedup check — single query for all user/channel combos
  const existingNotifications = await prisma.notification.findMany({
    where: {
      templateId: template.id,
      createdAt: { gte: deduplicationWindow },
      entityType,
      entityId,
      OR: specs.map((s) => ({ userId: s.userId, channel: s.channel })),
    },
    select: { userId: true, channel: true },
  });
  const existingKeys = new Set(existingNotifications.map((n) => `${n.userId}:${n.channel}`));
  const newSpecs = specs.filter((s) => !existingKeys.has(`${s.userId}:${s.channel}`));
  if (newSpecs.length === 0) return;

  // 7. Create notifications inside serializable transaction to prevent
  // TOCTOU race conditions from concurrent event processing
  let created: { id: string; userId: string; channel: NotificationChannel }[];
  try {
    created = await prisma.$transaction(
      async (tx) => {
        // Re-check dedup inside serializable TX (single batch query)
        const existingInTx = await tx.notification.findMany({
          where: {
            templateId: template.id,
            createdAt: { gte: deduplicationWindow },
            entityType,
            entityId,
            OR: newSpecs.map((s) => ({ userId: s.userId, channel: s.channel })),
          },
          select: { userId: true, channel: true },
        });
        const txExistingKeys = new Set(existingInTx.map((n) => `${n.userId}:${n.channel}`));
        const toCreate = newSpecs.filter((s) => !txExistingKeys.has(`${s.userId}:${s.channel}`));
        if (toCreate.length === 0) return [];

        const notifications: { id: string; userId: string; channel: NotificationChannel }[] = [];
        for (const spec of toCreate) {
          const n = await tx.notification.create({
            data: {
              userId: spec.userId,
              templateId: template.id,
              title: rendered.title,
              body: rendered.body,
              channel: spec.channel,
              priority: spec.priority,
              actionUrl: rendered.actionUrl,
              entityType,
              entityId,
              status: NotificationStatus.PENDING,
            },
            select: { id: true, userId: true, channel: true },
          });
          notifications.push(n);
        }
        return notifications;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    // Serialization failure or other TX error — log and bail
    log.warn('[notification-service] Transaction failed for event notifications:', error);
    return;
  }

  // 8. Dispatch and emit events outside transaction (per-channel independently)
  for (const notification of created) {
    try {
      await enqueueNotificationDelivery(notification.id, notification.channel);
    } catch (dispatchError) {
      // Per AC #5: channel dispatch failure must not block other channels
      log.warn(
        `[notification-service] Failed to enqueue delivery for notification ${notification.id} on ${notification.channel}:`,
        dispatchError,
      );
    }

    eventBus.emit('notification.sent', {
      notificationId: notification.id,
      userId: notification.userId,
      channel: notification.channel,
      templateEventName: eventName,
    });
  }
}

// ---------------------------------------------------------------------------
// listNotifications (cursor-based pagination)
// ---------------------------------------------------------------------------

export async function listNotifications(
  ctx: RequestContext,
  prisma: PrismaClient,
  query: NotificationListQuery,
) {
  const limit = query.limit ?? 20;

  const where: Prisma.NotificationWhereInput = {
    userId: ctx.userId,
  };
  if (query.status) {
    where.status = query.status;
  }

  const findArgs: Prisma.NotificationFindManyArgs = {
    where,
    orderBy: { createdAt: 'desc' as const },
    take: limit + 1, // fetch one extra to determine hasMore
  };

  if (query.cursor) {
    findArgs.cursor = { id: query.cursor };
    findArgs.skip = 1; // skip the cursor item itself
  }

  const items = await prisma.notification.findMany(findArgs);

  const hasMore = items.length > limit;
  if (hasMore) {
    items.pop(); // remove the extra item
  }

  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

  return {
    items,
    meta: {
      cursor: nextCursor,
      hasMore,
    },
  };
}

// ---------------------------------------------------------------------------
// markAsRead (AC: state machine §17.2)
// ---------------------------------------------------------------------------

export async function markAsRead(
  ctx: RequestContext,
  prisma: PrismaClient,
  notificationId: string,
) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: ctx.userId },
  });

  if (!notification) {
    throw new NotFoundError(
      'NOTIFICATION_NOT_FOUND',
      'Notification not found',
      'errors.notification.notFound',
    );
  }

  // State machine guard: only DELIVERED → READ is allowed
  if (notification.status !== NotificationStatus.DELIVERED) {
    throw new AppError(
      'INVALID_STATE_TRANSITION',
      `Cannot mark notification as read from status ${notification.status}`,
      422,
      undefined,
      'errors.notification.invalidStateTransition',
    );
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// dismissNotification (AC: state machine §17.2)
// ---------------------------------------------------------------------------

export async function dismissNotification(
  ctx: RequestContext,
  prisma: PrismaClient,
  notificationId: string,
) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: ctx.userId },
  });

  if (!notification) {
    throw new NotFoundError(
      'NOTIFICATION_NOT_FOUND',
      'Notification not found',
      'errors.notification.notFound',
    );
  }

  // State machine guard: only DELIVERED → DISMISSED is allowed
  if (notification.status !== NotificationStatus.DELIVERED) {
    throw new AppError(
      'INVALID_STATE_TRANSITION',
      `Cannot dismiss notification from status ${notification.status}`,
      422,
      undefined,
      'errors.notification.invalidStateTransition',
    );
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.DISMISSED,
      dismissedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// markAllAsRead (AC: #3 — bulk mark all unread as READ)
// ---------------------------------------------------------------------------

export async function markAllAsRead(
  ctx: RequestContext,
  prisma: PrismaClient,
): Promise<{ updated: number }> {
  // State machine §17.2: only DELIVERED → READ is valid.
  // PENDING notifications have not been delivered yet and cannot skip to READ.
  const result = await prisma.notification.updateMany({
    where: {
      userId: ctx.userId,
      status: NotificationStatus.DELIVERED,
    },
    data: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  });

  if (result.count > 0) {
    eventBus.emit('notification.bulk_read', {
      userId: ctx.userId,
      count: result.count,
    });
  }

  return { updated: result.count };
}

// ---------------------------------------------------------------------------
// getUnreadCount
// ---------------------------------------------------------------------------

export async function getUnreadCount(
  ctx: RequestContext,
  prisma: PrismaClient,
): Promise<{ count: number }> {
  const count = await prisma.notification.count({
    where: {
      userId: ctx.userId,
      status: { in: [NotificationStatus.PENDING, NotificationStatus.DELIVERED] },
    },
  });

  return { count };
}
