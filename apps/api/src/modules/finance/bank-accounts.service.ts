import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type {
  CreateBankAccountInput,
  UpdateBankAccountInput,
  ListBankAccountsQuery,
  SearchBankAccountsQuery,
} from './bank-accounts.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Prisma select shapes — only return API-contract-defined fields
// ---------------------------------------------------------------------------

const LIST_SELECT = {
  id: true,
  name: true,
  sortCode: true,
  accountNumber: true,
  currencyCode: true,
  glAccountCode: true,
  currentBalance: true,
  lastReconciledDate: true,
  openBankingStatus: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  iban: true,
  swiftBic: true,
  openBankingProvider: true,
  openBankingConnId: true,
  openBankingLastSync: true,
  createdBy: true,
  updatedBy: true,
  glAccount: {
    select: {
      code: true,
      name: true,
      accountType: true,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal fields to numbers for JSON serialisation */
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/** Normalise a raw Prisma list item to the API shape */
function normaliseListItem(row: Record<string, unknown>) {
  return {
    ...row,
    currentBalance: toNumber(row.currentBalance as Prisma.Decimal),
  };
}

/** Normalise a raw Prisma detail row to the API shape */
function normaliseDetail(row: Record<string, unknown>) {
  return {
    ...normaliseListItem(row),
    glAccount: row.glAccount ?? null,
  };
}

// ---------------------------------------------------------------------------
// Validate GL account: must exist with isBankAccount=true
// ---------------------------------------------------------------------------

async function validateGlAccount(
  tx: PrismaClient | Pick<PrismaClient, 'chartOfAccount'>,
  companyId: string,
  glAccountCode: string,
): Promise<void> {
  const glAccount = await tx.chartOfAccount.findFirst({
    where: { companyId, code: glAccountCode },
    select: { id: true, isBankAccount: true },
  });

  if (!glAccount) {
    throw new AppError('INVALID_GL_ACCOUNT', 'GL account does not exist', 400);
  }

  if (!glAccount.isBankAccount) {
    throw new AppError(
      'GL_NOT_BANK_ACCOUNT',
      'GL account must have isBankAccount=true to be linked to a bank account',
      400,
    );
  }
}

// ---------------------------------------------------------------------------
// listBankAccounts (AC-1)
// ---------------------------------------------------------------------------

export async function listBankAccounts(
  prisma: PrismaClient,
  companyId: string,
  query: ListBankAccountsQuery,
) {
  const { cursor, limit, search, isActive, currencyCode, openBankingStatus } = query;

  const where: Record<string, unknown> = { companyId };
  if (isActive !== undefined) where.isActive = isActive;
  if (currencyCode !== undefined) where.currencyCode = currencyCode;
  if (openBankingStatus !== undefined) where.openBankingStatus = openBankingStatus;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sortCode: { contains: search, mode: 'insensitive' } },
      { accountNumber: { contains: search, mode: 'insensitive' } },
      { glAccountCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.bankAccount.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { name: 'asc' },
      select: LIST_SELECT,
    }),
    prisma.bankAccount.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const mapped = data.map((row) => normaliseListItem(row as unknown as Record<string, unknown>));

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data: mapped, meta };
}

// ---------------------------------------------------------------------------
// getBankAccountById (AC-1)
// ---------------------------------------------------------------------------

export async function getBankAccountById(prisma: PrismaClient, companyId: string, id: string) {
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id, companyId },
    select: DETAIL_SELECT,
  });

  if (!bankAccount) {
    throw new NotFoundError('NOT_FOUND', 'Bank account not found');
  }

  return normaliseDetail(bankAccount as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// createBankAccount (AC-1)
// ---------------------------------------------------------------------------

export async function createBankAccount(
  prisma: PrismaClient,
  companyId: string,
  data: CreateBankAccountInput,
  userId: string,
) {
  // Validate GL account exists and has isBankAccount=true
  await validateGlAccount(prisma, companyId, data.glAccountCode);

  try {
    const bankAccount = await prisma.bankAccount.create({
      data: {
        companyId,
        name: data.name,
        sortCode: data.sortCode ?? null,
        accountNumber: data.accountNumber ?? null,
        iban: data.iban ?? null,
        swiftBic: data.swiftBic ?? null,
        currencyCode: data.currencyCode,
        glAccountCode: data.glAccountCode,
        isActive: data.isActive,
        createdBy: userId,
        updatedBy: userId,
      },
      select: DETAIL_SELECT,
    });

    return normaliseDetail(bankAccount as unknown as Record<string, unknown>);
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError(
        'DUPLICATE_GL_ACCOUNT',
        'A bank account already exists for this GL account code in this company',
        409,
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// updateBankAccount (AC-1)
// ---------------------------------------------------------------------------

export async function updateBankAccount(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  data: UpdateBankAccountInput,
  userId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.bankAccount.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError('NOT_FOUND', 'Bank account not found');
    }

    // If glAccountCode is being changed, validate the new GL account
    if (data.glAccountCode !== undefined) {
      await validateGlAccount(tx, companyId, data.glAccountCode);
    }

    try {
      const updated = await tx.bankAccount.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.sortCode !== undefined && { sortCode: data.sortCode }),
          ...(data.accountNumber !== undefined && { accountNumber: data.accountNumber }),
          ...(data.iban !== undefined && { iban: data.iban }),
          ...(data.swiftBic !== undefined && { swiftBic: data.swiftBic }),
          ...(data.currencyCode !== undefined && { currencyCode: data.currencyCode }),
          ...(data.glAccountCode !== undefined && { glAccountCode: data.glAccountCode }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          updatedBy: userId,
        },
        select: DETAIL_SELECT,
      });

      return updated;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new AppError(
          'DUPLICATE_GL_ACCOUNT',
          'A bank account already exists for this GL account code in this company',
          409,
        );
      }
      throw error;
    }
  });

  return normaliseDetail(result as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// searchBankAccounts (AC-1)
// ---------------------------------------------------------------------------

export async function searchBankAccounts(
  prisma: PrismaClient,
  companyId: string,
  query: SearchBankAccountsQuery,
) {
  const { search, isActive, limit } = query;

  const where: Record<string, unknown> = {
    companyId,
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { sortCode: { contains: search, mode: 'insensitive' } },
      { accountNumber: { contains: search, mode: 'insensitive' } },
      { glAccountCode: { contains: search, mode: 'insensitive' } },
    ],
  };

  if (isActive !== undefined) where.isActive = isActive;

  const items = await prisma.bankAccount.findMany({
    where,
    take: limit,
    orderBy: { name: 'asc' },
    select: LIST_SELECT,
  });

  return items.map((row) => normaliseListItem(row as unknown as Record<string, unknown>));
}
