import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type { EventBus } from '../../core/events/event-bus.js';
import type { YearEndResult } from './year-end.schema.js';
import { AppError, DomainError, NotFoundError } from '../../core/errors/index.js';
import { createGlPosting } from './journals.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Prisma Decimal to a plain number. */
function toNumber(d: Prisma.Decimal | number | string): number {
  if (typeof d === 'number') return d;
  if (typeof d === 'string') return parseFloat(d);
  return (d as { toNumber(): number }).toNumber();
}

// ---------------------------------------------------------------------------
// Service: performYearEndClose
// ---------------------------------------------------------------------------

/**
 * Year-end close process for a fiscal year:
 *
 * 1. Validate all 12 regular periods (P1-P12) for the year are CLOSED (AC-5)
 * 2. Create P13 year-end adjustment period if it doesn't exist (AC-6)
 * 3. Calculate P&L account balances (Revenue + Expense types)
 * 4. Look up RETAINED_EARNINGS from AccountMapping
 * 5. Create a year-end journal entry (source=YEAR_END) via createGlPosting (AC-2, AC-3)
 *    - Debit each Revenue account for its credit balance (zeroing it)
 *    - Credit each Expense account for its debit balance (zeroing it)
 *    - Net difference goes to Retained Earnings
 * 6. Update ChartOfAccount.openingBalance for next year = current closing balance (AC-4)
 * 7. Lock all periods for the year (AC-7)
 */
export async function performYearEndClose(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  fiscalYear: number,
  userId: string,
): Promise<YearEndResult> {
  // -----------------------------------------------------------------------
  // Step 1: Validate all 12 regular periods are CLOSED (AC-5)
  // -----------------------------------------------------------------------

  const periods = await prisma.financialPeriod.findMany({
    where: { companyId, fiscalYear },
    orderBy: { periodNumber: 'asc' },
    select: {
      id: true,
      periodNumber: true,
      status: true,
      startDate: true,
      endDate: true,
      name: true,
    },
  });

  const regularPeriods = periods.filter((p) => p.periodNumber >= 1 && p.periodNumber <= 12);

  if (regularPeriods.length === 0) {
    throw new NotFoundError(
      'NO_PERIODS_FOUND',
      `No financial periods found for fiscal year ${String(fiscalYear)}`,
    );
  }

  if (regularPeriods.length < 12) {
    throw new DomainError(
      'INCOMPLETE_FISCAL_YEAR',
      `Fiscal year ${String(fiscalYear)} has only ${String(regularPeriods.length)} periods; all 12 are required`,
    );
  }

  const openPeriods = regularPeriods.filter((p) => p.status === 'OPEN');
  if (openPeriods.length > 0) {
    const names = openPeriods.map((p) => p.name).join(', ');
    throw new DomainError(
      'PERIODS_NOT_CLOSED',
      `All 12 periods must be CLOSED before year-end close. The following are still OPEN: ${names}`,
    );
  }

  // Also reject if already locked (year-end already done)
  const lockedPeriods = regularPeriods.filter((p) => p.status === 'LOCKED');
  if (lockedPeriods.length === 12) {
    throw new AppError(
      'YEAR_ALREADY_CLOSED',
      `Year-end close has already been performed for fiscal year ${String(fiscalYear)} — all periods are LOCKED`,
      409,
    );
  }

  // -----------------------------------------------------------------------
  // Step 2: Create P13 if it doesn't exist (AC-6)
  // -----------------------------------------------------------------------

  let p13 = periods.find((p) => p.periodNumber === 13);
  if (!p13) {
    const lastRegular = regularPeriods[regularPeriods.length - 1]!;
    const p13Name = `Year-End Adjustments ${String(fiscalYear)}`;

    const created = await prisma.financialPeriod.create({
      data: {
        companyId,
        name: p13Name,
        periodNumber: 13,
        fiscalYear,
        startDate: lastRegular.endDate,
        endDate: lastRegular.endDate,
        status: 'OPEN',
      },
      select: {
        id: true,
        periodNumber: true,
        status: true,
        startDate: true,
        endDate: true,
        name: true,
      },
    });
    p13 = created;
  } else if (p13.status !== 'OPEN') {
    // If P13 exists but is not OPEN, we need it OPEN to post
    throw new DomainError(
      'P13_NOT_OPEN',
      `Period 13 (${p13.name}) is ${p13.status}; it must be OPEN for year-end posting`,
    );
  }

  // -----------------------------------------------------------------------
  // Step 3: Calculate P&L account balances (AC-2)
  // -----------------------------------------------------------------------

  // Get all Revenue and Expense accounts for this company
  const plAccounts = await prisma.chartOfAccount.findMany({
    where: {
      companyId,
      accountType: { in: ['REVENUE', 'EXPENSE'] },
      isActive: true,
      isPostable: true,
    },
    select: {
      code: true,
      name: true,
      accountType: true,
      currentBalance: true,
      openingBalance: true,
    },
  });

  // Sum posted journal lines for the fiscal year periods (P1-P12) to get the year's P&L totals.
  // We query journalLines that belong to posted journals within the fiscal year periods.
  const periodIds = regularPeriods.map((p) => p.id);
  const plAccountCodes = plAccounts.map((a) => a.code);

  // Get aggregated debits and credits per account for the fiscal year
  type LineAgg = {
    accountCode: string;
    _sum: { debit: Prisma.Decimal | null; credit: Prisma.Decimal | null };
  };

  let lineAggregates: LineAgg[] = [];
  if (plAccountCodes.length > 0) {
    lineAggregates = (await prisma.journalLine.groupBy({
      by: ['accountCode'],
      where: {
        companyId,
        accountCode: { in: plAccountCodes },
        journalEntry: {
          companyId,
          periodId: { in: periodIds },
          status: 'POSTED',
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    })) as unknown as LineAgg[];
  }

  // Build a map: accountCode -> net balance for the year
  const balanceMap = new Map<string, { debit: number; credit: number; net: number }>();
  for (const agg of lineAggregates) {
    const debit = toNumber(agg._sum.debit ?? 0);
    const credit = toNumber(agg._sum.credit ?? 0);
    balanceMap.set(agg.accountCode, { debit, credit, net: debit - credit });
  }

  // -----------------------------------------------------------------------
  // Step 4: Look up RETAINED_EARNINGS from AccountMapping (AC-3)
  // -----------------------------------------------------------------------

  const retainedEarningsMapping = await prisma.accountMapping.findFirst({
    where: { companyId, mappingType: 'RETAINED_EARNINGS' },
    select: { accountCode: true },
  });

  if (!retainedEarningsMapping) {
    throw new DomainError(
      'RETAINED_EARNINGS_NOT_MAPPED',
      'Account mapping for RETAINED_EARNINGS is not configured. Set it via Account Mappings before performing year-end close.',
    );
  }

  const retainedEarningsCode = retainedEarningsMapping.accountCode;

  // Verify the retained earnings account exists and is postable
  const reAccount = await prisma.chartOfAccount.findFirst({
    where: { companyId, code: retainedEarningsCode },
    select: { code: true, isPostable: true, isActive: true },
  });

  if (!reAccount) {
    throw new DomainError(
      'RETAINED_EARNINGS_ACCOUNT_NOT_FOUND',
      `Retained Earnings account '${retainedEarningsCode}' does not exist in Chart of Accounts`,
    );
  }

  if (!reAccount.isPostable || !reAccount.isActive) {
    throw new DomainError(
      'RETAINED_EARNINGS_ACCOUNT_INVALID',
      `Retained Earnings account '${retainedEarningsCode}' is not postable or not active`,
    );
  }

  // -----------------------------------------------------------------------
  // Step 5: Create year-end journal entry (AC-2, AC-3)
  // -----------------------------------------------------------------------

  // Build journal lines to zero out P&L accounts:
  // - Revenue accounts (normal balance = CREDIT): debit them to zero
  // - Expense accounts (normal balance = DEBIT): credit them to zero
  // - Net goes to Retained Earnings

  const journalLines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
    description: string;
  }> = [];

  let totalRevenueCredit = 0; // Total credits on revenue accounts during the year
  let totalExpenseDebit = 0; // Total debits on expense accounts during the year

  for (const account of plAccounts) {
    const bal = balanceMap.get(account.code);
    if (!bal || (bal.debit === 0 && bal.credit === 0)) {
      continue; // No activity, skip
    }

    if (account.accountType === 'REVENUE') {
      // Revenue accounts normally have a credit balance (credit > debit).
      // Net balance = debit - credit (negative means credit balance).
      // To zero: debit the account by the net credit balance.
      const netCredit = bal.credit - bal.debit; // Positive = credit balance
      if (netCredit > 0) {
        journalLines.push({
          accountCode: account.code,
          debit: netCredit,
          credit: 0,
          description: `Year-end close: zero ${account.name}`,
        });
        totalRevenueCredit += netCredit;
      } else if (netCredit < 0) {
        // Revenue account has unusual debit balance — credit to zero
        journalLines.push({
          accountCode: account.code,
          debit: 0,
          credit: Math.abs(netCredit),
          description: `Year-end close: zero ${account.name}`,
        });
        totalRevenueCredit -= Math.abs(netCredit);
      }
    } else {
      // Expense accounts normally have a debit balance (debit > credit).
      // To zero: credit the account by the net debit balance.
      const netDebit = bal.debit - bal.credit; // Positive = debit balance
      if (netDebit > 0) {
        journalLines.push({
          accountCode: account.code,
          debit: 0,
          credit: netDebit,
          description: `Year-end close: zero ${account.name}`,
        });
        totalExpenseDebit += netDebit;
      } else if (netDebit < 0) {
        // Expense account has unusual credit balance — debit to zero
        journalLines.push({
          accountCode: account.code,
          debit: Math.abs(netDebit),
          credit: 0,
          description: `Year-end close: zero ${account.name}`,
        });
        totalExpenseDebit -= Math.abs(netDebit);
      }
    }
  }

  // Net profit/loss = Revenue (credits) - Expenses (debits)
  // Positive = profit, Negative = loss
  const netProfitLoss = totalRevenueCredit - totalExpenseDebit;

  // Retained Earnings line: balances the journal entry
  // If profit (positive): credit Retained Earnings (increases equity)
  // If loss (negative): debit Retained Earnings (decreases equity)
  if (netProfitLoss > 0) {
    journalLines.push({
      accountCode: retainedEarningsCode,
      debit: 0,
      credit: netProfitLoss,
      description: `Year-end close: net profit to Retained Earnings`,
    });
  } else if (netProfitLoss < 0) {
    journalLines.push({
      accountCode: retainedEarningsCode,
      debit: Math.abs(netProfitLoss),
      credit: 0,
      description: `Year-end close: net loss to Retained Earnings`,
    });
  }

  // If no P&L activity, still create a zero-value entry for audit trail
  if (journalLines.length === 0) {
    journalLines.push({
      accountCode: retainedEarningsCode,
      debit: 0,
      credit: 0,
      description: `Year-end close: no P&L activity for fiscal year ${String(fiscalYear)}`,
    });
  }

  // Post via the GL posting engine — uses the P13 period's date range
  const journalResult = await createGlPosting(
    prisma,
    eventBus,
    companyId,
    {
      transactionDate: p13.endDate,
      description: `Year-end close FY${String(fiscalYear)}`,
      reference: `YE-${String(fiscalYear)}`,
      source: 'YEAR_END',
      lines: journalLines,
    },
    userId,
  );

  // -----------------------------------------------------------------------
  // Step 6: Update opening balances for next year (AC-4)
  // Balance sheet accounts carry forward: next year opening = current closing.
  // P&L accounts: opening balance for next year = 0 (they've been zeroed).
  // -----------------------------------------------------------------------

  // Get ALL accounts for the company to update opening balances
  const allAccounts = await prisma.chartOfAccount.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      code: true,
      accountType: true,
      currentBalance: true,
    },
  });

  // Update opening balances in batch within a transaction
  await prisma.$transaction(async (tx) => {
    for (const account of allAccounts) {
      if (account.accountType === 'REVENUE' || account.accountType === 'EXPENSE') {
        // P&L accounts: opening balance = 0 for next year (they've been zeroed)
        await tx.chartOfAccount.update({
          where: { id: account.id },
          data: { openingBalance: 0 },
        });
      } else {
        // Balance sheet accounts: opening balance = current balance (carry forward)
        await tx.chartOfAccount.update({
          where: { id: account.id },
          data: { openingBalance: toNumber(account.currentBalance) },
        });
      }
    }
  });

  // -----------------------------------------------------------------------
  // Step 7: Lock all periods for the year (AC-7)
  // -----------------------------------------------------------------------

  const allPeriods = [...regularPeriods];
  if (p13) allPeriods.push(p13);

  // Close P13 first (it was OPEN for posting), then lock all
  let periodsLocked = 0;

  await prisma.$transaction(async (tx) => {
    for (const period of allPeriods) {
      const currentStatus = period.periodNumber === 13 && p13 ? 'OPEN' : period.status;

      if (currentStatus === 'OPEN') {
        // Close first, then lock
        await tx.financialPeriod.update({
          where: { id: period.id },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            closedBy: userId,
          },
        });
      }

      if (currentStatus !== 'LOCKED') {
        await tx.financialPeriod.update({
          where: { id: period.id },
          data: {
            status: 'LOCKED',
            lockedAt: new Date(),
            lockedBy: userId,
          },
        });
        periodsLocked++;
      }
    }
  });

  // -----------------------------------------------------------------------
  // Build result
  // -----------------------------------------------------------------------

  const now = new Date().toISOString();

  return {
    fiscalYear,
    journalEntryId: (journalResult as Record<string, unknown>).id as string,
    journalEntryNumber: (journalResult as Record<string, unknown>).entryNumber as string,
    p13PeriodId: p13.id,
    retainedEarningsAccountCode: retainedEarningsCode,
    netProfitLoss,
    lineCount: journalLines.length,
    periodsLocked,
    closedAt: now,
    closedBy: userId,
  };
}
