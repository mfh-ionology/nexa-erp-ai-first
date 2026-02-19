import type { PrismaClient, FieldVisibility } from '@nexa/db';

import { AppError } from '../../core/errors/index.js';
import { permissionCache } from '../../core/rbac/index.js';
import type { RequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Access Group Service
// ---------------------------------------------------------------------------

export async function listAccessGroups(prisma: PrismaClient, companyId: string) {
  return prisma.accessGroup.findMany({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { userAccessGroups: true } } },
  });
}

export async function getAccessGroup(prisma: PrismaClient, companyId: string, id: string) {
  const group = await prisma.accessGroup.findFirst({
    where: { id, companyId },
    include: {
      permissions: { orderBy: { resourceCode: 'asc' } },
      fieldOverrides: { orderBy: [{ resourceCode: 'asc' }, { fieldPath: 'asc' }] },
      _count: { select: { userAccessGroups: true } },
    },
  });
  if (!group) {
    throw new AppError('NOT_FOUND', 'Access group not found', 404);
  }
  return group;
}

export async function createAccessGroup(
  prisma: PrismaClient,
  companyId: string,
  data: { code: string; name: string; description?: string },
  ctx: RequestContext,
) {
  const existing = await prisma.accessGroup.findUnique({
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Prisma compound unique key
    where: { companyId_code: { companyId, code: data.code } },
  });
  if (existing) {
    throw new AppError('CONFLICT', `Access group with code '${data.code}' already exists`, 409);
  }

  return prisma.accessGroup.create({
    data: {
      companyId,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: {
      permissions: true,
      fieldOverrides: true,
    },
  });
}

export async function updateAccessGroup(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  data: { name?: string; description?: string | null; isActive?: boolean },
  ctx: RequestContext,
) {
  const group = await prisma.accessGroup.findFirst({
    where: { id, companyId },
  });
  if (!group) {
    throw new AppError('NOT_FOUND', 'Access group not found', 404);
  }

  const updated = await prisma.accessGroup.update({
    where: { id },
    data: {
      ...data,
      updatedBy: ctx.userId,
    },
    include: {
      permissions: true,
      fieldOverrides: true,
    },
  });

  // Invalidate permission cache for all users in this company
  permissionCache.invalidateCompany(companyId);

  return updated;
}

export async function deleteAccessGroup(prisma: PrismaClient, companyId: string, id: string) {
  const group = await prisma.accessGroup.findFirst({
    where: { id, companyId },
    include: { _count: { select: { userAccessGroups: true } } },
  });
  if (!group) {
    throw new AppError('NOT_FOUND', 'Access group not found', 404);
  }
  if (group.isSystem) {
    throw new AppError('FORBIDDEN', 'System access groups cannot be deleted', 403);
  }

  // Soft-delete by deactivating
  await prisma.accessGroup.update({
    where: { id },
    data: { isActive: false },
  });

  permissionCache.invalidateCompany(companyId);
}

export async function replacePermissions(
  prisma: PrismaClient,
  companyId: string,
  groupId: string,
  permissions: Array<{
    resourceCode: string;
    canAccess: boolean;
    canNew: boolean;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }>,
) {
  const group = await prisma.accessGroup.findFirst({
    where: { id: groupId, companyId },
  });
  if (!group) {
    throw new AppError('NOT_FOUND', 'Access group not found', 404);
  }

  // Replace all permissions in a transaction
  await prisma.$transaction([
    prisma.accessGroupPermission.deleteMany({ where: { accessGroupId: groupId } }),
    prisma.accessGroupPermission.createMany({
      data: permissions.map((p) => ({
        accessGroupId: groupId,
        ...p,
      })),
    }),
  ]);

  permissionCache.invalidateCompany(companyId);

  return prisma.accessGroupPermission.findMany({
    where: { accessGroupId: groupId },
    orderBy: { resourceCode: 'asc' },
  });
}

export async function replaceFieldOverrides(
  prisma: PrismaClient,
  companyId: string,
  groupId: string,
  fieldOverrides: Array<{
    resourceCode: string;
    fieldPath: string;
    visibility: string;
  }>,
) {
  const group = await prisma.accessGroup.findFirst({
    where: { id: groupId, companyId },
  });
  if (!group) {
    throw new AppError('NOT_FOUND', 'Access group not found', 404);
  }

  await prisma.$transaction([
    prisma.accessGroupFieldOverride.deleteMany({ where: { accessGroupId: groupId } }),
    prisma.accessGroupFieldOverride.createMany({
      data: fieldOverrides.map((fo) => ({
        accessGroupId: groupId,
        resourceCode: fo.resourceCode,
        fieldPath: fo.fieldPath,
        visibility: fo.visibility as FieldVisibility,
      })),
    }),
  ]);

  permissionCache.invalidateCompany(companyId);

  return prisma.accessGroupFieldOverride.findMany({
    where: { accessGroupId: groupId },
    orderBy: [{ resourceCode: 'asc' }, { fieldPath: 'asc' }],
  });
}
