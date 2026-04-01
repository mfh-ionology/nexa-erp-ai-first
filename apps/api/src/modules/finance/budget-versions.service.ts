import type { PrismaClient } from '@nexa/db';
import type {
  CreateBudgetVersionInput,
  UpdateBudgetVersionInput,
  ListBudgetVersionsQuery,
} from './budget-versions.schema.js';
import { NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const LIST_SELECT = {
  id: true,
  fiscalYear: true,
  versionNumber: true,
  versionName: true,
  copiedFromVersionId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  _count: { select: { budgets: true } },
} as const;

const DETAIL_SELECT = {
  id: true,
  fiscalYear: true,
  versionNumber: true,
  versionName: true,
  copiedFromVersionId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  _count: { select: { budgets: true } },
  copiedFromVersion: {
    select: { id: true, versionName: true, versionNumber: true },
  },
} as const;

// ---------------------------------------------------------------------------
// listBudgetVersions
// ---------------------------------------------------------------------------

export async function listBudgetVersions(
  prisma: PrismaClient,
  companyId: string,
  query: ListBudgetVersionsQuery,
) {
  const { cursor, limit, fiscalYear } = query;

  const where: Record<string, unknown> = { companyId };
  if (fiscalYear !== undefined) where.fiscalYear = fiscalYear;

  const [items, total] = await Promise.all([
    prisma.budgetVersion.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ fiscalYear: 'desc' }, { versionNumber: 'asc' }],
      select: LIST_SELECT,
    }),
    prisma.budgetVersion.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data, meta };
}

// ---------------------------------------------------------------------------
// getBudgetVersionById
// ---------------------------------------------------------------------------

export async function getBudgetVersionById(prisma: PrismaClient, companyId: string, id: string) {
  const version = await prisma.budgetVersion.findFirst({
    where: { id, companyId },
    select: DETAIL_SELECT,
  });

  if (!version) {
    throw new NotFoundError('NOT_FOUND', 'Budget version not found');
  }

  return version;
}

// ---------------------------------------------------------------------------
// createBudgetVersion
// ---------------------------------------------------------------------------

export async function createBudgetVersion(
  prisma: PrismaClient,
  companyId: string,
  data: CreateBudgetVersionInput,
  userId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    // Auto-assign versionNumber: max for this company + fiscal year + 1
    const maxResult = await tx.budgetVersion.findFirst({
      where: { companyId, fiscalYear: data.fiscalYear },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const nextVersionNumber = (maxResult?.versionNumber ?? 0) + 1;

    // If copyFromVersionId is provided, validate it exists
    if (data.copyFromVersionId) {
      const sourceVersion = await tx.budgetVersion.findFirst({
        where: { id: data.copyFromVersionId, companyId },
        select: { id: true },
      });
      if (!sourceVersion) {
        throw new NotFoundError('NOT_FOUND', 'Source budget version not found');
      }
    }

    // Create the version record
    const version = await tx.budgetVersion.create({
      data: {
        companyId,
        fiscalYear: data.fiscalYear,
        versionNumber: nextVersionNumber,
        versionName: data.versionName,
        copiedFromVersionId: data.copyFromVersionId ?? null,
        createdBy: userId,
      },
      select: { id: true },
    });

    // If copying, replicate all budgets + lines + dimension splits
    if (data.copyFromVersionId) {
      const sourceBudgets = await tx.budget.findMany({
        where: { budgetVersionId: data.copyFromVersionId, companyId },
        select: {
          name: true,
          fiscalYear: true,
          budgetType: true,
          description: true,
          status: true,
          createdBy: true,
          updatedBy: true,
          lines: {
            select: {
              accountCode: true,
              period1: true,
              period2: true,
              period3: true,
              period4: true,
              period5: true,
              period6: true,
              period7: true,
              period8: true,
              period9: true,
              period10: true,
              period11: true,
              period12: true,
              totalAmount: true,
              dimensionSplits: {
                select: {
                  dimensionTypeId: true,
                  dimensionValueId: true,
                  period1: true,
                  period2: true,
                  period3: true,
                  period4: true,
                  period5: true,
                  period6: true,
                  period7: true,
                  period8: true,
                  period9: true,
                  period10: true,
                  period11: true,
                  period12: true,
                  totalAmount: true,
                },
              },
            },
          },
        },
      });

      for (const sourceBudget of sourceBudgets) {
        await tx.budget.create({
          data: {
            companyId,
            name: sourceBudget.name,
            fiscalYear: sourceBudget.fiscalYear,
            budgetType: sourceBudget.budgetType,
            description: sourceBudget.description,
            budgetVersionId: version.id,
            createdBy: userId,
            updatedBy: userId,
            lines: {
              create: sourceBudget.lines.map((line) => ({
                companyId,
                accountCode: line.accountCode,
                period1: line.period1,
                period2: line.period2,
                period3: line.period3,
                period4: line.period4,
                period5: line.period5,
                period6: line.period6,
                period7: line.period7,
                period8: line.period8,
                period9: line.period9,
                period10: line.period10,
                period11: line.period11,
                period12: line.period12,
                totalAmount: line.totalAmount,
                dimensionSplits: {
                  create: line.dimensionSplits.map((split) => ({
                    dimensionTypeId: split.dimensionTypeId,
                    dimensionValueId: split.dimensionValueId,
                    period1: split.period1,
                    period2: split.period2,
                    period3: split.period3,
                    period4: split.period4,
                    period5: split.period5,
                    period6: split.period6,
                    period7: split.period7,
                    period8: split.period8,
                    period9: split.period9,
                    period10: split.period10,
                    period11: split.period11,
                    period12: split.period12,
                    totalAmount: split.totalAmount,
                  })),
                },
              })),
            },
          },
        });
      }
    }

    // Return the full version detail
    return tx.budgetVersion.findFirst({
      where: { id: version.id },
      select: DETAIL_SELECT,
    });
  });

  return result;
}

// ---------------------------------------------------------------------------
// updateBudgetVersion
// ---------------------------------------------------------------------------

export async function updateBudgetVersion(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  data: UpdateBudgetVersionInput,
  _userId: string,
) {
  const existing = await prisma.budgetVersion.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Budget version not found');
  }

  const updated = await prisma.budgetVersion.update({
    where: { id },
    data: {
      ...(data.versionName !== undefined && { versionName: data.versionName }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    select: DETAIL_SELECT,
  });

  return updated;
}
