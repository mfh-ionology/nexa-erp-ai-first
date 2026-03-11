import type { PrismaClient, NotificationTemplate } from '@nexa/db';
import { UserRole } from '@nexa/db';

/**
 * Resolve target user IDs for a notification based on event payload fields.
 *
 * Resolution strategies (evaluated in order, first match wins per field):
 *   1. Direct user reference — payload contains userId / assigneeId / currentAssigneeId
 *   2. Entity owner — payload contains entityType + entityId → look up createdBy
 *   3. Approval events — currentAssigneeId targets assignee; approvedBy/rejectedBy targets entity creator
 *   4. Role-based — events like stock.reorder.triggered → target all MANAGER-role users
 *
 * The user who triggered the event (payload.triggeredBy / payload.actorId) is
 * excluded to avoid self-notification.
 */
export async function resolveTargetUsers(
  prisma: PrismaClient,
  template: NotificationTemplate,
  eventPayload: Record<string, unknown>,
  logger?: { warn: (...args: unknown[]) => void },
): Promise<string[]> {
  const targetIds = new Set<string>();

  // Determine who triggered the event so we can exclude them
  const actorId = resolveActorId(eventPayload);

  // ── Strategy 5: Task events — resolve from task-specific payload fields ─
  // Gated to task.* events only to prevent leaking into unrelated events
  if (template.eventName.startsWith('task.')) {
    if (eventPayload.assigneeUserId) targetIds.add(eventPayload.assigneeUserId as string);
    if (Array.isArray(eventPayload.assigneeUserIds)) {
      for (const uid of eventPayload.assigneeUserIds) targetIds.add(uid as string);
    }
    if (eventPayload.createdById) targetIds.add(eventPayload.createdById as string);
  }

  // ── Strategy 1: Direct user reference ──────────────────────────────────
  const directUserId = (eventPayload.currentAssigneeId ??
    eventPayload.assigneeId ??
    eventPayload.userId ??
    eventPayload.newAssigneeId ??
    eventPayload.forwardedTo) as string | undefined;

  if (directUserId) {
    targetIds.add(directUserId);
  }

  // ── Strategy 2: Approval response → notify the entity creator ──────────
  // When an approval is completed/rejected, notify the person who requested it
  const approvalActor = (eventPayload.approvedBy ??
    eventPayload.rejectedBy ??
    eventPayload.cancelledBy) as string | undefined;

  if (approvalActor && eventPayload.entityType && eventPayload.entityId) {
    const creatorId = await lookupEntityCreator(
      prisma,
      eventPayload.entityType as string,
      eventPayload.entityId as string,
      logger,
    );
    if (creatorId) {
      targetIds.add(creatorId);
    }
  }

  // ── Strategy 3: Entity owner (generic) ─────────────────────────────────
  // If payload has entityType + entityId but no direct user ref was found,
  // look up the createdBy on the source entity
  if (targetIds.size === 0 && eventPayload.entityType && eventPayload.entityId) {
    const creatorId = await lookupEntityCreator(
      prisma,
      eventPayload.entityType as string,
      eventPayload.entityId as string,
      logger,
    );
    if (creatorId) {
      targetIds.add(creatorId);
    }
  }

  // ── Strategy 4: Role-based targeting ───────────────────────────────────
  // For system-level events (e.g. stock.reorder.triggered), target all
  // users with MANAGER role (or higher) in the relevant company
  if (targetIds.size === 0 && eventPayload.companyId) {
    const managerIds = await lookupUsersByRole(
      prisma,
      eventPayload.companyId as string,
      [UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
      logger,
    );
    for (const id of managerIds) {
      targetIds.add(id);
    }
  }

  // ── Filter out the actor (self-notification prevention) ────────────────
  if (actorId) {
    targetIds.delete(actorId);
  }

  return Array.from(targetIds);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determine which user triggered the event. Various event payloads use
 * different field names for the actor.
 */
function resolveActorId(eventPayload: Record<string, unknown>): string | undefined {
  return (eventPayload.triggeredBy ??
    eventPayload.actorId ??
    eventPayload.approvedBy ??
    eventPayload.rejectedBy ??
    eventPayload.cancelledBy ??
    eventPayload.forwardedBy ??
    eventPayload.assignedBy ??
    eventPayload.changedBy ??
    eventPayload.revokedBy ??
    eventPayload.deletedBy) as string | undefined;
}

/**
 * Look up the user who created a given entity. Uses a generic approach:
 * queries the entity table (mapped from entityType) for the `createdBy` field.
 *
 * Returns null if the entity type is unknown or the entity is not found.
 */
async function lookupEntityCreator(
  prisma: PrismaClient,
  entityType: string,
  entityId: string,
  logger?: { warn: (...args: unknown[]) => void },
): Promise<string | null> {
  // Map entityType strings to Prisma model delegate names
  const modelMap: Record<string, string> = {
    Invoice: 'invoice',
    PurchaseOrder: 'purchaseOrder',
    SalesOrder: 'salesOrder',
    Quote: 'quote',
    Bill: 'bill',
    JournalEntry: 'journalEntry',
    Payment: 'payment',
    Dispatch: 'dispatch',
    Task: 'task',
  };

  // Models that use `createdById` instead of `createdBy`
  const createdByFieldMap: Record<string, string> = {
    Task: 'createdById',
  };

  const modelName = modelMap[entityType];
  if (!modelName) {
    // Unknown entity type — log warning for observability so new entity types
    // are discovered when they fail to resolve (rather than silently ignored)
    const log = logger ?? console;
    log.warn(
      `[target-resolver] Unknown entityType "${entityType}" — cannot resolve creator. Add it to modelMap if notifications should target entity owners.`,
    );
    return null;
  }

  try {
    // Use dynamic model access — most entities have `createdBy`, some use `createdById`
    const model = (prisma as Record<string, any>)[modelName];
    if (!model?.findUnique) {
      return null;
    }

    const createdByField = createdByFieldMap[entityType] ?? 'createdBy';
    const entity = await model.findUnique({
      where: { id: entityId },
      select: { [createdByField]: true },
    });

    return (entity?.[createdByField] as string) ?? null;
  } catch {
    // Entity lookup failed — log and return null (don't crash notification flow)
    const log = logger ?? console;
    log.warn(`[target-resolver] Failed to look up creator for ${entityType}:${entityId}`);
    return null;
  }
}

/**
 * Find all users with one of the specified roles in a given company.
 */
async function lookupUsersByRole(
  prisma: PrismaClient,
  companyId: string,
  roles: UserRole[],
  logger?: { warn: (...args: unknown[]) => void },
): Promise<string[]> {
  try {
    const companyRoles = await prisma.userCompanyRole.findMany({
      where: {
        companyId,
        role: { in: roles },
      },
      select: { userId: true },
    });

    return companyRoles.map((cr) => cr.userId);
  } catch {
    const log = logger ?? console;
    log.warn(`[target-resolver] Failed to look up users by role for company ${companyId}`);
    return [];
  }
}
