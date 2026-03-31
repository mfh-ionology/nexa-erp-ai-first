import type { PrismaClient } from '@nexa/db';

import type {
  TrialBalanceQuery,
  TrialBalanceResponse,
  ReportQuery,
  ReportAccountLine,
  ReportSection,
  ProfitAndLossResponse,
  BalanceSheetResponse,
} from './reports.schema.js';

// ---------------------------------------------------------------------------
// Trial Balance Report — AC-1 through AC-6
// ---------------------------------------------------------------------------

/**
 * Produces a trial balance report for a given fiscal year and period range.
 *
 * - Aggregates JournalLine debit/credit from POSTED entries only (AC-4)
 * - Groups by accountCode and merges with ChartOfAccount metadata (AC-3)
 * - Includes openingBalance from ChartOfAccount (AC-5)
 * - Computes closingBalance respecting normal balance direction (AC-3)
 * - Verifies total debits == total credits (AC-6)
 */
export async function getTrialBalance(
  prisma: PrismaClient,
  companyId: string,
  query: TrialBalanceQuery,
): Promise<TrialBalanceResponse> {
  const { fiscalYear, periodFrom, periodTo } = query;

  // 1. Find all periods in the fiscal year within the requested range
  const periods = await (prisma as any).financialPeriod.findMany({
    where: {
      companyId,
      fiscalYear,
      periodNumber: { gte: periodFrom, lte: periodTo },
    },
    select: { id: true },
  });

  const periodIds = periods.map((p: { id: string }) => p.id);

  // 2. Aggregate posted journal lines grouped by accountCode
  //    Only include POSTED entries (AC-4)
  let lineAggregations: Array<{
    accountCode: string;
    _sum: { debit: unknown; credit: unknown };
  }> = [];

  if (periodIds.length > 0) {
    lineAggregations = await (prisma as any).journalLine.groupBy({
      by: ['accountCode'],
      where: {
        companyId,
        journalEntry: {
          companyId,
          status: 'POSTED',
          periodId: { in: periodIds },
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });
  }

  // Build a lookup map: accountCode -> { totalDebit, totalCredit }
  const lineMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  for (const agg of lineAggregations) {
    lineMap.set(agg.accountCode, {
      totalDebit: Number(agg._sum.debit ?? 0),
      totalCredit: Number(agg._sum.credit ?? 0),
    });
  }

  // 3. Fetch all active accounts for the company
  const accounts = await (prisma as any).chartOfAccount.findMany({
    where: { companyId, isActive: true },
    orderBy: { code: 'asc' },
    select: {
      code: true,
      name: true,
      accountType: true,
      normalBalance: true,
      openingBalance: true,
    },
  });

  // 4. Build the trial balance rows
  //    Only include accounts that have an opening balance OR posted activity
  const trialBalanceAccounts = [];

  for (const account of accounts) {
    const openingBalance = Number(account.openingBalance ?? 0);
    const lineTotals = lineMap.get(account.code);
    const totalDebit = lineTotals?.totalDebit ?? 0;
    const totalCredit = lineTotals?.totalCredit ?? 0;

    // Skip accounts with no opening balance and no activity
    if (openingBalance === 0 && totalDebit === 0 && totalCredit === 0) {
      continue;
    }

    // AC-3: closingBalance respects normal balance direction
    // DEBIT accounts: opening + debits - credits
    // CREDIT accounts: opening + credits - debits
    const closingBalance =
      account.normalBalance === 'DEBIT'
        ? openingBalance + totalDebit - totalCredit
        : openingBalance + totalCredit - totalDebit;

    trialBalanceAccounts.push({
      accountCode: account.code,
      accountName: account.name,
      accountType: account.accountType,
      normalBalance: account.normalBalance,
      openingBalance: roundToFourDecimals(openingBalance),
      totalDebit: roundToFourDecimals(totalDebit),
      totalCredit: roundToFourDecimals(totalCredit),
      closingBalance: roundToFourDecimals(closingBalance),
    });
  }

  // 5. Compute totals (AC-6)
  let grandTotalDebit = 0;
  let grandTotalCredit = 0;
  for (const row of trialBalanceAccounts) {
    grandTotalDebit += row.totalDebit;
    grandTotalCredit += row.totalCredit;
  }
  grandTotalDebit = roundToFourDecimals(grandTotalDebit);
  grandTotalCredit = roundToFourDecimals(grandTotalCredit);

  // AC-6: The trial balance must balance (debits == credits)
  const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.0001;

  return {
    fiscalYear,
    periodFrom,
    periodTo,
    accounts: trialBalanceAccounts,
    totals: {
      totalDebit: grandTotalDebit,
      totalCredit: grandTotalCredit,
      isBalanced,
    },
  };
}

// ---------------------------------------------------------------------------
// Profit & Loss Report — S10 AC-1, AC-3, AC-4, AC-6
// ---------------------------------------------------------------------------

/** Classification codes for P&L sections (from AccountClassification.code) */
const PNL_CLASSIFICATIONS = [
  { code: 'REV', name: 'Revenue' },
  { code: 'COGS', name: 'Cost of Goods Sold' },
  { code: 'OPEX', name: 'Operating Expenses' },
  { code: 'OI', name: 'Other Income' },
  { code: 'FIN', name: 'Finance Costs' },
  { code: 'TAX', name: 'Taxation' },
] as const;

/**
 * Produces a Profit & Loss report grouped by AccountClassification.
 *
 * - Queries POSTED JournalLine entries within the period range (AC-6)
 * - Groups by accountCode, joins with ChartOfAccount + classification
 * - Groups accounts by classification, calculates section totals
 * - Computes: grossProfit, operatingProfit, profitBeforeTax, netProfit (AC-4)
 */
export async function getProfitAndLoss(
  prisma: PrismaClient,
  companyId: string,
  query: ReportQuery,
): Promise<ProfitAndLossResponse> {
  const { fiscalYear, periodFrom, periodTo } = query;

  // 1. Find periods in the requested range
  const periods = await (prisma as any).financialPeriod.findMany({
    where: {
      companyId,
      fiscalYear,
      periodNumber: { gte: periodFrom, lte: periodTo },
    },
    select: { id: true },
  });
  const periodIds = periods.map((p: { id: string }) => p.id);

  // 2. Aggregate posted journal lines grouped by accountCode
  let lineAggregations: Array<{
    accountCode: string;
    _sum: { debit: unknown; credit: unknown };
  }> = [];

  if (periodIds.length > 0) {
    lineAggregations = await (prisma as any).journalLine.groupBy({
      by: ['accountCode'],
      where: {
        companyId,
        journalEntry: {
          companyId,
          status: 'POSTED',
          periodId: { in: periodIds },
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });
  }

  const lineMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  for (const agg of lineAggregations) {
    lineMap.set(agg.accountCode, {
      totalDebit: Number(agg._sum.debit ?? 0),
      totalCredit: Number(agg._sum.credit ?? 0),
    });
  }

  // 3. Fetch P&L accounts (those with a classification whose reportSection is PROFIT_AND_LOSS)
  const accounts = await (prisma as any).chartOfAccount.findMany({
    where: {
      companyId,
      isActive: true,
      classification: {
        reportSection: 'PROFIT_AND_LOSS',
      },
    },
    orderBy: { code: 'asc' },
    select: {
      code: true,
      name: true,
      normalBalance: true,
      openingBalance: true,
      classification: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  // 4. Group accounts by classification code
  const accountsByClassification = new Map<string, ReportAccountLine[]>();
  for (const account of accounts) {
    const classCode = account.classification?.code;
    if (!classCode) continue;

    const openingBalance = Number(account.openingBalance ?? 0);
    const lineTotals = lineMap.get(account.code);
    const debits = lineTotals?.totalDebit ?? 0;
    const credits = lineTotals?.totalCredit ?? 0;

    // Skip accounts with no opening balance and no activity
    if (openingBalance === 0 && debits === 0 && credits === 0) continue;

    // Balance based on normal balance direction
    const balance =
      account.normalBalance === 'DEBIT'
        ? openingBalance + debits - credits
        : openingBalance + credits - debits;

    const line: ReportAccountLine = {
      accountCode: account.code,
      accountName: account.name,
      normalBalance: account.normalBalance,
      openingBalance: roundToFourDecimals(openingBalance),
      debits: roundToFourDecimals(debits),
      credits: roundToFourDecimals(credits),
      balance: roundToFourDecimals(balance),
    };

    const existing = accountsByClassification.get(classCode) ?? [];
    existing.push(line);
    accountsByClassification.set(classCode, existing);
  }

  // 5. Build sections in the defined order
  const sections: ReportSection[] = [];
  const sectionTotals = new Map<string, number>();

  for (const { code, name } of PNL_CLASSIFICATIONS) {
    const sectionAccounts = accountsByClassification.get(code) ?? [];
    const total = roundToFourDecimals(sectionAccounts.reduce((sum, a) => sum + a.balance, 0));
    sections.push({ classification: code, name, accounts: sectionAccounts, total });
    sectionTotals.set(code, total);
  }

  // 6. Calculate summary figures (AC-4)
  const revenue = sectionTotals.get('REV') ?? 0;
  const cogs = sectionTotals.get('COGS') ?? 0;
  const grossProfit = roundToFourDecimals(revenue - cogs);

  const operatingExpenses = sectionTotals.get('OPEX') ?? 0;
  const operatingProfit = roundToFourDecimals(grossProfit - operatingExpenses);

  const otherIncome = sectionTotals.get('OI') ?? 0;
  const financeCosts = sectionTotals.get('FIN') ?? 0;
  const profitBeforeTax = roundToFourDecimals(operatingProfit + otherIncome - financeCosts);

  const taxation = sectionTotals.get('TAX') ?? 0;
  const netProfit = roundToFourDecimals(profitBeforeTax - taxation);

  return {
    fiscalYear,
    periodFrom,
    periodTo,
    sections,
    grossProfit,
    operatingExpenses,
    operatingProfit,
    otherIncome,
    financeCosts,
    profitBeforeTax,
    taxation,
    netProfit,
  };
}

// ---------------------------------------------------------------------------
// Balance Sheet Report — S10 AC-2, AC-3, AC-5, AC-6
// ---------------------------------------------------------------------------

/** Classification codes for Balance Sheet sections */
const BS_CLASSIFICATIONS = [
  { code: 'FA', name: 'Fixed Assets' },
  { code: 'CA', name: 'Current Assets' },
  { code: 'CL', name: 'Current Liabilities' },
  { code: 'LTL', name: 'Long-Term Liabilities' },
  { code: 'EQ', name: 'Equity' },
] as const;

/**
 * Produces a Balance Sheet report grouped by AccountClassification.
 *
 * - Queries POSTED JournalLine entries within the period range (AC-6)
 * - Groups by accountCode, joins with ChartOfAccount + classification
 * - Groups accounts by classification, calculates section totals
 * - Verifies: Total Assets == Total Liabilities + Equity (AC-5)
 */
export async function getBalanceSheet(
  prisma: PrismaClient,
  companyId: string,
  query: ReportQuery,
): Promise<BalanceSheetResponse> {
  const { fiscalYear, periodFrom, periodTo } = query;

  // 1. Find periods in the requested range
  const periods = await (prisma as any).financialPeriod.findMany({
    where: {
      companyId,
      fiscalYear,
      periodNumber: { gte: periodFrom, lte: periodTo },
    },
    select: { id: true },
  });
  const periodIds = periods.map((p: { id: string }) => p.id);

  // 2. Aggregate posted journal lines grouped by accountCode
  let lineAggregations: Array<{
    accountCode: string;
    _sum: { debit: unknown; credit: unknown };
  }> = [];

  if (periodIds.length > 0) {
    lineAggregations = await (prisma as any).journalLine.groupBy({
      by: ['accountCode'],
      where: {
        companyId,
        journalEntry: {
          companyId,
          status: 'POSTED',
          periodId: { in: periodIds },
        },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });
  }

  const lineMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  for (const agg of lineAggregations) {
    lineMap.set(agg.accountCode, {
      totalDebit: Number(agg._sum.debit ?? 0),
      totalCredit: Number(agg._sum.credit ?? 0),
    });
  }

  // 3. Fetch Balance Sheet accounts (reportSection = BALANCE_SHEET)
  const accounts = await (prisma as any).chartOfAccount.findMany({
    where: {
      companyId,
      isActive: true,
      classification: {
        reportSection: 'BALANCE_SHEET',
      },
    },
    orderBy: { code: 'asc' },
    select: {
      code: true,
      name: true,
      normalBalance: true,
      openingBalance: true,
      classification: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  // 4. Group accounts by classification code
  const accountsByClassification = new Map<string, ReportAccountLine[]>();
  for (const account of accounts) {
    const classCode = account.classification?.code;
    if (!classCode) continue;

    const openingBalance = Number(account.openingBalance ?? 0);
    const lineTotals = lineMap.get(account.code);
    const debits = lineTotals?.totalDebit ?? 0;
    const credits = lineTotals?.totalCredit ?? 0;

    // Skip accounts with no opening balance and no activity
    if (openingBalance === 0 && debits === 0 && credits === 0) continue;

    // Balance based on normal balance direction
    const balance =
      account.normalBalance === 'DEBIT'
        ? openingBalance + debits - credits
        : openingBalance + credits - debits;

    const line: ReportAccountLine = {
      accountCode: account.code,
      accountName: account.name,
      normalBalance: account.normalBalance,
      openingBalance: roundToFourDecimals(openingBalance),
      debits: roundToFourDecimals(debits),
      credits: roundToFourDecimals(credits),
      balance: roundToFourDecimals(balance),
    };

    const existing = accountsByClassification.get(classCode) ?? [];
    existing.push(line);
    accountsByClassification.set(classCode, existing);
  }

  // 5. Build sections in the defined order
  const sections: ReportSection[] = [];
  const sectionTotals = new Map<string, number>();

  for (const { code, name } of BS_CLASSIFICATIONS) {
    const sectionAccounts = accountsByClassification.get(code) ?? [];
    const total = roundToFourDecimals(sectionAccounts.reduce((sum, a) => sum + a.balance, 0));
    sections.push({ classification: code, name, accounts: sectionAccounts, total });
    sectionTotals.set(code, total);
  }

  // 6. Calculate summary figures (AC-5)
  const totalAssets = roundToFourDecimals(
    (sectionTotals.get('FA') ?? 0) + (sectionTotals.get('CA') ?? 0),
  );
  const totalLiabilities = roundToFourDecimals(
    (sectionTotals.get('CL') ?? 0) + (sectionTotals.get('LTL') ?? 0),
  );
  const totalEquity = sectionTotals.get('EQ') ?? 0;

  // AC-5: Total Assets == Total Liabilities + Equity
  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.0001;

  return {
    fiscalYear,
    periodFrom,
    periodTo,
    sections,
    totalAssets,
    totalLiabilities,
    totalEquity,
    isBalanced,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roundToFourDecimals(value: number): number {
  return Math.round(value * 10000) / 10000;
}
