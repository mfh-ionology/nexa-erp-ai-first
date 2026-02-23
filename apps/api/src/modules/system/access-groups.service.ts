import type { PrismaClient } from '@nexa/db';
import type {
  CreateAccessGroupInput,
  UpdateAccessGroupInput,
  ListAccessGroupsQuery,
  SetPermissionsInput,
} from './access-groups.schema.js';
import { AppError, DomainError, NotFoundError } from '../../core/errors/index.js';
import type { EventBus } from '../../core/events/event-bus.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Prisma select shapes — only return API-contract-defined fields
// ---------------------------------------------------------------------------

const PERMISSION_SELECT = {
  resourceCode: true,
  canAccess: true,
  canNew: true,
  canView: true,
  canEdit: true,
  canDelete: true,
} as const;

const FIELD_OVERRIDE_SELECT = {
  resourceCode: true,
  fieldPath: true,
  visibility: true,
} as const;

const ACTIVE_USER_COUNT = {
  select: { userAccessGroups: { where: { user: { isActive: true } } } },
} as const;

const BASE_FIELDS = {
  id: true,
  code: true,
  name: true,
  description: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// createAccessGroup
// ---------------------------------------------------------------------------

export async function createAccessGroup(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  data: CreateAccessGroupInput,
  userId: string,
) {
  try {
    const group = await prisma.accessGroup.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
      select: {
        ...BASE_FIELDS,
        permissions: { select: PERMISSION_SELECT },
        fieldOverrides: { select: FIELD_OVERRIDE_SELECT },
        _count: ACTIVE_USER_COUNT,
      },
    });

    eventBus.emit('accessGroup.created', {
      groupId: group.id,
      companyId,
      code: group.code,
      name: group.name,
      createdBy: userId,
    });

    const { _count, ...rest } = group;
    return { ...rest, userCount: _count.userAccessGroups };
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError('DUPLICATE_CODE', 'Access group code already exists for this company', 409);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// listAccessGroups
// ---------------------------------------------------------------------------

export async function listAccessGroups(
  prisma: PrismaClient,
  companyId: string,
  query: ListAccessGroupsQuery,
) {
  const { cursor, limit, search, isActive } = query;

  const where: Record<string, unknown> = { companyId };
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.accessGroup.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        ...BASE_FIELDS,
        _count: ACTIVE_USER_COUNT,
      },
    }),
    prisma.accessGroup.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const mapped = data.map(({ _count, ...rest }) => ({
    ...rest,
    userCount: _count.userAccessGroups,
  }));

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data: mapped, meta };
}

// ---------------------------------------------------------------------------
// getAccessGroupById
// ---------------------------------------------------------------------------

export async function getAccessGroupById(
  prisma: PrismaClient,
  companyId: string,
  id: string,
) {
  const group = await prisma.accessGroup.findFirst({
    where: { id, companyId },
    select: {
      ...BASE_FIELDS,
      permissions: { select: PERMISSION_SELECT },
      fieldOverrides: { select: FIELD_OVERRIDE_SELECT },
      _count: ACTIVE_USER_COUNT,
    },
  });

  if (!group) {
    throw new NotFoundError('NOT_FOUND', 'Access group not found');
  }

  const { _count, ...rest } = group;
  return { ...rest, userCount: _count.userAccessGroups };
}

// ---------------------------------------------------------------------------
// updateAccessGroup
// ---------------------------------------------------------------------------

export async function updateAccessGroup(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  data: UpdateAccessGroupInput,
  userId: string,
) {
  // Wrap find + update in a transaction to prevent TOCTOU race
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.accessGroup.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError('NOT_FOUND', 'Access group not found');
    }

    // Note: system groups (isSystem: true) CAN have name/description modified
    // per E2b-2 AC#4. Only deletion is blocked for system groups.

    return tx.accessGroup.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId,
      },
      select: {
        ...BASE_FIELDS,
        permissions: { select: PERMISSION_SELECT },
        fieldOverrides: { select: FIELD_OVERRIDE_SELECT },
        _count: ACTIVE_USER_COUNT,
      },
    });
  });

  eventBus.emit('accessGroup.updated', {
    groupId: id,
    companyId,
    changedBy: userId,
  });

  const { _count, ...rest } = updated;
  return { ...rest, userCount: _count.userAccessGroups };
}

// ---------------------------------------------------------------------------
// deleteAccessGroup
// ---------------------------------------------------------------------------

export async function deleteAccessGroup(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  userId: string,
) {
  // Wrap find + count + update in a transaction to prevent TOCTOU race
  await prisma.$transaction(async (tx) => {
    const existing = await tx.accessGroup.findFirst({
      where: { id, companyId, isActive: true },
      select: { id: true, isSystem: true },
    });

    if (!existing) {
      throw new NotFoundError('NOT_FOUND', 'Access group not found');
    }

    if (existing.isSystem) {
      throw new DomainError('SYSTEM_GROUP_PROTECTED', 'Cannot delete a system access group');
    }

    const userCount = await tx.userAccessGroup.count({
      where: { accessGroupId: id, companyId, user: { isActive: true } },
    });

    if (userCount > 0) {
      throw new DomainError('GROUP_HAS_USERS', 'Cannot delete access group with active user assignments');
    }

    await tx.accessGroup.update({
      where: { id },
      data: { isActive: false, updatedBy: userId },
    });
  });

  eventBus.emit('accessGroup.deleted', {
    groupId: id,
    companyId,
    deletedBy: userId,
  });
}

// ---------------------------------------------------------------------------
// setAccessGroupPermissions
// ---------------------------------------------------------------------------

export async function setAccessGroupPermissions(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  permissions: SetPermissionsInput,
  userId: string,
) {
  // Validate all resource codes exist (outside transaction — read-only, no TOCTOU risk)
  const codes = permissions.map((p) => p.resourceCode);
  if (codes.length > 0) {
    const validResources = await prisma.resource.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    const validCodes = new Set(validResources.map((r) => r.code));
    const invalidCodes = codes.filter((c) => !validCodes.has(c));
    if (invalidCodes.length > 0) {
      throw new AppError('INVALID_RESOURCE', 'One or more resource codes are invalid', 400);
    }
  }

  // Wrap find + guard + replace-all in a transaction to prevent TOCTOU race
  const newPermissions = await prisma.$transaction(async (tx) => {
    const existing = await tx.accessGroup.findFirst({
      where: { id, companyId },
      select: { id: true, isActive: true, isSystem: true },
    });

    if (!existing) {
      throw new NotFoundError('NOT_FOUND', 'Access group not found');
    }

    if (!existing.isActive) {
      throw new DomainError('GROUP_INACTIVE', 'Cannot set permissions on an inactive access group');
    }

    if (existing.isSystem) {
      throw new DomainError('SYSTEM_GROUP_PROTECTED', 'Cannot modify permissions of a system access group');
    }

    await tx.accessGroupPermission.deleteMany({
      where: { accessGroupId: id },
    });

    if (permissions.length > 0) {
      await tx.accessGroupPermission.createMany({
        data: permissions.map((p) => ({
          accessGroupId: id,
          resourceCode: p.resourceCode,
          canAccess: p.canAccess,
          canNew: p.canNew,
          canView: p.canView,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        })),
      });
    }

    return tx.accessGroupPermission.findMany({
      where: { accessGroupId: id },
      select: PERMISSION_SELECT,
    });
  });

  eventBus.emit('accessGroup.updated', {
    groupId: id,
    companyId,
    changedBy: userId,
  });

  return newPermissions;
}
