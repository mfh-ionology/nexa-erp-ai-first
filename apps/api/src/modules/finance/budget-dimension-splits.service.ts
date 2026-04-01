import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type { PutDimensionSplitsInput, ListSplitsQuery } from './budget-dimension-splits.schema.js';
import { AppError, DomainError, NotFoundError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIOD_FIELDS = [
  'period1',
  'period2',
  'period3',
  'period4',
  'period5',
  'period6',
  'period7',
  'period8',
  'period9',
  'period10',
  'period11',
  'period12',
] as const;

// ---------------------------------------------------------------------------
// Prisma select shape
// ---------------------------------------------------------------------------

const SPLIT_SELECT = {
  id: true,
  budgetLineId: true,
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
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal fields to numbers for JSON serialisation */
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/** Normalise a split row — convert all Decimal fields to numbers */
function normaliseSplit(row: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...row };
  for (const field of PERIOD_FIELDS) {
    result[field] = toNumber(row[field] as Prisma.Decimal);
  }
  result.totalAmount = toNumber(row.totalAmount as Prisma.Decimal);
  return result;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

async function validateBudgetOwnership(tx: PrismaClient, companyId: string, budgetId: string) {
  const budget = await tx.budget.findFirst({
    where: { id: budgetId, companyId },
    select: { id: true, status: true },
  });

  if (!budget) {
    throw new NotFoundError('NOT_FOUND', 'Budget not found');
  }

  return budget;
}

async function validateBudgetLine(tx: PrismaClient, budgetId: string, lineId: string) {
  const line = await tx.budgetLine.findFirst({
    where: { id: lineId, budgetId },
    select: {
      id: true,
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
    },
  });

  if (!line) {
    throw new NotFoundError('NOT_FOUND', 'Budget line not found');
  }

  return line;
}

function assertDraft(status: string): void {
  if (status !== 'DRAFT') {
    throw new DomainError('BUDGET_NOT_DRAFT', 'Only DRAFT budgets can be modified');
  }
}

// ---------------------------------------------------------------------------
// listDimensionSplits
// ---------------------------------------------------------------------------

export async function listDimensionSplits(
  prisma: PrismaClient,
  companyId: string,
  budgetId: string,
  lineId: string,
  query: ListSplitsQuery,
) {
  // Validate budget and line
  await validateBudgetOwnership(prisma, companyId, budgetId);
  await validateBudgetLine(prisma, budgetId, lineId);

  const where: Record<string, unknown> = { budgetLineId: lineId };
  if (query.dimensionTypeId !== undefined) {
    where.dimensionTypeId = query.dimensionTypeId;
  }

  const splits = await prisma.budgetLineDimension.findMany({
    where,
    orderBy: { dimensionTypeId: 'asc' },
    select: SPLIT_SELECT,
  });

  return splits.map((s) => normaliseSplit(s as unknown as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// putDimensionSplits — idempotent: replaces all splits for line + dim type
// ---------------------------------------------------------------------------

export async function putDimensionSplits(
  prisma: PrismaClient,
  companyId: string,
  budgetId: string,
  lineId: string,
  data: PutDimensionSplitsInput,
) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Validate budget ownership and DRAFT status
    const budget = await validateBudgetOwnership(
      tx as unknown as PrismaClient,
      companyId,
      budgetId,
    );
    assertDraft(budget.status);

    // 2. Validate budget line
    const line = await validateBudgetLine(tx as unknown as PrismaClient, budgetId, lineId);

    // 3. Validate dimension type exists for this company
    const dimType = await (tx as unknown as PrismaClient).dimensionType.findFirst({
      where: { id: data.dimensionTypeId, companyId },
      select: { id: true },
    });
    if (!dimType) {
      throw new NotFoundError('NOT_FOUND', 'Dimension type not found');
    }

    // 4. Validate all dimension value IDs exist and belong to the dimension type
    const valueIds = data.splits.map((s) => s.dimensionValueId);
    const existingValues = await (tx as unknown as PrismaClient).dimensionValue.findMany({
      where: {
        id: { in: valueIds },
        dimensionTypeId: data.dimensionTypeId,
      },
      select: { id: true },
    });

    const existingValueIds = new Set(existingValues.map((v) => v.id));
    const missingValues = valueIds.filter((id) => !existingValueIds.has(id));
    if (missingValues.length > 0) {
      throw new AppError(
        'INVALID_DIMENSION_VALUE',
        `Dimension values do not exist or do not belong to the given dimension type: ${missingValues.join(', ')}`,
        400,
      );
    }

    // 5. Period sum validation: split totals must match parent line
    for (const field of PERIOD_FIELDS) {
      const lineAmount = toNumber((line as unknown as Record<string, Prisma.Decimal>)[field]);
      let splitSum = 0;
      for (const split of data.splits) {
        splitSum += (split as unknown as Record<string, number>)[field] ?? 0;
      }

      if (Math.abs(splitSum - lineAmount) >= 0.01) {
        throw new AppError(
          'SPLIT_SUM_MISMATCH',
          `Dimension split totals for ${field} (${splitSum}) do not match parent line amount (${lineAmount})`,
          400,
        );
      }
    }

    // 6. Delete existing splits for this line + dimension type
    await (tx as unknown as PrismaClient).budgetLineDimension.deleteMany({
      where: {
        budgetLineId: lineId,
        dimensionTypeId: data.dimensionTypeId,
      },
    });

    // 7. Create new splits
    const created = [];
    for (const split of data.splits) {
      let totalAmount = 0;
      for (const field of PERIOD_FIELDS) {
        totalAmount += (split as unknown as Record<string, number>)[field] ?? 0;
      }

      const record = await (tx as unknown as PrismaClient).budgetLineDimension.create({
        data: {
          budgetLineId: lineId,
          dimensionTypeId: data.dimensionTypeId,
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
          totalAmount,
        },
        select: SPLIT_SELECT,
      });

      created.push(normaliseSplit(record as unknown as Record<string, unknown>));
    }

    return created;
  });

  return result;
}

// ---------------------------------------------------------------------------
// deleteDimensionSplits
// ---------------------------------------------------------------------------

export async function deleteDimensionSplits(
  prisma: PrismaClient,
  companyId: string,
  budgetId: string,
  lineId: string,
  dimensionTypeId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    // Validate budget ownership and DRAFT status
    const budget = await validateBudgetOwnership(
      tx as unknown as PrismaClient,
      companyId,
      budgetId,
    );
    assertDraft(budget.status);

    // Validate budget line
    await validateBudgetLine(tx as unknown as PrismaClient, budgetId, lineId);

    // Delete splits for this line + dimension type
    const deleted = await (tx as unknown as PrismaClient).budgetLineDimension.deleteMany({
      where: {
        budgetLineId: lineId,
        dimensionTypeId,
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundError(
        'NOT_FOUND',
        'No dimension splits found for this budget line and dimension type',
      );
    }
  });

  return result;
}
