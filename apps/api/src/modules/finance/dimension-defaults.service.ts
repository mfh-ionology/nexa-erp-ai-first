import type { PrismaClient } from '@nexa/db';
import type {
  CreateDimensionDefaultInput,
  ListDimensionDefaultsQuery,
} from './dimension-defaults.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const ITEM_SELECT = {
  id: true,
  dimensionTypeId: true,
  dimensionValueId: true,
  entityType: true,
  entityId: true,
  createdAt: true,
  updatedAt: true,
  dimensionType: { select: { id: true, code: true, name: true } },
  dimensionValue: { select: { id: true, code: true, name: true } },
} as const;

// ---------------------------------------------------------------------------
// listDimensionDefaults
// ---------------------------------------------------------------------------

export async function listDimensionDefaults(
  prisma: PrismaClient,
  companyId: string,
  query: ListDimensionDefaultsQuery,
) {
  const where: Record<string, unknown> = { companyId };
  if (query.entityType !== undefined) where.entityType = query.entityType;
  if (query.entityId !== undefined) where.entityId = query.entityId;
  if (query.dimensionTypeId !== undefined) where.dimensionTypeId = query.dimensionTypeId;

  const data = await prisma.dimensionDefault.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: ITEM_SELECT,
  });

  return data;
}

// ---------------------------------------------------------------------------
// createDimensionDefault
// ---------------------------------------------------------------------------

export async function createDimensionDefault(
  prisma: PrismaClient,
  companyId: string,
  data: CreateDimensionDefaultInput,
) {
  // Validate dimension type exists
  const dimensionType = await prisma.dimensionType.findFirst({
    where: { id: data.dimensionTypeId, companyId },
    select: { id: true },
  });
  if (!dimensionType) {
    throw new NotFoundError('NOT_FOUND', 'Dimension type not found');
  }

  // Validate dimension value exists and belongs to the type
  const dimensionValue = await prisma.dimensionValue.findFirst({
    where: { id: data.dimensionValueId, companyId, dimensionTypeId: data.dimensionTypeId },
    select: { id: true },
  });
  if (!dimensionValue) {
    throw new AppError(
      'INVALID_VALUE',
      'Dimension value does not exist or does not belong to the specified type',
      400,
    );
  }

  // For COMPANY entity type, entityId should be null
  const entityId = data.entityType === 'COMPANY' ? null : (data.entityId ?? null);

  // Check for duplicate
  const duplicate = await prisma.dimensionDefault.findFirst({
    where: {
      companyId,
      dimensionTypeId: data.dimensionTypeId,
      entityType: data.entityType,
      entityId,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError(
      'DUPLICATE_DEFAULT',
      'A default already exists for this dimension type and entity',
      409,
    );
  }

  const created = await prisma.dimensionDefault.create({
    data: {
      companyId,
      dimensionTypeId: data.dimensionTypeId,
      dimensionValueId: data.dimensionValueId,
      entityType: data.entityType,
      entityId,
    },
    select: ITEM_SELECT,
  });

  return created;
}

// ---------------------------------------------------------------------------
// deleteDimensionDefault
// ---------------------------------------------------------------------------

export async function deleteDimensionDefault(prisma: PrismaClient, companyId: string, id: string) {
  const existing = await prisma.dimensionDefault.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Dimension default not found');
  }

  await prisma.dimensionDefault.delete({ where: { id } });
}
