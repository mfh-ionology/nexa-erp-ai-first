import type { PrismaClient } from '@nexa/db';
import type { UserAccessGroupsResponse } from './user-access-groups.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { EventBus } from '../../core/events/event-bus.js';

// ---------------------------------------------------------------------------
// Prisma select shape — only return API-contract-defined fields
// ---------------------------------------------------------------------------

const ACCESS_GROUP_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  isSystem: true,
} as const;

// ---------------------------------------------------------------------------
// mapUserAccessGroups — shared result mapper
// ---------------------------------------------------------------------------

function mapUserAccessGroups(
  items: Array<{
    accessGroup: { id: string; code: string; name: string; description: string | null; isSystem: boolean };
    assignedBy: string;
    createdAt: Date;
  }>,
) {
  return items.map((item) => ({
    id: item.accessGroup.id,
    code: item.accessGroup.code,
    name: item.accessGroup.name,
    description: item.accessGroup.description,
    isSystem: item.accessGroup.isSystem,
    assignedBy: item.assignedBy,
    assignedAt: item.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// getUserAccessGroups
// ---------------------------------------------------------------------------

export async function getUserAccessGroups(
  prisma: PrismaClient,
  companyId: string,
  targetUserId: string,
): Promise<UserAccessGroupsResponse> {
  // Verify user exists and belongs to this company
  const userInCompany = await prisma.userCompanyRole.findFirst({
    where: { userId: targetUserId, companyId },
    select: { id: true },
  });

  if (!userInCompany) {
    throw new NotFoundError('USER_NOT_FOUND', 'User not found in this company');
  }

  const items = await prisma.userAccessGroup.findMany({
    where: { userId: targetUserId, companyId },
    include: { accessGroup: { select: ACCESS_GROUP_SELECT } },
    orderBy: { createdAt: 'asc' },
  });

  return {
    userId: targetUserId,
    companyId,
    accessGroups: mapUserAccessGroups(items),
  };
}

// ---------------------------------------------------------------------------
// assignUserAccessGroups
// ---------------------------------------------------------------------------

export async function assignUserAccessGroups(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  targetUserId: string,
  accessGroupIds: string[],
  assignedByUserId: string,
): Promise<UserAccessGroupsResponse> {
  // Verify target user exists in this company
  const userInCompany = await prisma.userCompanyRole.findFirst({
    where: { userId: targetUserId, companyId },
    select: { id: true },
  });

  if (!userInCompany) {
    throw new NotFoundError('USER_NOT_FOUND', 'User not found in this company');
  }

  // All validation and mutation inside a single transaction to prevent TOCTOU races
  const items = await prisma.$transaction(async (tx) => {
    // Validate ALL accessGroupIds belong to current company and are active
    const validGroups = await tx.accessGroup.findMany({
      where: { id: { in: accessGroupIds }, companyId, isActive: true },
      select: { id: true },
    });

    if (validGroups.length !== accessGroupIds.length) {
      throw new AppError(
        'INVALID_ACCESS_GROUP',
        'One or more access group IDs are invalid or belong to a different company',
        400,
      );
    }

    await tx.userAccessGroup.deleteMany({
      where: { userId: targetUserId, companyId },
    });

    await tx.userAccessGroup.createMany({
      data: accessGroupIds.map((groupId) => ({
        userId: targetUserId,
        accessGroupId: groupId,
        companyId,
        assignedBy: assignedByUserId,
      })),
    });

    return tx.userAccessGroup.findMany({
      where: { userId: targetUserId, companyId },
      include: { accessGroup: { select: ACCESS_GROUP_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
  });

  // Emit event AFTER successful transaction
  eventBus.emit('user.accessGroups.assigned', {
    userId: targetUserId,
    companyId,
    groupIds: accessGroupIds,
    assignedBy: assignedByUserId,
  });

  return {
    userId: targetUserId,
    companyId,
    accessGroups: mapUserAccessGroups(items),
  };
}
