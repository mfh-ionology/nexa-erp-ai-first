import type { PrismaClient } from '@nexa/db';
import type {
  CreateDimensionRequirementInput,
  UpdateDimensionRequirementInput,
  ListDimensionRequirementsQuery,
} from './dimension-requirements.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const ITEM_SELECT = {
  id: true,
  dimensionTypeId: true,
  accountCodeFrom: true,
  accountCodeTo: true,
  isRequired: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  dimensionType: { select: { id: true, code: true, name: true } },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function validateAccountCodeExists(
  prisma: PrismaClient,
  companyId: string,
  code: string,
  label: string,
) {
  const account = await prisma.chartOfAccount.findFirst({
    where: { companyId, code },
    select: { id: true },
  });
  if (!account) {
    throw new AppError('INVALID_ACCOUNT', `${label} does not exist`, 400);
  }
}

function validateRange(from: string, to: string) {
  if (from > to) {
    throw new AppError('INVALID_RANGE', 'accountCodeFrom must be <= accountCodeTo', 400);
  }
}

// ---------------------------------------------------------------------------
// listDimensionRequirements
// ---------------------------------------------------------------------------

export async function listDimensionRequirements(
  prisma: PrismaClient,
  companyId: string,
  query: ListDimensionRequirementsQuery,
) {
  const { cursor, limit, dimensionTypeId } = query;

  const where: Record<string, unknown> = { companyId };
  if (dimensionTypeId !== undefined) where.dimensionTypeId = dimensionTypeId;

  const [items, total] = await Promise.all([
    prisma.dimensionRequirement.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { accountCodeFrom: 'asc' },
      select: ITEM_SELECT,
    }),
    prisma.dimensionRequirement.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data, meta };
}

// ---------------------------------------------------------------------------
// createDimensionRequirement
// ---------------------------------------------------------------------------

export async function createDimensionRequirement(
  prisma: PrismaClient,
  companyId: string,
  data: CreateDimensionRequirementInput,
) {
  // Validate dimension type exists
  const dimensionType = await prisma.dimensionType.findFirst({
    where: { id: data.dimensionTypeId, companyId },
    select: { id: true },
  });
  if (!dimensionType) {
    throw new NotFoundError('NOT_FOUND', 'Dimension type not found');
  }

  // Validate account code range
  validateRange(data.accountCodeFrom, data.accountCodeTo);

  // Validate both account codes exist
  await validateAccountCodeExists(prisma, companyId, data.accountCodeFrom, 'Account code from');
  await validateAccountCodeExists(prisma, companyId, data.accountCodeTo, 'Account code to');

  const requirement = await prisma.dimensionRequirement.create({
    data: {
      companyId,
      dimensionTypeId: data.dimensionTypeId,
      accountCodeFrom: data.accountCodeFrom,
      accountCodeTo: data.accountCodeTo,
      isRequired: data.isRequired,
    },
    select: ITEM_SELECT,
  });

  return requirement;
}

// ---------------------------------------------------------------------------
// updateDimensionRequirement
// ---------------------------------------------------------------------------

export async function updateDimensionRequirement(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  data: UpdateDimensionRequirementInput,
) {
  const existing = await prisma.dimensionRequirement.findFirst({
    where: { id, companyId },
    select: { id: true, accountCodeFrom: true, accountCodeTo: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Dimension requirement not found');
  }

  // Determine effective from/to for range validation
  const effectiveFrom = data.accountCodeFrom ?? existing.accountCodeFrom;
  const effectiveTo = data.accountCodeTo ?? existing.accountCodeTo;

  // Re-validate range if codes change
  if (data.accountCodeFrom !== undefined || data.accountCodeTo !== undefined) {
    validateRange(effectiveFrom, effectiveTo);

    if (data.accountCodeFrom !== undefined) {
      await validateAccountCodeExists(prisma, companyId, data.accountCodeFrom, 'Account code from');
    }
    if (data.accountCodeTo !== undefined) {
      await validateAccountCodeExists(prisma, companyId, data.accountCodeTo, 'Account code to');
    }
  }

  const updated = await prisma.dimensionRequirement.update({
    where: { id },
    data: {
      ...(data.accountCodeFrom !== undefined && { accountCodeFrom: data.accountCodeFrom }),
      ...(data.accountCodeTo !== undefined && { accountCodeTo: data.accountCodeTo }),
      ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedAt: new Date(),
    },
    select: ITEM_SELECT,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// deleteDimensionRequirement
// ---------------------------------------------------------------------------

export async function deleteDimensionRequirement(
  prisma: PrismaClient,
  companyId: string,
  id: string,
) {
  const existing = await prisma.dimensionRequirement.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Dimension requirement not found');
  }

  await prisma.dimensionRequirement.delete({ where: { id } });
}
