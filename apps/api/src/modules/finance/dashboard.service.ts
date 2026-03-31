import type { PrismaClient } from '@nexa/db';

import type { DashboardQuery, DashboardResponse, DashboardAlert } from './dashboard.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundToFourDecimals(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/**
 * Derive the current fiscal year based on today's date.
 *
 * If fiscalYearStartMonth is January (1), fiscal year == calendar year.
 * If fiscalYearStartMonth is e.g. April (4), fiscal year starts in April —
 * so Jan–Mar belong to the *prior* fiscal year.
 */
function deriveCurrentFiscalYear(fiscalYearStartMonth: number): number {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-based
  const currentYear = now.getFullYear();

  if (fiscalYearStartMonth === 1) return currentYear;

  // If current month is before the fiscal year start month,
  // we're still in the fiscal year that started last calendar year.
  return currentMonth < fiscalYearStartMonth ? currentYear - 1 : currentYear;
}

// ---------------------------------------------------------------------------
// Main dashboard service
// ---------------------------------------------------------------------------

export async function getDashboard(
  prisma: PrismaClient,
  companyId: string,
  query: DashboardQuery,
): Promise<DashboardResponse> {
  // Determine fiscal year: from query, or derive from settings + current date
  let fiscalYear: number;

  if (query.fiscalYear) {
    fiscalYear = query.fiscalYear;
  } else {
    // Look up the company's fiscal year start month from settings
    const startMonthSetting = await (prisma as any).systemSetting.findFirst({
      where: {
        companyId,
        key: 'general.fiscalYearStartMonth',
      },
      select: { value: true },
    });

    const fiscalYearStartMonth = startMonthSetting ? Number(startMonthSetting.value) : 1;
    fiscalYear = deriveCurrentFiscalYear(fiscalYearStartMonth);
  }

  // Run all queries in parallel for performance
  const [
    bankAccounts,
    periods,
    draftJournalCount,
    unmatchedBankTxCount,
    revenueAgg,
    expenseAgg,
    vatReturns,
  ] = await Promise.all([
    // 1. Bank accounts — cash position
    (prisma as any).bankAccount.findMany({
      where: { companyId, isActive: true },
      select: { name: true, currentBalance: true },
      orderBy: { name: 'asc' },
    }),

    // 2. Financial periods for this fiscal year
    (prisma as any).financialPeriod.findMany({
      where: { companyId, fiscalYear },
      select: { id: true, periodNumber: true, status: true },
    }),

    // 3. Draft journals count (across all periods in this fiscal year)
    (prisma as any).journalEntry.count({
      where: {
        companyId,
        status: 'DRAFT',
        period: { fiscalYear },
      },
    }),

    // 4. Unmatched bank transactions count
    (prisma as any).bankTransaction.count({
      where: {
        companyId,
        isMatched: false,
      },
    }),

    // 5. Revenue aggregation (POSTED journals, P&L revenue accounts)
    (prisma as any).journalLine.groupBy({
      by: ['companyId'],
      where: {
        companyId,
        journalEntry: {
          companyId,
          status: 'POSTED',
          period: { companyId, fiscalYear },
        },
        account: {
          companyId,
          classification: { reportSection: 'PROFIT_AND_LOSS', code: 'REV' },
        },
      },
      _sum: { debit: true, credit: true },
    }),

    // 6. Expense aggregation (POSTED journals, P&L expense accounts — COGS + OPEX)
    (prisma as any).journalLine.groupBy({
      by: ['companyId'],
      where: {
        companyId,
        journalEntry: {
          companyId,
          status: 'POSTED',
          period: { companyId, fiscalYear },
        },
        account: {
          companyId,
          classification: {
            reportSection: 'PROFIT_AND_LOSS',
            code: { in: ['COGS', 'OPEX', 'FIN', 'TAX'] },
          },
        },
      },
      _sum: { debit: true, credit: true },
    }),

    // 7. VAT returns for this fiscal year
    (prisma as any).vatReturn.findMany({
      where: {
        companyId,
        periodStart: { gte: new Date(`${fiscalYear}-01-01`) },
        periodEnd: { lte: new Date(`${fiscalYear}-12-31`) },
      },
      select: { periodStart: true, periodEnd: true, status: true },
    }),
  ]);

  // ---------------------------------------------------------------------------
  // Cash Position
  // ---------------------------------------------------------------------------

  const bankAccountBalances = bankAccounts.map((ba: { name: string; currentBalance: unknown }) => ({
    name: ba.name,
    balance: roundToFourDecimals(toNumber(ba.currentBalance)),
  }));

  const totalBankBalance = roundToFourDecimals(
    bankAccountBalances.reduce((sum: number, ba: { balance: number }) => sum + ba.balance, 0),
  );

  // ---------------------------------------------------------------------------
  // P&L Summary
  // ---------------------------------------------------------------------------

  // Revenue accounts are CREDIT-normal: balance = credits - debits
  const revRow = revenueAgg[0];
  const totalRevenue = revRow
    ? roundToFourDecimals(toNumber(revRow._sum.credit) - toNumber(revRow._sum.debit))
    : 0;

  // Expense accounts are DEBIT-normal: balance = debits - credits
  const expRow = expenseAgg[0];
  const totalExpenses = expRow
    ? roundToFourDecimals(toNumber(expRow._sum.debit) - toNumber(expRow._sum.credit))
    : 0;

  const netProfit = roundToFourDecimals(totalRevenue - totalExpenses);

  // ---------------------------------------------------------------------------
  // Activity
  // ---------------------------------------------------------------------------

  const openPeriods = periods.filter((p: { status: string }) => p.status === 'OPEN').length;
  const closedPeriods = periods.filter(
    (p: { status: string }) => p.status === 'CLOSED' || p.status === 'LOCKED',
  ).length;

  // ---------------------------------------------------------------------------
  // Alerts
  // ---------------------------------------------------------------------------

  const alerts: DashboardAlert[] = [];

  // Alert: unmatched bank transactions
  if (unmatchedBankTxCount > 0) {
    alerts.push({
      type: 'unmatched_transactions',
      message: `${unmatchedBankTxCount} unreconciled bank transaction${unmatchedBankTxCount === 1 ? '' : 's'}`,
      severity: unmatchedBankTxCount > 10 ? 'warning' : 'info',
    });
  }

  // Alert: open periods that might need closing
  const openPeriodNumbers = periods
    .filter((p: { status: string }) => p.status === 'OPEN')
    .map((p: { periodNumber: number }) => p.periodNumber);

  // If there are periods before the current month that are still open, warn
  const currentMonth = new Date().getMonth() + 1;
  const overdueOpenPeriods = openPeriodNumbers.filter((pn: number) => pn < currentMonth);

  for (const periodNum of overdueOpenPeriods) {
    alerts.push({
      type: 'period_open',
      message: `Period ${periodNum} still open`,
      severity: 'warning',
    });
  }

  // Alert: draft journals pending approval
  if (draftJournalCount > 0) {
    alerts.push({
      type: 'draft_journals',
      message: `${draftJournalCount} draft journal${draftJournalCount === 1 ? '' : 's'} pending`,
      severity: 'info',
    });
  }

  // Alert: missing VAT returns for completed quarters
  const completedQuarters = getCompletedQuartersInYear(fiscalYear);
  const submittedQuarters = new Set(
    vatReturns
      .filter((vr: { status: string }) => ['SUBMITTED', 'ACCEPTED'].includes(vr.status))
      .map((vr: { periodStart: Date }) => getQuarterFromDate(vr.periodStart)),
  );

  for (const quarter of completedQuarters) {
    if (!submittedQuarters.has(quarter)) {
      alerts.push({
        type: 'vat_return_missing',
        message: `No VAT return for Q${quarter}`,
        severity: 'warning',
      });
    }
  }

  return {
    fiscalYear,
    cashPosition: {
      totalBankBalance,
      bankAccounts: bankAccountBalances,
    },
    profitAndLoss: {
      totalRevenue,
      totalExpenses,
      netProfit,
    },
    activity: {
      draftJournals: draftJournalCount,
      unmatchedBankTransactions: unmatchedBankTxCount,
      openPeriods,
      closedPeriods,
    },
    alerts,
  };
}

// ---------------------------------------------------------------------------
// Quarter helpers
// ---------------------------------------------------------------------------

/**
 * Returns array of quarter numbers (1-4) that have been completed
 * relative to today's date for the given calendar year.
 */
function getCompletedQuartersInYear(fiscalYear: number): number[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const quarters: number[] = [];

  // Q1 ends March 31, Q2 ends June 30, Q3 ends September 30, Q4 ends December 31
  const quarterEndMonths = [3, 6, 9, 12];

  for (let q = 0; q < quarterEndMonths.length; q++) {
    const endMonth = quarterEndMonths[q]!;
    // Quarter is completed if we're past the end month in the same year,
    // or the fiscal year is in the past
    if (fiscalYear < currentYear || (fiscalYear === currentYear && currentMonth > endMonth)) {
      quarters.push(q + 1);
    }
  }

  return quarters;
}

/**
 * Returns the quarter number (1-4) for a given date.
 */
function getQuarterFromDate(date: Date): number {
  const month = new Date(date).getMonth() + 1;
  return Math.ceil(month / 3);
}
