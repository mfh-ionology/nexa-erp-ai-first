import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type {
  CreateReconciliationInput,
  CreateMatchInput,
  ListReconciliationsQuery,
} from './bank-reconciliation.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal fields to numbers for JSON serialisation */
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function toNumberOrNull(val: Prisma.Decimal | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  return typeof val === 'number' ? val : Number(val);
}

/** Normalise reconciliation row for the API shape */
function normaliseReconciliation(row: Record<string, unknown>) {
  return {
    ...row,
    statementBalance: toNumber(row.statementBalance as Prisma.Decimal),
    glBalance: toNumberOrNull(row.glBalance as Prisma.Decimal | null),
    difference: toNumberOrNull(row.difference as Prisma.Decimal | null),
  };
}

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const LIST_SELECT = {
  id: true,
  bankAccountId: true,
  statementDate: true,
  statementBalance: true,
  glBalance: true,
  difference: true,
  status: true,
  completedAt: true,
  completedBy: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
} as const;

// ---------------------------------------------------------------------------
// createReconciliation (AC-1)
// ---------------------------------------------------------------------------

export async function createReconciliation(
  prisma: PrismaClient,
  companyId: string,
  bankAccountId: string,
  data: CreateReconciliationInput,
  userId: string,
) {
  // Validate bank account exists and belongs to company
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId },
    select: { id: true, glAccountCode: true },
  });

  if (!bankAccount) {
    throw new NotFoundError('NOT_FOUND', 'Bank account not found');
  }

  // Check no other IN_PROGRESS reconciliation exists for this bank account
  const existing = await prisma.bankReconciliation.findFirst({
    where: {
      companyId,
      bankAccountId,
      status: 'IN_PROGRESS',
    },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      'RECONCILIATION_IN_PROGRESS',
      'A reconciliation is already in progress for this bank account. Complete or abandon it first.',
      409,
    );
  }

  // Calculate GL balance: sum of journal lines for the bank account's GL account code
  const glBalanceResult = await prisma.journalLine.aggregate({
    where: {
      companyId,
      accountCode: bankAccount.glAccountCode,
    },
    _sum: {
      debit: true,
      credit: true,
    },
  });

  const totalDebit = toNumber(glBalanceResult._sum.debit);
  const totalCredit = toNumber(glBalanceResult._sum.credit);
  const glBalance = totalDebit - totalCredit;

  const statementBalance = data.statementBalance;
  const difference = statementBalance - glBalance;

  const reconciliation = await prisma.bankReconciliation.create({
    data: {
      companyId,
      bankAccountId,
      statementDate: data.statementDate,
      statementBalance: new Prisma.Decimal(statementBalance.toFixed(4)),
      glBalance: new Prisma.Decimal(glBalance.toFixed(4)),
      difference: new Prisma.Decimal(difference.toFixed(4)),
      status: 'IN_PROGRESS',
      createdBy: userId,
    },
    select: LIST_SELECT,
  });

  return normaliseReconciliation(reconciliation as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// getReconciliationById (AC-2)
// ---------------------------------------------------------------------------

export async function getReconciliationById(
  prisma: PrismaClient,
  companyId: string,
  bankAccountId: string,
  id: string,
) {
  const reconciliation = await prisma.bankReconciliation.findFirst({
    where: { id, companyId, bankAccountId },
    select: {
      ...LIST_SELECT,
      lines: {
        select: {
          matchId: true,
        },
      },
    },
  });

  if (!reconciliation) {
    throw new NotFoundError('NOT_FOUND', 'Reconciliation not found');
  }

  // Get matched transactions via reconciliation lines
  const matchIds = reconciliation.lines.map((l) => l.matchId);

  let matchedTransactions: Array<Record<string, unknown>> = [];
  if (matchIds.length > 0) {
    const matches = await prisma.bankTransactionMatch.findMany({
      where: {
        id: { in: matchIds },
        companyId,
      },
      select: {
        id: true,
        bankTransactionId: true,
        journalLineId: true,
        matchType: true,
        confidence: true,
        matchedAt: true,
        matchedBy: true,
        bankTransaction: {
          select: {
            id: true,
            transactionDate: true,
            description: true,
            amount: true,
            reference: true,
            type: true,
          },
        },
      },
    });

    matchedTransactions = matches.map((m) => ({
      matchId: m.id,
      bankTransactionId: m.bankTransactionId,
      journalLineId: m.journalLineId,
      matchType: m.matchType,
      confidence: toNumberOrNull(m.confidence as Prisma.Decimal | null),
      matchedAt: m.matchedAt,
      matchedBy: m.matchedBy,
      bankTransaction: {
        id: m.bankTransaction.id,
        transactionDate: m.bankTransaction.transactionDate,
        description: m.bankTransaction.description,
        amount: toNumber(m.bankTransaction.amount as unknown as Prisma.Decimal),
        reference: m.bankTransaction.reference,
        type: m.bankTransaction.type,
      },
    }));
  }

  // Get unmatched transactions for this bank account
  const unmatchedTransactions = await prisma.bankTransaction.findMany({
    where: {
      companyId,
      bankAccountId,
      isMatched: false,
    },
    select: {
      id: true,
      transactionDate: true,
      description: true,
      amount: true,
      reference: true,
      type: true,
      isMatched: true,
    },
    orderBy: { transactionDate: 'desc' },
  });

  const normalisedUnmatched = unmatchedTransactions.map((t) => ({
    ...t,
    amount: toNumber(t.amount as unknown as Prisma.Decimal),
  }));

  // Get the bank account's GL account code for journal line matching
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId },
    select: { glAccountCode: true },
  });

  // Get unmatched journal lines for the bank's GL account
  // These are POSTED journal lines on the bank GL account that haven't been matched
  let unmatchedJournalLines: Array<Record<string, unknown>> = [];
  if (bankAccount?.glAccountCode) {
    // Get all matched journal line IDs to exclude them
    const matchedLineIds = await prisma.bankTransactionMatch.findMany({
      where: { companyId },
      select: { journalLineId: true },
    });
    const excludeIds = matchedLineIds
      .map((m) => m.journalLineId)
      .filter((id): id is string => id !== null);

    const journalLines = await prisma.journalLine.findMany({
      where: {
        companyId,
        accountCode: bankAccount.glAccountCode,
        journalEntry: { status: 'POSTED' },
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
      },
      select: {
        id: true,
        lineNumber: true,
        accountCode: true,
        description: true,
        debit: true,
        credit: true,
        journalEntry: {
          select: {
            id: true,
            entryNumber: true,
            transactionDate: true,
            description: true,
          },
        },
      },
      orderBy: { journalEntry: { transactionDate: 'desc' } },
    });

    unmatchedJournalLines = journalLines.map((jl) => ({
      id: jl.id,
      lineNumber: jl.lineNumber,
      accountCode: jl.accountCode,
      description: jl.description ?? jl.journalEntry.description,
      debit: toNumber(jl.debit as unknown as Prisma.Decimal),
      credit: toNumber(jl.credit as unknown as Prisma.Decimal),
      transactionDate: jl.journalEntry.transactionDate,
      journalEntryId: jl.journalEntry.id,
      journalEntryNumber: jl.journalEntry.entryNumber,
      journalDescription: jl.journalEntry.description,
    }));
  }

  const { lines: _lines, ...reconData } = reconciliation;
  const normalised = normaliseReconciliation(reconData as unknown as Record<string, unknown>);

  return {
    ...normalised,
    matchedTransactions,
    unmatchedTransactions: normalisedUnmatched,
    unmatchedJournalLines,
  };
}

// ---------------------------------------------------------------------------
// listReconciliations (AC-6)
// ---------------------------------------------------------------------------

export async function listReconciliations(
  prisma: PrismaClient,
  companyId: string,
  bankAccountId: string,
  query: ListReconciliationsQuery,
) {
  const { cursor, limit, status } = query;

  // Validate bank account exists
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId },
    select: { id: true },
  });

  if (!bankAccount) {
    throw new NotFoundError('NOT_FOUND', 'Bank account not found');
  }

  const where: Record<string, unknown> = { companyId, bankAccountId };
  if (status !== undefined) where.status = status;

  const [items, total] = await Promise.all([
    prisma.bankReconciliation.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { statementDate: 'desc' },
      select: LIST_SELECT,
    }),
    prisma.bankReconciliation.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const mapped = data.map((row) =>
    normaliseReconciliation(row as unknown as Record<string, unknown>),
  );

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data: mapped, meta };
}

// ---------------------------------------------------------------------------
// createMatch (AC-3)
// ---------------------------------------------------------------------------

export async function createMatch(
  prisma: PrismaClient,
  companyId: string,
  bankAccountId: string,
  data: CreateMatchInput,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    // Validate bank account
    const bankAccount = await tx.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
      select: { id: true },
    });

    if (!bankAccount) {
      throw new NotFoundError('NOT_FOUND', 'Bank account not found');
    }

    // Validate bank transaction exists, belongs to this bank account, and is unmatched
    const bankTransaction = await tx.bankTransaction.findFirst({
      where: {
        id: data.bankTransactionId,
        companyId,
        bankAccountId,
      },
      select: { id: true, isMatched: true },
    });

    if (!bankTransaction) {
      throw new NotFoundError('BANK_TRANSACTION_NOT_FOUND', 'Bank transaction not found');
    }

    if (bankTransaction.isMatched) {
      throw new AppError('ALREADY_MATCHED', 'Bank transaction is already matched', 409);
    }

    // Validate journal line exists and belongs to company
    const journalLine = await tx.journalLine.findFirst({
      where: {
        id: data.journalLineId,
        companyId,
      },
      select: { id: true },
    });

    if (!journalLine) {
      throw new NotFoundError('JOURNAL_LINE_NOT_FOUND', 'Journal line not found');
    }

    // Create the match
    const match = await tx.bankTransactionMatch.create({
      data: {
        companyId,
        bankTransactionId: data.bankTransactionId,
        journalLineId: data.journalLineId,
        matchType: 'MANUAL',
        matchedBy: userId,
      },
      select: {
        id: true,
        bankTransactionId: true,
        journalLineId: true,
        matchType: true,
        confidence: true,
        matchedAt: true,
        matchedBy: true,
      },
    });

    // Update bank transaction as matched
    await tx.bankTransaction.update({
      where: { id: data.bankTransactionId },
      data: { isMatched: true },
    });

    // If there's an active reconciliation for this bank account, add the line
    const activeReconciliation = await tx.bankReconciliation.findFirst({
      where: {
        companyId,
        bankAccountId,
        status: 'IN_PROGRESS',
      },
      select: { id: true },
    });

    if (activeReconciliation) {
      await tx.bankReconciliationLine.create({
        data: {
          reconciliationId: activeReconciliation.id,
          matchId: match.id,
        },
      });

      // Recalculate reconciliation difference
      await recalculateReconciliationDifference(
        tx as unknown as PrismaClient,
        activeReconciliation.id,
      );
    }

    return {
      ...match,
      confidence: toNumberOrNull(match.confidence as Prisma.Decimal | null),
    };
  });
}

// ---------------------------------------------------------------------------
// unmatch (AC-4)
// ---------------------------------------------------------------------------

export async function unmatchTransaction(
  prisma: PrismaClient,
  companyId: string,
  bankTransactionId: string,
  _userId: string,
) {
  return prisma.$transaction(async (tx) => {
    // Validate bank transaction exists and belongs to company
    const bankTransaction = await tx.bankTransaction.findFirst({
      where: {
        id: bankTransactionId,
        companyId,
      },
      select: { id: true, isMatched: true, bankAccountId: true },
    });

    if (!bankTransaction) {
      throw new NotFoundError('NOT_FOUND', 'Bank transaction not found');
    }

    if (!bankTransaction.isMatched) {
      throw new AppError('NOT_MATCHED', 'Bank transaction is not matched', 400);
    }

    // Find and delete the match(es) for this bank transaction
    const matches = await tx.bankTransactionMatch.findMany({
      where: {
        bankTransactionId,
        companyId,
      },
      select: { id: true },
    });

    const matchIds = matches.map((m) => m.id);

    // Delete reconciliation lines referencing these matches
    if (matchIds.length > 0) {
      await tx.bankReconciliationLine.deleteMany({
        where: {
          matchId: { in: matchIds },
        },
      });
    }

    // Delete the matches
    await tx.bankTransactionMatch.deleteMany({
      where: {
        bankTransactionId,
        companyId,
      },
    });

    // Update bank transaction as unmatched
    await tx.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { isMatched: false },
    });

    // If there's an active reconciliation, recalculate difference
    const activeReconciliation = await tx.bankReconciliation.findFirst({
      where: {
        companyId,
        bankAccountId: bankTransaction.bankAccountId,
        status: 'IN_PROGRESS',
      },
      select: { id: true },
    });

    if (activeReconciliation) {
      await recalculateReconciliationDifference(
        tx as unknown as PrismaClient,
        activeReconciliation.id,
      );
    }

    return { success: true };
  });
}

// ---------------------------------------------------------------------------
// completeReconciliation (AC-5) — BR-FIN-009
// ---------------------------------------------------------------------------

export async function completeReconciliation(
  prisma: PrismaClient,
  companyId: string,
  bankAccountId: string,
  reconciliationId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const reconciliation = await tx.bankReconciliation.findFirst({
      where: {
        id: reconciliationId,
        companyId,
        bankAccountId,
      },
      select: {
        id: true,
        status: true,
        statementBalance: true,
        difference: true,
      },
    });

    if (!reconciliation) {
      throw new NotFoundError('NOT_FOUND', 'Reconciliation not found');
    }

    if (reconciliation.status !== 'IN_PROGRESS') {
      throw new AppError(
        'INVALID_STATUS',
        `Cannot complete reconciliation with status ${reconciliation.status}`,
        400,
      );
    }

    // Recalculate to get fresh difference
    await recalculateReconciliationDifference(tx as unknown as PrismaClient, reconciliation.id);

    // Re-fetch the reconciliation after recalculation
    const updated = await tx.bankReconciliation.findFirst({
      where: { id: reconciliation.id },
      select: { difference: true, statementBalance: true },
    });

    const difference = toNumber(updated?.difference as Prisma.Decimal | null);

    // BR-FIN-009: difference must be zero to complete
    if (Math.abs(difference) > 0.001) {
      throw new AppError(
        'RECONCILIATION_NOT_BALANCED',
        `Cannot complete reconciliation: difference is ${difference.toFixed(2)}. Must be zero.`,
        400,
      );
    }

    const now = new Date();

    // Update reconciliation status
    const completed = await tx.bankReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        completedBy: userId,
        difference: new Prisma.Decimal('0'),
      },
      select: LIST_SELECT,
    });

    // Update bank account lastReconciledDate
    await tx.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        lastReconciledDate: completed.statementDate,
      },
    });

    return normaliseReconciliation(completed as unknown as Record<string, unknown>);
  });
}

// ---------------------------------------------------------------------------
// Recalculate reconciliation difference
// ---------------------------------------------------------------------------

async function recalculateReconciliationDifference(tx: PrismaClient, reconciliationId: string) {
  const reconciliation = await tx.bankReconciliation.findFirst({
    where: { id: reconciliationId },
    select: {
      id: true,
      companyId: true,
      bankAccountId: true,
      statementBalance: true,
      lines: {
        select: {
          matchId: true,
        },
      },
    },
  });

  if (!reconciliation) return;

  // Get GL account code for this bank account
  const bankAccount = await tx.bankAccount.findFirst({
    where: { id: reconciliation.bankAccountId, companyId: reconciliation.companyId },
    select: { glAccountCode: true },
  });

  if (!bankAccount) return;

  // Recalculate GL balance from journal lines
  const glBalanceResult = await tx.journalLine.aggregate({
    where: {
      companyId: reconciliation.companyId,
      accountCode: bankAccount.glAccountCode,
    },
    _sum: {
      debit: true,
      credit: true,
    },
  });

  const totalDebit = toNumber(glBalanceResult._sum.debit);
  const totalCredit = toNumber(glBalanceResult._sum.credit);
  const glBalance = totalDebit - totalCredit;

  const statementBalance = toNumber(reconciliation.statementBalance as unknown as Prisma.Decimal);
  const difference = statementBalance - glBalance;

  await tx.bankReconciliation.update({
    where: { id: reconciliationId },
    data: {
      glBalance: new Prisma.Decimal(glBalance.toFixed(4)),
      difference: new Prisma.Decimal(difference.toFixed(4)),
    },
  });
}
