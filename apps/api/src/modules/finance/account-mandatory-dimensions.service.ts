import type { PrismaClient } from '@nexa/db';
import { AppError, NotFoundError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const ITEM_SELECT = {
  id: true,
  dimensionTypeId: true,
  createdAt: true,
  dimensionType: { select: { id: true, code: true, name: true } },
} as const;

// ---------------------------------------------------------------------------
// listByAccount — list mandatory dimension types for a single account
// ---------------------------------------------------------------------------

export async function listMandatoryDimensionsByAccount(
  prisma: PrismaClient,
  companyId: string,
  chartOfAccountId: string,
) {
  // Verify account exists and belongs to company
  const account = await prisma.chartOfAccount.findFirst({
    where: { id: chartOfAccountId, companyId },
    select: { id: true },
  });
  if (!account) {
    throw new NotFoundError('NOT_FOUND', 'Account not found');
  }

  return prisma.accountMandatoryDimension.findMany({
    where: { chartOfAccountId, companyId },
    select: ITEM_SELECT,
    orderBy: { dimensionType: { sortOrder: 'asc' } },
  });
}

// ---------------------------------------------------------------------------
// setMandatoryDimensions — replace all mandatory dimension types for an account
// ---------------------------------------------------------------------------

export async function setMandatoryDimensions(
  prisma: PrismaClient,
  companyId: string,
  chartOfAccountId: string,
  dimensionTypeIds: string[],
) {
  // Verify account exists and belongs to company
  const account = await prisma.chartOfAccount.findFirst({
    where: { id: chartOfAccountId, companyId },
    select: { id: true },
  });
  if (!account) {
    throw new NotFoundError('NOT_FOUND', 'Account not found');
  }

  // Validate all dimension types exist and belong to company
  if (dimensionTypeIds.length > 0) {
    const types = await prisma.dimensionType.findMany({
      where: { id: { in: dimensionTypeIds }, companyId },
      select: { id: true },
    });
    const foundIds = new Set(types.map((t) => t.id));
    for (const typeId of dimensionTypeIds) {
      if (!foundIds.has(typeId)) {
        throw new AppError('DIMENSION_TYPE_NOT_FOUND', `Dimension type "${typeId}" not found`, 400);
      }
    }
  }

  // Replace: delete all existing, then create new ones
  await prisma.$transaction(async (tx) => {
    await tx.accountMandatoryDimension.deleteMany({
      where: { chartOfAccountId, companyId },
    });

    if (dimensionTypeIds.length > 0) {
      await tx.accountMandatoryDimension.createMany({
        data: dimensionTypeIds.map((dimensionTypeId) => ({
          companyId,
          chartOfAccountId,
          dimensionTypeId,
        })),
      });
    }
  });

  // Return updated list
  return prisma.accountMandatoryDimension.findMany({
    where: { chartOfAccountId, companyId },
    select: ITEM_SELECT,
    orderBy: { dimensionType: { sortOrder: 'asc' } },
  });
}

// ---------------------------------------------------------------------------
// bulkAssignMandatoryDimensions — assign dimension types to multiple accounts
// ---------------------------------------------------------------------------

export async function bulkAssignMandatoryDimensions(
  prisma: PrismaClient,
  companyId: string,
  dimensionTypeIds: string[],
  accountIds?: string[],
  accountRange?: { from: string; to: string },
) {
  // Validate dimension types
  const types = await prisma.dimensionType.findMany({
    where: { id: { in: dimensionTypeIds }, companyId },
    select: { id: true },
  });
  const foundTypeIds = new Set(types.map((t) => t.id));
  for (const typeId of dimensionTypeIds) {
    if (!foundTypeIds.has(typeId)) {
      throw new AppError('DIMENSION_TYPE_NOT_FOUND', `Dimension type "${typeId}" not found`, 400);
    }
  }

  // Resolve target accounts
  let targetAccounts: Array<{ id: string; code: string }>;

  if (accountIds && accountIds.length > 0) {
    targetAccounts = await prisma.chartOfAccount.findMany({
      where: { id: { in: accountIds }, companyId },
      select: { id: true, code: true },
    });
  } else if (accountRange) {
    if (accountRange.from > accountRange.to) {
      throw new AppError('INVALID_RANGE', 'Account range "from" must be <= "to"', 400);
    }
    targetAccounts = await prisma.chartOfAccount.findMany({
      where: {
        companyId,
        code: { gte: accountRange.from, lte: accountRange.to },
      },
      select: { id: true, code: true },
    });
  } else {
    throw new AppError('INVALID_INPUT', 'Either accountIds or accountRange must be provided', 400);
  }

  if (targetAccounts.length === 0) {
    return { accountsAffected: 0, dimensionTypesApplied: 0 };
  }

  // Build insert data (skip duplicates via skipDuplicates)
  const insertData = targetAccounts.flatMap((account) =>
    dimensionTypeIds.map((dimensionTypeId) => ({
      companyId,
      chartOfAccountId: account.id,
      dimensionTypeId,
    })),
  );

  await prisma.accountMandatoryDimension.createMany({
    data: insertData,
    skipDuplicates: true,
  });

  return {
    accountsAffected: targetAccounts.length,
    dimensionTypesApplied: dimensionTypeIds.length,
  };
}

// ---------------------------------------------------------------------------
// getMandatoryDimensionsForAccounts — used by journal validation
// Returns Map<chartOfAccountId, dimensionTypeId[]>
// ---------------------------------------------------------------------------

export async function getMandatoryDimensionsForAccounts(
  prisma: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  companyId: string,
  chartOfAccountIds: string[],
): Promise<
  Map<
    string,
    Array<{ dimensionTypeId: string; dimensionTypeName: string; dimensionTypeCode: string }>
  >
> {
  if (chartOfAccountIds.length === 0) return new Map();

  const records = await prisma.accountMandatoryDimension.findMany({
    where: {
      companyId,
      chartOfAccountId: { in: chartOfAccountIds },
    },
    select: {
      chartOfAccountId: true,
      dimensionTypeId: true,
      dimensionType: { select: { code: true, name: true } },
    },
  });

  const result = new Map<
    string,
    Array<{ dimensionTypeId: string; dimensionTypeName: string; dimensionTypeCode: string }>
  >();
  for (const rec of records) {
    if (!result.has(rec.chartOfAccountId)) {
      result.set(rec.chartOfAccountId, []);
    }
    result.get(rec.chartOfAccountId)!.push({
      dimensionTypeId: rec.dimensionTypeId,
      dimensionTypeName: rec.dimensionType.name,
      dimensionTypeCode: rec.dimensionType.code,
    });
  }
  return result;
}
