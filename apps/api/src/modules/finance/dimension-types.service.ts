import type { PrismaClient } from '@nexa/db';
import type {
  CreateDimensionTypeInput,
  UpdateDimensionTypeInput,
  ListDimensionTypesQuery,
} from './dimension-types.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  isSingleSelect: true,
  allowManualEntry: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  _count: { select: { values: true } },
} as const;

// ---------------------------------------------------------------------------
// listDimensionTypes
// ---------------------------------------------------------------------------

export async function listDimensionTypes(
  prisma: PrismaClient,
  companyId: string,
  query: ListDimensionTypesQuery,
) {
  const { cursor, limit, isActive } = query;

  const where: Record<string, unknown> = { companyId };
  if (isActive !== undefined) where.isActive = isActive;

  const [items, total] = await Promise.all([
    prisma.dimensionType.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: LIST_SELECT,
    }),
    prisma.dimensionType.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data, meta };
}

// ---------------------------------------------------------------------------
// getDimensionTypeById
// ---------------------------------------------------------------------------

export async function getDimensionTypeById(prisma: PrismaClient, companyId: string, id: string) {
  const dimensionType = await prisma.dimensionType.findFirst({
    where: { id, companyId },
    select: DETAIL_SELECT,
  });

  if (!dimensionType) {
    throw new NotFoundError('NOT_FOUND', 'Dimension type not found');
  }

  return dimensionType;
}

// ---------------------------------------------------------------------------
// createDimensionType
// ---------------------------------------------------------------------------

export async function createDimensionType(
  prisma: PrismaClient,
  companyId: string,
  data: CreateDimensionTypeInput,
  _userId: string,
) {
  try {
    const dimensionType = await prisma.dimensionType.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        isSingleSelect: data.isSingleSelect,
        allowManualEntry: data.allowManualEntry,
        sortOrder: data.sortOrder,
      },
      select: DETAIL_SELECT,
    });

    return dimensionType;
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError('DUPLICATE_CODE', 'Dimension type code already exists', 409);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// updateDimensionType
// ---------------------------------------------------------------------------

export async function updateDimensionType(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  data: UpdateDimensionTypeInput,
  _userId: string,
) {
  const existing = await prisma.dimensionType.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Dimension type not found');
  }

  const updated = await prisma.dimensionType.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isSingleSelect !== undefined && { isSingleSelect: data.isSingleSelect }),
      ...(data.allowManualEntry !== undefined && { allowManualEntry: data.allowManualEntry }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedAt: new Date(),
    },
    select: DETAIL_SELECT,
  });

  return updated;
}
