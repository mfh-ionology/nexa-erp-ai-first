import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type {
  CreateDimensionValueInput,
  UpdateDimensionValueInput,
  ListDimensionValuesQuery,
} from './dimension-values.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const LIST_SELECT = {
  id: true,
  dimensionTypeId: true,
  code: true,
  name: true,
  parentId: true,
  isActive: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  parent: { select: { id: true, code: true, name: true } },
  children: {
    select: LIST_SELECT,
    orderBy: { code: 'asc' as const },
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyTypeExists(prisma: PrismaClient, companyId: string, typeId: string) {
  const dimensionType = await prisma.dimensionType.findFirst({
    where: { id: typeId, companyId },
    select: { id: true },
  });
  if (!dimensionType) {
    throw new NotFoundError('NOT_FOUND', 'Dimension type not found');
  }
  return dimensionType;
}

async function checkHierarchyDepth(prisma: PrismaClient, parentId: string, maxDepth = 5) {
  let currentId: string | null = parentId;
  let depth = 1; // Start at 1 because the value being inserted adds one level
  while (currentId && depth < maxDepth) {
    const parentRecord: { parentId: string | null } | null = await prisma.dimensionValue.findFirst({
      where: { id: currentId },
      select: { parentId: true },
    });
    if (!parentRecord || !parentRecord.parentId) break;
    currentId = parentRecord.parentId;
    depth++;
  }
  if (depth >= maxDepth) {
    throw new AppError('MAX_DEPTH_EXCEEDED', 'Maximum hierarchy depth of 5 levels exceeded', 400);
  }
}

// ---------------------------------------------------------------------------
// listDimensionValues
// ---------------------------------------------------------------------------

export async function listDimensionValues(
  prisma: PrismaClient,
  companyId: string,
  typeId: string,
  query: ListDimensionValuesQuery,
) {
  await verifyTypeExists(prisma, companyId, typeId);

  const { cursor, limit, isActive, parentId, search } = query;

  const where: Record<string, unknown> = { companyId, dimensionTypeId: typeId };
  if (isActive !== undefined) where.isActive = isActive;
  if (parentId !== undefined) where.parentId = parentId;
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.dimensionValue.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { code: 'asc' },
      select: LIST_SELECT,
    }),
    prisma.dimensionValue.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data, meta };
}

// ---------------------------------------------------------------------------
// getDimensionValueById
// ---------------------------------------------------------------------------

export async function getDimensionValueById(
  prisma: PrismaClient,
  companyId: string,
  typeId: string,
  id: string,
) {
  await verifyTypeExists(prisma, companyId, typeId);

  const value = await prisma.dimensionValue.findFirst({
    where: { id, companyId, dimensionTypeId: typeId },
    select: DETAIL_SELECT,
  });

  if (!value) {
    throw new NotFoundError('NOT_FOUND', 'Dimension value not found');
  }

  return value;
}

// ---------------------------------------------------------------------------
// createDimensionValue
// ---------------------------------------------------------------------------

export async function createDimensionValue(
  prisma: PrismaClient,
  companyId: string,
  typeId: string,
  data: CreateDimensionValueInput,
) {
  await verifyTypeExists(prisma, companyId, typeId);

  if (data.parentId) {
    const parent = await prisma.dimensionValue.findFirst({
      where: { id: data.parentId, companyId, dimensionTypeId: typeId },
      select: { id: true },
    });
    if (!parent) {
      throw new AppError('INVALID_PARENT', 'Parent value does not exist in this type', 400);
    }
    await checkHierarchyDepth(prisma, data.parentId);
  }

  try {
    const value = await prisma.dimensionValue.create({
      data: {
        companyId,
        dimensionTypeId: typeId,
        code: data.code,
        name: data.name,
        parentId: data.parentId ?? null,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      select: DETAIL_SELECT,
    });

    return value;
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError(
        'DUPLICATE_CODE',
        'Dimension value code already exists for this type',
        409,
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// updateDimensionValue
// ---------------------------------------------------------------------------

export async function updateDimensionValue(
  prisma: PrismaClient,
  companyId: string,
  typeId: string,
  id: string,
  data: UpdateDimensionValueInput,
) {
  await verifyTypeExists(prisma, companyId, typeId);

  const existing = await prisma.dimensionValue.findFirst({
    where: { id, companyId, dimensionTypeId: typeId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Dimension value not found');
  }

  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === id) {
      throw new AppError('CIRCULAR_PARENT', 'Value cannot be its own parent', 400);
    }
    const parent = await prisma.dimensionValue.findFirst({
      where: { id: data.parentId, companyId, dimensionTypeId: typeId },
      select: { id: true },
    });
    if (!parent) {
      throw new AppError('INVALID_PARENT', 'Parent value does not exist in this type', 400);
    }
    await checkHierarchyDepth(prisma, data.parentId);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.metadata !== undefined) {
    updateData.metadata =
      data.metadata === null ? Prisma.JsonNull : (data.metadata as Prisma.InputJsonValue);
  }

  const updated = await prisma.dimensionValue.update({
    where: { id },
    data: updateData,
    select: DETAIL_SELECT,
  });

  return updated;
}
