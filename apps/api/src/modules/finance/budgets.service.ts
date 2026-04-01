import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type {
  CreateBudgetInput,
  UpdateBudgetInput,
  ListBudgetsQuery,
  SearchBudgetsQuery,
} from './budgets.schema.js';
import { AppError, DomainError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Period field names — used for iteration
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
// Prisma select shapes — only return API-contract-defined fields
// ---------------------------------------------------------------------------

const LINE_SELECT = {
  id: true,
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
  createdAt: true,
  updatedAt: true,
} as const;

const LIST_SELECT = {
  id: true,
  name: true,
  fiscalYear: true,
  budgetType: true,
  status: true,
  description: true,
  approvedAt: true,
  approvedBy: true,
  originalBudgetId: true,
  budgetVersionId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  _count: { select: { lines: true } },
} as const;

const DETAIL_SELECT = {
  id: true,
  name: true,
  fiscalYear: true,
  budgetType: true,
  status: true,
  description: true,
  approvedAt: true,
  approvedBy: true,
  originalBudgetId: true,
  budgetVersionId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  lines: { select: LINE_SELECT, orderBy: { accountCode: 'asc' as const } },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal fields to numbers for JSON serialisation */
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/** Compute the total from 12 period amounts */
function computeTotal(line: Record<string, unknown>): number {
  let total = 0;
  for (const field of PERIOD_FIELDS) {
    total += toNumber(line[field] as Prisma.Decimal);
  }
  return total;
}

/** Normalise a budget line row — convert all Decimal fields to numbers */
function normaliseLine(row: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...row };
  for (const field of PERIOD_FIELDS) {
    result[field] = toNumber(row[field] as Prisma.Decimal);
  }
  result.totalAmount = toNumber(row.totalAmount as Prisma.Decimal);
  return result;
}

/** Normalise a budget row with its lines */
function normaliseBudgetDetail(row: Record<string, unknown>) {
  const lines = (row.lines as Array<Record<string, unknown>>) ?? [];
  return {
    ...row,
    lines: lines.map(normaliseLine),
  };
}

/** Assert the budget is in DRAFT status; throw if not */
function assertDraft(status: string): void {
  if (status !== 'DRAFT') {
    throw new DomainError('BUDGET_NOT_DRAFT', 'Only DRAFT budgets can be modified');
  }
}

// ---------------------------------------------------------------------------
// listBudgets (AC-1)
// ---------------------------------------------------------------------------

export async function listBudgets(
  prisma: PrismaClient,
  companyId: string,
  query: ListBudgetsQuery,
) {
  const { cursor, limit, status, fiscalYear, budgetType, budgetVersionId } = query;

  const where: Record<string, unknown> = { companyId };
  if (status !== undefined) where.status = status;
  if (fiscalYear !== undefined) where.fiscalYear = fiscalYear;
  if (budgetType !== undefined) where.budgetType = budgetType;
  if (budgetVersionId !== undefined) where.budgetVersionId = budgetVersionId;

  const [items, total] = await Promise.all([
    prisma.budget.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ fiscalYear: 'desc' }, { name: 'asc' }],
      select: LIST_SELECT,
    }),
    prisma.budget.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data, meta };
}

// ---------------------------------------------------------------------------
// getBudgetById (AC-2)
// ---------------------------------------------------------------------------

export async function getBudgetById(prisma: PrismaClient, companyId: string, id: string) {
  const budget = await prisma.budget.findFirst({
    where: { id, companyId },
    select: DETAIL_SELECT,
  });

  if (!budget) {
    throw new NotFoundError('NOT_FOUND', 'Budget not found');
  }

  return normaliseBudgetDetail(budget as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// createBudget (AC-3)
// ---------------------------------------------------------------------------

export async function createBudget(
  prisma: PrismaClient,
  companyId: string,
  data: CreateBudgetInput,
  userId: string,
) {
  // Validate all account codes exist
  const accountCodes = data.lines.map((l) => l.accountCode);
  const uniqueCodes = [...new Set(accountCodes)];

  // Check for duplicate account codes in input
  if (uniqueCodes.length !== accountCodes.length) {
    throw new AppError(
      'DUPLICATE_ACCOUNT_CODE',
      'Budget lines contain duplicate account codes',
      400,
    );
  }

  const existingAccounts = await prisma.chartOfAccount.findMany({
    where: { companyId, code: { in: uniqueCodes } },
    select: { code: true },
  });

  const existingCodes = new Set(existingAccounts.map((a) => a.code));
  const missingCodes = uniqueCodes.filter((c) => !existingCodes.has(c));
  if (missingCodes.length > 0) {
    throw new AppError(
      'INVALID_ACCOUNT_CODE',
      `Account codes do not exist: ${missingCodes.join(', ')}`,
      400,
    );
  }

  const budget = await prisma.budget.create({
    data: {
      companyId,
      name: data.name,
      fiscalYear: data.fiscalYear,
      budgetType: data.budgetType,
      description: data.description ?? null,
      budgetVersionId: data.budgetVersionId ?? null,
      createdBy: userId,
      updatedBy: userId,
      lines: {
        create: data.lines.map((line) => {
          const totalAmount = computeTotal(line as unknown as Record<string, unknown>);
          return {
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
            totalAmount,
          };
        }),
      },
    },
    select: DETAIL_SELECT,
  });

  return normaliseBudgetDetail(budget as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// updateBudget (AC-4) — only DRAFT budgets
// ---------------------------------------------------------------------------

export async function updateBudget(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  data: UpdateBudgetInput,
  userId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.budget.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundError('NOT_FOUND', 'Budget not found');
    }

    assertDraft(existing.status);

    // If lines are provided, validate account codes
    if (data.lines) {
      const accountCodes = data.lines.map((l) => l.accountCode);
      const uniqueCodes = [...new Set(accountCodes)];

      if (uniqueCodes.length !== accountCodes.length) {
        throw new AppError(
          'DUPLICATE_ACCOUNT_CODE',
          'Budget lines contain duplicate account codes',
          400,
        );
      }

      const existingAccounts = await tx.chartOfAccount.findMany({
        where: { companyId, code: { in: uniqueCodes } },
        select: { code: true },
      });

      const existingCodes = new Set(existingAccounts.map((a) => a.code));
      const missingCodes = uniqueCodes.filter((c) => !existingCodes.has(c));
      if (missingCodes.length > 0) {
        throw new AppError(
          'INVALID_ACCOUNT_CODE',
          `Account codes do not exist: ${missingCodes.join(', ')}`,
          400,
        );
      }

      // Replace all lines: delete existing, create new
      await tx.budgetLine.deleteMany({ where: { budgetId: id } });

      for (const line of data.lines) {
        const totalAmount = computeTotal(line as unknown as Record<string, unknown>);
        await tx.budgetLine.create({
          data: {
            budgetId: id,
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
            totalAmount,
          },
        });
      }
    }

    const updated = await tx.budget.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        updatedBy: userId,
      },
      select: DETAIL_SELECT,
    });

    return updated;
  });

  return normaliseBudgetDetail(result as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// approveBudget (AC-5) — DRAFT → APPROVED
// ---------------------------------------------------------------------------

export async function approveBudget(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  userId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.budget.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundError('NOT_FOUND', 'Budget not found');
    }

    assertDraft(existing.status);

    const approved = await tx.budget.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: userId,
        updatedBy: userId,
      },
      select: DETAIL_SELECT,
    });

    return approved;
  });

  return normaliseBudgetDetail(result as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// copyBudget (AC-6) — BR-FIN-019: create revised budget linked to original
// ---------------------------------------------------------------------------

export async function copyBudget(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  userId: string,
  targetVersionId?: string,
) {
  const original = await prisma.budget.findFirst({
    where: { id, companyId },
    select: {
      ...DETAIL_SELECT,
      _count: { select: { lines: true } },
    },
  });

  if (!original) {
    throw new NotFoundError('NOT_FOUND', 'Budget not found');
  }

  const copy = await prisma.budget.create({
    data: {
      companyId,
      name: `${original.name} (Revised)`,
      fiscalYear: original.fiscalYear,
      budgetType: 'REVISED',
      description: original.description,
      originalBudgetId: original.id,
      budgetVersionId: targetVersionId ?? null,
      createdBy: userId,
      updatedBy: userId,
      lines: {
        create: original.lines.map((line) => ({
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
        })),
      },
    },
    select: DETAIL_SELECT,
  });

  return normaliseBudgetDetail(copy as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// searchBudgets (AC-7)
// ---------------------------------------------------------------------------

export async function searchBudgets(
  prisma: PrismaClient,
  companyId: string,
  query: SearchBudgetsQuery,
) {
  const { search, limit } = query;

  const where: Record<string, unknown> = {
    companyId,
    name: { contains: search, mode: 'insensitive' },
  };

  const items = await prisma.budget.findMany({
    where,
    take: limit,
    orderBy: [{ fiscalYear: 'desc' }, { name: 'asc' }],
    select: LIST_SELECT,
  });

  return items;
}
