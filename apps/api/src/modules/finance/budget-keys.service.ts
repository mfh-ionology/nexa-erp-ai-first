import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type {
  CreateBudgetKeyInput,
  UpdateBudgetKeyInput,
  ListBudgetKeysQuery,
} from './budget-keys.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PCT_FIELDS = [
  'pct1',
  'pct2',
  'pct3',
  'pct4',
  'pct5',
  'pct6',
  'pct7',
  'pct8',
  'pct9',
  'pct10',
  'pct11',
  'pct12',
] as const;

// ---------------------------------------------------------------------------
// Prisma select shape
// ---------------------------------------------------------------------------

const ITEM_SELECT = {
  id: true,
  name: true,
  pct1: true,
  pct2: true,
  pct3: true,
  pct4: true,
  pct5: true,
  pct6: true,
  pct7: true,
  pct8: true,
  pct9: true,
  pct10: true,
  pct11: true,
  pct12: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal fields to numbers for JSON serialisation */
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/** Normalise a budget key row — convert all Decimal pct fields to numbers */
function normaliseKey(row: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...row };
  for (const field of PCT_FIELDS) {
    result[field] = toNumber(row[field] as Prisma.Decimal);
  }
  return result;
}

// ---------------------------------------------------------------------------
// listBudgetKeys
// ---------------------------------------------------------------------------

export async function listBudgetKeys(
  prisma: PrismaClient,
  companyId: string,
  query: ListBudgetKeysQuery,
) {
  const { cursor, limit, isActive } = query;

  const where: Record<string, unknown> = { companyId };
  if (isActive !== undefined) where.isActive = isActive;

  const [items, total] = await Promise.all([
    prisma.budgetKey.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { name: 'asc' },
      select: ITEM_SELECT,
    }),
    prisma.budgetKey.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return {
    data: data.map((row) => normaliseKey(row as unknown as Record<string, unknown>)),
    meta,
  };
}

// ---------------------------------------------------------------------------
// getBudgetKeyById
// ---------------------------------------------------------------------------

export async function getBudgetKeyById(prisma: PrismaClient, companyId: string, id: string) {
  const key = await prisma.budgetKey.findFirst({
    where: { id, companyId },
    select: ITEM_SELECT,
  });

  if (!key) {
    throw new NotFoundError('NOT_FOUND', 'Budget key not found');
  }

  return normaliseKey(key as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// createBudgetKey
// ---------------------------------------------------------------------------

export async function createBudgetKey(
  prisma: PrismaClient,
  companyId: string,
  data: CreateBudgetKeyInput,
  userId: string,
) {
  try {
    const key = await prisma.budgetKey.create({
      data: {
        companyId,
        name: data.name,
        pct1: data.pct1,
        pct2: data.pct2,
        pct3: data.pct3,
        pct4: data.pct4,
        pct5: data.pct5,
        pct6: data.pct6,
        pct7: data.pct7,
        pct8: data.pct8,
        pct9: data.pct9,
        pct10: data.pct10,
        pct11: data.pct11,
        pct12: data.pct12,
        createdBy: userId,
      },
      select: ITEM_SELECT,
    });

    return normaliseKey(key as unknown as Record<string, unknown>);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(
        'DUPLICATE_BUDGET_KEY_NAME',
        'A budget key with this name already exists for this company',
        409,
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// updateBudgetKey
// ---------------------------------------------------------------------------

export async function updateBudgetKey(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  data: UpdateBudgetKeyInput,
  userId: string,
) {
  const existing = await prisma.budgetKey.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Budget key not found');
  }

  // If any pct field is being updated, require all 12 and validate sum
  const hasPctUpdate = PCT_FIELDS.some((f) => (data as Record<string, unknown>)[f] !== undefined);

  if (hasPctUpdate) {
    const allPresent = PCT_FIELDS.every((f) => (data as Record<string, unknown>)[f] !== undefined);
    if (!allPresent) {
      throw new AppError(
        'INCOMPLETE_PCT_UPDATE',
        'When updating percentages, all 12 period percentages must be provided',
        400,
      );
    }

    // Validate sum = 100
    let sum = 0;
    for (const f of PCT_FIELDS) {
      sum += (data as Record<string, number>)[f];
    }
    if (Math.abs(sum - 100) >= 0.01) {
      throw new AppError('PCT_SUM_INVALID', 'Percentages must sum to 100', 400);
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  for (const f of PCT_FIELDS) {
    const val = (data as Record<string, unknown>)[f];
    if (val !== undefined) updateData[f] = val;
  }

  try {
    const updated = await prisma.budgetKey.update({
      where: { id },
      data: updateData,
      select: ITEM_SELECT,
    });

    return normaliseKey(updated as unknown as Record<string, unknown>);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(
        'DUPLICATE_BUDGET_KEY_NAME',
        'A budget key with this name already exists for this company',
        409,
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// deleteBudgetKey
// ---------------------------------------------------------------------------

export async function deleteBudgetKey(prisma: PrismaClient, companyId: string, id: string) {
  const existing = await prisma.budgetKey.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Budget key not found');
  }

  await prisma.budgetKey.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// applyBudgetKey — pure calculation, nothing is saved
// ---------------------------------------------------------------------------

export async function applyBudgetKey(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  annualAmount: number,
) {
  const key = await prisma.budgetKey.findFirst({
    where: { id, companyId },
    select: ITEM_SELECT,
  });

  if (!key) {
    throw new NotFoundError('NOT_FOUND', 'Budget key not found');
  }

  const pctValues = PCT_FIELDS.map((f) =>
    toNumber((key as unknown as Record<string, Prisma.Decimal>)[f]),
  );

  // Compute period1..11 using percentage; period12 absorbs rounding
  const periods: number[] = [];
  let runningTotal = 0;

  for (let i = 0; i < 11; i++) {
    const amount = Math.round(((annualAmount * pctValues[i]) / 100) * 100) / 100;
    periods.push(amount);
    runningTotal += amount;
  }

  // Period 12 absorbs rounding
  const period12 = Math.round((annualAmount - runningTotal) * 100) / 100;
  periods.push(period12);

  return {
    period1: periods[0],
    period2: periods[1],
    period3: periods[2],
    period4: periods[3],
    period5: periods[4],
    period6: periods[5],
    period7: periods[6],
    period8: periods[7],
    period9: periods[8],
    period10: periods[9],
    period11: periods[10],
    period12: periods[11],
  };
}
