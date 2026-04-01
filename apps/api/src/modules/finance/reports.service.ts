import type { PrismaClient } from '@nexa/db';

import type {
  TrialBalanceQuery,
  TrialBalanceResponse,
  ReportQuery,
  ReportAccountLine,
  ReportSection,
  ProfitAndLossResponse,
  BalanceSheetResponse,
  TransactionJournalQuery,
  TransactionJournalResponse,
  BudgetVarianceQuery,
  BudgetVarianceResponse,
  GLDetailQuery,
  GLDetailResponse,
  GeneralLedgerQuery,
  GeneralLedgerResponse,
  DepartmentalPnlQuery,
  DepartmentalPnlResponse,
} from './reports.schema.js';

// ---------------------------------------------------------------------------
// Shared Helpers — Dimension Filtering + Simulation Aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregates journal lines by accountCode, optionally filtered by a dimension value.
 *
 * When dimensionValueId is provided, only lines linked to that dimension value
 * via JournalLineDimension are included.
 *
 * Falls back to the standard groupBy when no dimension filter is present.
 */
async function getDimensionFilteredAggregations(
  prisma: PrismaClient,
  companyId: string,
  periodIds: string[],
  dimensionValueId?: string,
): Promise<Map<string, { totalDebit: number; totalCredit: number }>> {
  const lineMap = new Map<string, { totalDebit: number; totalCredit: number }>();

  if (periodIds.length === 0) return lineMap;

  const where: Record<string, unknown> = {
    companyId,
    journalEntry: {
      companyId,
      status: 'POSTED',
      periodId: { in: periodIds },
    },
  };

  if (dimensionValueId) {
    where.dimensions = { some: { dimensionValueId } };
  }

  const lineAggregations: Array<{
    accountCode: string;
    _sum: { debit: unknown; credit: unknown };
  }> = await (prisma as any).journalLine.groupBy({
    by: ['accountCode'],
    where,
    _sum: { debit: true, credit: true },
  });

  for (const agg of lineAggregations) {
    lineMap.set(agg.accountCode, {
      totalDebit: Number(agg._sum.debit ?? 0),
      totalCredit: Number(agg._sum.credit ?? 0),
    });
  }

  return lineMap;
}

/**
 * Aggregates simulation lines by accountCode for ACTIVE simulations in the given periods.
 * Used when includeSimulations=true on reports.
 */
async function getSimulationLineAggregations(
  prisma: PrismaClient,
  companyId: string,
  periodIds: string[],
  _dimensionValueId?: string,
): Promise<Map<string, { totalDebit: number; totalCredit: number }>> {
  const lineMap = new Map<string, { totalDebit: number; totalCredit: number }>();

  if (periodIds.length === 0) return lineMap;

  const simLineAgg: Array<{
    accountCode: string;
    _sum: { debit: unknown; credit: unknown };
  }> = await (prisma as any).simulationLine.groupBy({
    by: ['accountCode'],
    where: {
      companyId,
      simulation: {
        companyId,
        status: 'ACTIVE',
        periodId: { in: periodIds },
      },
    },
    _sum: { debit: true, credit: true },
  });

  for (const agg of simLineAgg) {
    lineMap.set(agg.accountCode, {
      totalDebit: Number(agg._sum.debit ?? 0),
      totalCredit: Number(agg._sum.credit ?? 0),
    });
  }

  return lineMap;
}

/**
 * Fetches individual simulation lines for a single account (used by GL Detail).
 */
async function getSimulationLinesForAccount(
  prisma: PrismaClient,
  companyId: string,
  periodIds: string[],
  accountCode: string,
  _dimensionValueId?: string,
): Promise<GLDetailResponse['entries']> {
  if (periodIds.length === 0) return [];

  const simLines = await (prisma as any).simulationLine.findMany({
    where: {
      companyId,
      accountCode,
      simulation: {
        companyId,
        status: 'ACTIVE',
        periodId: { in: periodIds },
      },
    },
    include: {
      simulation: {
        select: {
          id: true,
          entryNumber: true,
          transactionDate: true,
          description: true,
          reference: true,
        },
      },
    },
    orderBy: { simulation: { transactionDate: 'asc' } },
  });

  return simLines.map(
    (line: {
      simulation: {
        id: string;
        entryNumber: string;
        transactionDate: Date | string;
        description: string;
        reference: string | null;
      };
      debit: unknown;
      credit: unknown;
      dimensionValues: unknown;
    }) => {
      const txDate =
        line.simulation.transactionDate instanceof Date
          ? line.simulation.transactionDate.toISOString().split('T')[0]
          : String(line.simulation.transactionDate);

      // Parse dimension values from JSON
      const dimVals = Array.isArray(line.dimensionValues) ? line.dimensionValues : [];

      return {
        journalEntryId: line.simulation.id,
        entryNumber: line.simulation.entryNumber,
        transactionDate: txDate,
        description: line.simulation.description,
        reference: line.simulation.reference,
        source: 'SIMULATION',
        debit: roundToFourDecimals(Number(line.debit ?? 0)),
        credit: roundToFourDecimals(Number(line.credit ?? 0)),
        runningBalance: 0, // Will be recomputed by caller
        isSimulation: true,
        dimensions: dimVals.map(
          (dv: { dimensionTypeName?: string; dimensionValueName?: string }) => ({
            dimensionTypeName: dv.dimensionTypeName ?? '',
            dimensionValueName: dv.dimensionValueName ?? '',
          }),
        ),
      };
    },
  );
}

/**
 * Merges simulation line aggregations into the journal line aggregation map.
 * Adds simulation amounts on top of existing journal amounts for each account.
 */
function mergeSimulationAggregations(
  journalMap: Map<string, { totalDebit: number; totalCredit: number }>,
  simulationMap: Map<string, { totalDebit: number; totalCredit: number }>,
): void {
  for (const [accountCode, simTotals] of simulationMap) {
    const existing = journalMap.get(accountCode) ?? { totalDebit: 0, totalCredit: 0 };
    journalMap.set(accountCode, {
      totalDebit: existing.totalDebit + simTotals.totalDebit,
      totalCredit: existing.totalCredit + simTotals.totalCredit,
    });
  }
}

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
 * - Optionally filters by dimension value
 * - Optionally includes simulation lines from ACTIVE simulations
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
  //    Optionally filtered by dimension value
  const lineMap = await getDimensionFilteredAggregations(
    prisma,
    companyId,
    periodIds,
    query.dimensionValueId,
  );

  // 2b. Optionally merge simulation data
  if (query.includeSimulations) {
    const simMap = await getSimulationLineAggregations(
      prisma,
      companyId,
      periodIds,
      query.dimensionValueId,
    );
    mergeSimulationAggregations(lineMap, simMap);
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
 * - Optionally filters by dimension value
 * - Optionally includes simulation lines from ACTIVE simulations
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
  const lineMap = await getDimensionFilteredAggregations(
    prisma,
    companyId,
    periodIds,
    query.dimensionValueId,
  );

  // 2b. Optionally merge simulation data
  if (query.includeSimulations) {
    const simMap = await getSimulationLineAggregations(
      prisma,
      companyId,
      periodIds,
      query.dimensionValueId,
    );
    mergeSimulationAggregations(lineMap, simMap);
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
 * - Optionally filters by dimension value
 * - Optionally includes simulation lines from ACTIVE simulations
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
  const lineMap = await getDimensionFilteredAggregations(
    prisma,
    companyId,
    periodIds,
    query.dimensionValueId,
  );

  // 2b. Optionally merge simulation data
  if (query.includeSimulations) {
    const simMap = await getSimulationLineAggregations(
      prisma,
      companyId,
      periodIds,
      query.dimensionValueId,
    );
    mergeSimulationAggregations(lineMap, simMap);
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

  // Determine the expected normal balance direction for each BS section.
  // Asset sections (FA, CA) expect DEBIT; Liability (CL, LTL) and Equity (EQ) expect CREDIT.
  const ASSET_SECTIONS = new Set(['FA', 'CA']);
  const CREDIT_SECTIONS = new Set(['CL', 'LTL', 'EQ']);

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
    let balance =
      account.normalBalance === 'DEBIT'
        ? openingBalance + debits - credits
        : openingBalance + credits - debits;

    // BUG-1 FIX: Contra-asset / contra-liability handling.
    // If an account's normalBalance doesn't match its section's expected direction,
    // flip the sign so it subtracts from the section total.
    // e.g. Accumulated Depreciation (normalBalance=CREDIT) in Fixed Assets (expects DEBIT)
    //      should appear as negative, subtracting from the section total.
    const isContraAsset = ASSET_SECTIONS.has(classCode) && account.normalBalance === 'CREDIT';
    const isContraLiability = CREDIT_SECTIONS.has(classCode) && account.normalBalance === 'DEBIT';
    if (isContraAsset || isContraLiability) {
      balance = -balance;
    }

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

  // BUG-2 FIX: Calculate current-period net P&L and include in equity.
  // The Balance Sheet equation requires Assets = Liabilities + Equity, but P&L accounts
  // (Revenue, Expenses) are excluded from the BS. Their net effect must appear in Equity.
  const currentPeriodPnl = await calculatePeriodNetPnl(
    prisma,
    companyId,
    periodIds,
    query.dimensionValueId,
    query.includeSimulations,
  );
  if (Math.abs(currentPeriodPnl) >= 0.0001) {
    // Add a synthetic line to the Equity section
    const pnlLine: ReportAccountLine = {
      accountCode: 'PNL',
      accountName: 'Current Period Profit/Loss',
      normalBalance: 'CREDIT',
      openingBalance: 0,
      debits: 0,
      credits: 0,
      balance: roundToFourDecimals(currentPeriodPnl),
    };
    const eqSection = sections.find((s) => s.classification === 'EQ');
    if (eqSection) {
      eqSection.accounts.push(pnlLine);
      eqSection.total = roundToFourDecimals(eqSection.total + currentPeriodPnl);
      sectionTotals.set('EQ', eqSection.total);
    }
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
// Transaction Journal Report
// ---------------------------------------------------------------------------

/**
 * Returns all posted journal entries with their lines for a given period range.
 *
 * - Filters by fiscal year, period range, optional accountCode, optional source
 * - Optionally filters by dimension value
 * - Returns entries ordered by transactionDate ascending
 * - Each entry includes its nested journal lines
 */
export async function getTransactionJournal(
  prisma: PrismaClient,
  companyId: string,
  query: TransactionJournalQuery,
): Promise<TransactionJournalResponse> {
  const { fiscalYear, periodFrom, periodTo, accountCode, source } = query;

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

  if (periodIds.length === 0) {
    return {
      fiscalYear,
      periodFrom,
      periodTo,
      totalEntries: 0,
      entries: [],
    };
  }

  // 2. Build the where clause for journal entries
  const entryWhere: Record<string, unknown> = {
    companyId,
    status: 'POSTED',
    periodId: { in: periodIds },
  };

  if (source) {
    entryWhere.source = source;
  }

  // Build the lines.some filter combining accountCode + dimensionValueId
  if (accountCode || query.dimensionValueId) {
    const someConditions: Record<string, unknown> = {};
    if (accountCode) {
      someConditions.accountCode = accountCode;
    }
    if (query.dimensionValueId) {
      someConditions.dimensions = { some: { dimensionValueId: query.dimensionValueId } };
    }
    entryWhere.lines = { some: someConditions };
  }

  // 3. Fetch journal entries with lines
  const journalEntries = await (prisma as any).journalEntry.findMany({
    where: entryWhere,
    orderBy: { transactionDate: 'asc' },
    include: {
      lines: {
        orderBy: { lineNumber: 'asc' },
        include: {
          account: {
            select: { name: true },
          },
          dimensions: {
            include: {
              dimensionValue: {
                select: {
                  name: true,
                  dimensionType: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // 4. Map to response shape
  const entries = journalEntries.map(
    (entry: {
      id: string;
      entryNumber: string;
      transactionDate: Date;
      description: string;
      reference: string | null;
      source: string;
      status: string;
      totalDebit: unknown;
      totalCredit: unknown;
      lines: Array<{
        lineNumber: number;
        accountCode: string;
        description: string | null;
        debit: unknown;
        credit: unknown;
        account: { name: string };
      }>;
    }) => ({
      id: entry.id,
      entryNumber: entry.entryNumber,
      transactionDate:
        entry.transactionDate instanceof Date
          ? entry.transactionDate.toISOString().split('T')[0]
          : String(entry.transactionDate),
      description: entry.description,
      reference: entry.reference,
      source: entry.source,
      status: entry.status,
      totalDebit: roundToFourDecimals(Number(entry.totalDebit ?? 0)),
      totalCredit: roundToFourDecimals(Number(entry.totalCredit ?? 0)),
      lines: entry.lines.map((line) => ({
        lineNumber: line.lineNumber,
        accountCode: line.accountCode,
        accountName: line.account?.name ?? line.accountCode,
        description: line.description,
        debit: roundToFourDecimals(Number(line.debit ?? 0)),
        credit: roundToFourDecimals(Number(line.credit ?? 0)),
      })),
    }),
  );

  return {
    fiscalYear,
    periodFrom,
    periodTo,
    totalEntries: entries.length,
    entries,
  };
}

// ---------------------------------------------------------------------------
// Budget Variance Report
// ---------------------------------------------------------------------------

/**
 * Compares budget amounts to actual posted journal amounts per account.
 *
 * - If budgetId is provided, uses that budget; otherwise uses the latest
 *   APPROVED budget for the fiscal year.
 * - Optionally selects budgets by budgetVersionId
 * - Optionally filters actuals by dimension value
 * - Optionally includes simulation data in actuals
 * - For each account in the budget: budgetAmount, actualAmount, variance,
 *   variancePercentage.
 * - Summary: total budget, total actual, total variance.
 */
export async function getBudgetVariance(
  prisma: PrismaClient,
  companyId: string,
  query: BudgetVarianceQuery,
): Promise<BudgetVarianceResponse> {
  const { fiscalYear, budgetId } = query;

  // 1. Find the budget
  let budget: {
    id: string;
    name: string;
    fiscalYear: number;
    lines: Array<{
      accountCode: string;
      period1: unknown;
      period2: unknown;
      period3: unknown;
      period4: unknown;
      period5: unknown;
      period6: unknown;
      period7: unknown;
      period8: unknown;
      period9: unknown;
      period10: unknown;
      period11: unknown;
      period12: unknown;
      totalAmount: unknown;
      account: { name: string };
    }>;
  } | null;

  if (budgetId) {
    budget = await (prisma as any).budget.findFirst({
      where: { id: budgetId, companyId },
      include: {
        lines: {
          orderBy: { accountCode: 'asc' },
          include: {
            account: { select: { name: true } },
          },
        },
      },
    });
  } else if (query.budgetVersionId) {
    // Find all budgets in this version for the fiscal year and aggregate
    const budgets = await (prisma as any).budget.findMany({
      where: { companyId, fiscalYear, budgetVersionId: query.budgetVersionId },
      include: {
        lines: {
          orderBy: { accountCode: 'asc' },
          include: {
            account: { select: { name: true } },
          },
        },
      },
    });
    if (budgets.length > 0) {
      // Aggregate lines across all budgets in the version
      const aggregatedLines = new Map<string, { totalAmount: number; accountName: string }>();
      for (const b of budgets) {
        for (const line of b.lines) {
          const existing = aggregatedLines.get(line.accountCode);
          const lineTotal = Number(line.totalAmount ?? 0);
          if (existing) {
            existing.totalAmount += lineTotal;
          } else {
            aggregatedLines.set(line.accountCode, {
              totalAmount: lineTotal,
              accountName: line.account?.name ?? line.accountCode,
            });
          }
        }
      }
      // Use the first budget's metadata
      budget = {
        id: budgets[0].id,
        name: budgets[0].name,
        fiscalYear: budgets[0].fiscalYear,
        lines: Array.from(aggregatedLines.entries()).map(([accountCode, data]) => ({
          accountCode,
          period1: 0,
          period2: 0,
          period3: 0,
          period4: 0,
          period5: 0,
          period6: 0,
          period7: 0,
          period8: 0,
          period9: 0,
          period10: 0,
          period11: 0,
          period12: 0,
          totalAmount: data.totalAmount,
          account: { name: data.accountName },
        })),
      };
    } else {
      budget = null;
    }
  } else {
    // Use latest approved budget for the fiscal year
    budget = await (prisma as any).budget.findFirst({
      where: { companyId, fiscalYear, status: 'APPROVED' },
      orderBy: { approvedAt: 'desc' },
      include: {
        lines: {
          orderBy: { accountCode: 'asc' },
          include: {
            account: { select: { name: true } },
          },
        },
      },
    });
  }

  if (!budget) {
    const errorMessage = budgetId
      ? `Budget with id ${budgetId} not found`
      : query.budgetVersionId
        ? `No budgets found for version ${query.budgetVersionId} in fiscal year ${fiscalYear}`
        : `No approved budget found for fiscal year ${fiscalYear}`;
    const error = new Error(errorMessage) as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  // 2. Get all periods for the fiscal year (all 12 periods for full-year comparison)
  const periods = await (prisma as any).financialPeriod.findMany({
    where: {
      companyId,
      fiscalYear,
      periodNumber: { gte: 1, lte: 12 },
    },
    select: { id: true },
  });
  const periodIds = periods.map((p: { id: string }) => p.id);

  // 3. Aggregate posted journal lines by accountCode
  //    Optionally filtered by dimension value
  const actualMap = new Map<string, number>();

  const lineMap = await getDimensionFilteredAggregations(
    prisma,
    companyId,
    periodIds,
    query.dimensionValueId,
  );

  // Optionally merge simulation data
  if (query.includeSimulations) {
    const simMap = await getSimulationLineAggregations(
      prisma,
      companyId,
      periodIds,
      query.dimensionValueId,
    );
    mergeSimulationAggregations(lineMap, simMap);
  }

  for (const [accountCode, totals] of lineMap) {
    // Net actual = debit - credit (positive for expense accounts, negative for revenue)
    actualMap.set(accountCode, totals.totalDebit - totals.totalCredit);
  }

  // 4. Build the variance lines from budget lines
  let totalBudget = 0;
  let totalActual = 0;

  const budgetAccounts = budget.lines.map((line) => {
    const budgetAmount = roundToFourDecimals(Number(line.totalAmount ?? 0));
    const actualAmount = roundToFourDecimals(actualMap.get(line.accountCode) ?? 0);
    const variance = roundToFourDecimals(budgetAmount - actualAmount);
    const variancePercentage =
      budgetAmount !== 0 ? roundToFourDecimals((variance / budgetAmount) * 100) : null;

    totalBudget += budgetAmount;
    totalActual += actualAmount;

    return {
      accountCode: line.accountCode,
      accountName: line.account?.name ?? line.accountCode,
      budgetAmount,
      actualAmount,
      variance,
      variancePercentage,
    };
  });

  totalBudget = roundToFourDecimals(totalBudget);
  totalActual = roundToFourDecimals(totalActual);
  const totalVariance = roundToFourDecimals(totalBudget - totalActual);

  return {
    fiscalYear,
    budgetId: budget.id,
    budgetName: budget.name,
    accounts: budgetAccounts,
    summary: {
      totalBudget,
      totalActual,
      totalVariance,
    },
  };
}

// ---------------------------------------------------------------------------
// GL Detail / Account Activity Report
// ---------------------------------------------------------------------------

/**
 * GL Detail / Account Activity -- all postings for a single account with running balance.
 *
 * - Fetches individual JournalLine records (not aggregated) for the given account
 * - Includes dimension info per line (for drill-down context)
 * - Optionally filters by dimension value
 * - Optionally includes SimulationLine entries (marked isSimulation=true)
 * - Computes running balance per entry starting from the account's opening balance
 */
export async function getGLDetail(
  prisma: PrismaClient,
  companyId: string,
  query: GLDetailQuery,
): Promise<GLDetailResponse> {
  const { fiscalYear, periodFrom, periodTo, accountCode, dimensionValueId, includeSimulations } =
    query;

  // 1. Fetch the account
  const account = await (prisma as any).chartOfAccount.findFirst({
    where: { companyId, code: accountCode, isActive: true },
    select: { code: true, name: true, normalBalance: true, openingBalance: true },
  });

  if (!account) {
    const error = new Error(`Account ${accountCode} not found`) as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  // 2. Find periods in range
  const periods = await (prisma as any).financialPeriod.findMany({
    where: { companyId, fiscalYear, periodNumber: { gte: periodFrom, lte: periodTo } },
    select: { id: true },
  });
  const periodIds = periods.map((p: { id: string }) => p.id);

  if (periodIds.length === 0) {
    const openingBalance = roundToFourDecimals(Number(account.openingBalance ?? 0));
    return {
      fiscalYear,
      periodFrom,
      periodTo,
      accountCode,
      accountName: account.name,
      openingBalance,
      entries: [],
      closingBalance: openingBalance,
      totalDebit: 0,
      totalCredit: 0,
    };
  }

  // 3. Build where clause for journal lines
  const lineWhere: Record<string, unknown> = {
    companyId,
    accountCode,
    journalEntry: { companyId, status: 'POSTED', periodId: { in: periodIds } },
  };

  // Dimension filter: join through JournalLineDimension
  if (dimensionValueId) {
    lineWhere.dimensions = { some: { dimensionValueId } };
  }

  // 4. Fetch journal lines with entry info and dimensions
  const journalLines = await (prisma as any).journalLine.findMany({
    where: lineWhere,
    orderBy: [{ journalEntry: { transactionDate: 'asc' } }, { lineNumber: 'asc' }],
    include: {
      journalEntry: {
        select: {
          id: true,
          entryNumber: true,
          transactionDate: true,
          description: true,
          reference: true,
          source: true,
        },
      },
      dimensions: {
        include: {
          dimensionValue: {
            select: {
              name: true,
              dimensionType: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // 5. Build entries from journal lines
  type RawLine = {
    journalEntry: {
      id: string;
      entryNumber: string;
      transactionDate: Date | string;
      description: string;
      reference: string | null;
      source: string;
    };
    debit: unknown;
    credit: unknown;
    dimensions: Array<{
      dimensionValue: {
        name: string;
        dimensionType: { name: string };
      };
    }>;
  };

  const openingBalance = roundToFourDecimals(Number(account.openingBalance ?? 0));
  let runningBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const entries: GLDetailResponse['entries'] = [];

  for (const line of journalLines as RawLine[]) {
    const debit = roundToFourDecimals(Number(line.debit ?? 0));
    const credit = roundToFourDecimals(Number(line.credit ?? 0));

    // Running balance respects normal balance direction
    if (account.normalBalance === 'DEBIT') {
      runningBalance = roundToFourDecimals(runningBalance + debit - credit);
    } else {
      runningBalance = roundToFourDecimals(runningBalance + credit - debit);
    }

    totalDebit += debit;
    totalCredit += credit;

    const txDate =
      line.journalEntry.transactionDate instanceof Date
        ? (line.journalEntry.transactionDate.toISOString().split('T')[0] ?? '')
        : String(line.journalEntry.transactionDate);

    entries.push({
      journalEntryId: line.journalEntry.id,
      entryNumber: line.journalEntry.entryNumber,
      transactionDate: txDate,
      description: line.journalEntry.description,
      reference: line.journalEntry.reference,
      source: line.journalEntry.source,
      debit,
      credit,
      runningBalance,
      isSimulation: false,
      dimensions: line.dimensions.map((d) => ({
        dimensionTypeName: d.dimensionValue.dimensionType.name,
        dimensionValueName: d.dimensionValue.name,
      })),
    });
  }

  // 6. Optionally include simulation lines
  if (includeSimulations) {
    const simLines = await getSimulationLinesForAccount(
      prisma,
      companyId,
      periodIds,
      accountCode,
      dimensionValueId,
    );
    // Merge sim lines into entries by date, then re-compute running balance
    for (const simLine of simLines) {
      entries.push(simLine);
    }
    // Sort all entries by date, then re-compute running balance from scratch
    entries.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    runningBalance = openingBalance;
    totalDebit = 0;
    totalCredit = 0;
    for (const entry of entries) {
      if (account.normalBalance === 'DEBIT') {
        runningBalance = roundToFourDecimals(runningBalance + entry.debit - entry.credit);
      } else {
        runningBalance = roundToFourDecimals(runningBalance + entry.credit - entry.debit);
      }
      entry.runningBalance = runningBalance;
      totalDebit += entry.debit;
      totalCredit += entry.credit;
    }
  }

  totalDebit = roundToFourDecimals(totalDebit);
  totalCredit = roundToFourDecimals(totalCredit);

  return {
    fiscalYear,
    periodFrom,
    periodTo,
    accountCode,
    accountName: account.name,
    openingBalance,
    entries,
    closingBalance: runningBalance,
    totalDebit,
    totalCredit,
  };
}

// ---------------------------------------------------------------------------
// General Ledger Report
// ---------------------------------------------------------------------------

/**
 * General Ledger -- all postings for all accounts (or a range) with running balances.
 *
 * - For each account with activity in the period: lists all postings with running balance
 * - Optionally filters by account code range (from/to)
 * - Optionally filters by dimension value
 * - Optionally includes simulation lines
 */
export async function getGeneralLedger(
  prisma: PrismaClient,
  companyId: string,
  query: GeneralLedgerQuery,
): Promise<GeneralLedgerResponse> {
  const { fiscalYear, periodFrom, periodTo, accountCodeFrom, accountCodeTo, dimensionValueId } =
    query;

  // 1. Find periods
  const periods = await (prisma as any).financialPeriod.findMany({
    where: { companyId, fiscalYear, periodNumber: { gte: periodFrom, lte: periodTo } },
    select: { id: true },
  });
  const periodIds = periods.map((p: { id: string }) => p.id);

  // 2. Fetch accounts in range
  const accountWhere: Record<string, unknown> = { companyId, isActive: true };
  if (accountCodeFrom || accountCodeTo) {
    accountWhere.code = {};
    if (accountCodeFrom) (accountWhere.code as Record<string, unknown>).gte = accountCodeFrom;
    if (accountCodeTo) (accountWhere.code as Record<string, unknown>).lte = accountCodeTo;
  }

  const allAccounts = await (prisma as any).chartOfAccount.findMany({
    where: accountWhere,
    orderBy: { code: 'asc' },
    select: {
      code: true,
      name: true,
      accountType: true,
      normalBalance: true,
      openingBalance: true,
    },
  });

  if (periodIds.length === 0 || allAccounts.length === 0) {
    return {
      fiscalYear,
      periodFrom,
      periodTo,
      accounts: [],
      grandTotals: { totalDebit: 0, totalCredit: 0 },
    };
  }

  // 3. For each account, fetch individual journal lines
  let grandTotalDebit = 0;
  let grandTotalCredit = 0;
  const accountResults: GeneralLedgerResponse['accounts'] = [];

  for (const acct of allAccounts) {
    const lineWhere: Record<string, unknown> = {
      companyId,
      accountCode: acct.code,
      journalEntry: { companyId, status: 'POSTED', periodId: { in: periodIds } },
    };
    if (dimensionValueId) {
      lineWhere.dimensions = { some: { dimensionValueId } };
    }

    const lines = await (prisma as any).journalLine.findMany({
      where: lineWhere,
      orderBy: [{ journalEntry: { transactionDate: 'asc' } }, { lineNumber: 'asc' }],
      include: {
        journalEntry: {
          select: { entryNumber: true, transactionDate: true, description: true },
        },
      },
    });

    // Skip accounts with no activity and no opening balance
    const openingBal = Number(acct.openingBalance ?? 0);
    if (lines.length === 0 && openingBal === 0) continue;

    let runningBalance = roundToFourDecimals(openingBal);
    let acctTotalDebit = 0;
    let acctTotalCredit = 0;

    const acctEntries: GeneralLedgerResponse['accounts'][0]['entries'] = [];
    for (const line of lines) {
      const debit = roundToFourDecimals(Number(line.debit ?? 0));
      const credit = roundToFourDecimals(Number(line.credit ?? 0));

      if (acct.normalBalance === 'DEBIT') {
        runningBalance = roundToFourDecimals(runningBalance + debit - credit);
      } else {
        runningBalance = roundToFourDecimals(runningBalance + credit - debit);
      }

      acctTotalDebit += debit;
      acctTotalCredit += credit;

      const txDate =
        line.journalEntry.transactionDate instanceof Date
          ? line.journalEntry.transactionDate.toISOString().split('T')[0]
          : String(line.journalEntry.transactionDate);

      acctEntries.push({
        entryNumber: line.journalEntry.entryNumber,
        transactionDate: txDate,
        description: line.journalEntry.description,
        debit,
        credit,
        runningBalance,
      });
    }

    acctTotalDebit = roundToFourDecimals(acctTotalDebit);
    acctTotalCredit = roundToFourDecimals(acctTotalCredit);
    grandTotalDebit += acctTotalDebit;
    grandTotalCredit += acctTotalCredit;

    accountResults.push({
      accountCode: acct.code,
      accountName: acct.name,
      accountType: acct.accountType,
      openingBalance: roundToFourDecimals(openingBal),
      entries: acctEntries,
      closingBalance: runningBalance,
      totalDebit: acctTotalDebit,
      totalCredit: acctTotalCredit,
    });
  }

  return {
    fiscalYear,
    periodFrom,
    periodTo,
    accounts: accountResults,
    grandTotals: {
      totalDebit: roundToFourDecimals(grandTotalDebit),
      totalCredit: roundToFourDecimals(grandTotalCredit),
    },
  };
}

// ---------------------------------------------------------------------------
// Departmental P&L Report
// ---------------------------------------------------------------------------

/**
 * Departmental P&L -- P&L report pivoted by dimension.
 *
 * Each column represents a dimension value (e.g., "Sales Dept", "Marketing Dept").
 * Final column represents "Unallocated" lines (no dimension value for the given type).
 */
export async function getDepartmentalPnl(
  prisma: PrismaClient,
  companyId: string,
  query: DepartmentalPnlQuery,
): Promise<DepartmentalPnlResponse> {
  const { fiscalYear, periodFrom, periodTo, dimensionTypeId } = query;

  // 1. Fetch dimension type
  const dimType = await (prisma as any).dimensionType.findFirst({
    where: { id: dimensionTypeId, companyId },
    select: { id: true, name: true },
  });
  if (!dimType) {
    const error = new Error('Dimension type not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  // 2. Fetch active dimension values for this type (these are our columns)
  const dimValues = await (prisma as any).dimensionValue.findMany({
    where: { dimensionTypeId, companyId, isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true },
  });

  const columns: DepartmentalPnlResponse['columns'] = dimValues.map(
    (dv: { id: string; code: string; name: string }) => ({
      dimensionValueId: dv.id,
      dimensionValueName: dv.name,
      dimensionValueCode: dv.code,
    }),
  );

  // Add "Unallocated" as the last column
  columns.push({
    dimensionValueId: '__UNALLOCATED__',
    dimensionValueName: 'Unallocated',
    dimensionValueCode: 'UNALLOC',
  });

  const columnCount = columns.length;
  const dimValueIdToIndex = new Map<string, number>();
  dimValues.forEach((dv: { id: string }, idx: number) => {
    dimValueIdToIndex.set(dv.id, idx);
  });
  const unallocatedIndex = columnCount - 1;

  // 3. Find periods
  const periods = await (prisma as any).financialPeriod.findMany({
    where: { companyId, fiscalYear, periodNumber: { gte: periodFrom, lte: periodTo } },
    select: { id: true },
  });
  const periodIds = periods.map((p: { id: string }) => p.id);

  // 4. Fetch P&L accounts
  const pnlAccounts = await (prisma as any).chartOfAccount.findMany({
    where: {
      companyId,
      isActive: true,
      classification: { reportSection: 'PROFIT_AND_LOSS' },
    },
    orderBy: { code: 'asc' },
    select: {
      code: true,
      name: true,
      normalBalance: true,
      classification: { select: { code: true, name: true } },
    },
  });

  // 5. Query DimensionBalance for pre-aggregated data
  const dimBalances =
    periodIds.length > 0
      ? await (prisma as any).dimensionBalance.findMany({
          where: {
            companyId,
            dimensionTypeId,
            periodId: { in: periodIds },
          },
          select: {
            accountCode: true,
            dimensionValueId: true,
            totalDebit: true,
            totalCredit: true,
          },
        })
      : [];

  // Build a nested map: accountCode -> dimensionValueId -> { totalDebit, totalCredit }
  const dimBalanceMap = new Map<string, Map<string, { totalDebit: number; totalCredit: number }>>();
  for (const db of dimBalances) {
    const acctMap = dimBalanceMap.get(db.accountCode) ?? new Map();
    const existing = acctMap.get(db.dimensionValueId) ?? { totalDebit: 0, totalCredit: 0 };
    existing.totalDebit += Number(db.totalDebit ?? 0);
    existing.totalCredit += Number(db.totalCredit ?? 0);
    acctMap.set(db.dimensionValueId, existing);
    dimBalanceMap.set(db.accountCode, acctMap);
  }

  // 6. Also compute total per account (from journal lines) to determine unallocated
  let totalLineAgg: Array<{ accountCode: string; _sum: { debit: unknown; credit: unknown } }> = [];
  if (periodIds.length > 0) {
    totalLineAgg = await (prisma as any).journalLine.groupBy({
      by: ['accountCode'],
      where: {
        companyId,
        journalEntry: { companyId, status: 'POSTED', periodId: { in: periodIds } },
      },
      _sum: { debit: true, credit: true },
    });
  }
  const totalLineMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  for (const agg of totalLineAgg) {
    totalLineMap.set(agg.accountCode, {
      totalDebit: Number(agg._sum.debit ?? 0),
      totalCredit: Number(agg._sum.credit ?? 0),
    });
  }

  // 7. Build sections
  const accountsByClassification = new Map<
    string,
    Array<{ code: string; name: string; normalBalance: string; values: number[]; total: number }>
  >();

  for (const acct of pnlAccounts) {
    const classCode = acct.classification?.code;
    if (!classCode) continue;

    const acctDimMap = dimBalanceMap.get(acct.code);
    const totalLine = totalLineMap.get(acct.code);
    const totalDebit = totalLine?.totalDebit ?? 0;
    const totalCredit = totalLine?.totalCredit ?? 0;

    if (totalDebit === 0 && totalCredit === 0) continue;

    // Compute balance per dimension value
    const values = new Array<number>(columnCount).fill(0);
    let allocatedDebit = 0;
    let allocatedCredit = 0;

    if (acctDimMap) {
      for (const [dvId, totals] of acctDimMap.entries()) {
        const colIdx = dimValueIdToIndex.get(dvId);
        if (colIdx !== undefined) {
          const balance =
            acct.normalBalance === 'DEBIT'
              ? totals.totalDebit - totals.totalCredit
              : totals.totalCredit - totals.totalDebit;
          values[colIdx] = roundToFourDecimals(balance);
          allocatedDebit += totals.totalDebit;
          allocatedCredit += totals.totalCredit;
        }
      }
    }

    // Unallocated = total - allocated
    const unallocatedDebit = totalDebit - allocatedDebit;
    const unallocatedCredit = totalCredit - allocatedCredit;
    const unallocatedBalance =
      acct.normalBalance === 'DEBIT'
        ? unallocatedDebit - unallocatedCredit
        : unallocatedCredit - unallocatedDebit;
    values[unallocatedIndex] = roundToFourDecimals(unallocatedBalance);

    const accountTotal = roundToFourDecimals(values.reduce((s, v) => s + v, 0));

    const existing = accountsByClassification.get(classCode) ?? [];
    existing.push({
      code: acct.code,
      name: acct.name,
      normalBalance: acct.normalBalance,
      values,
      total: accountTotal,
    });
    accountsByClassification.set(classCode, existing);
  }

  // Build sections in P&L order
  const sections: DepartmentalPnlResponse['sections'] = [];
  const sectionTotalsPerColumn = new Map<string, number[]>();

  for (const { code, name } of PNL_CLASSIFICATIONS) {
    const sectionAccounts = accountsByClassification.get(code) ?? [];
    const sectionTotals = new Array<number>(columnCount).fill(0);
    for (const acct of sectionAccounts) {
      for (let i = 0; i < columnCount; i++) {
        sectionTotals[i] = (sectionTotals[i] ?? 0) + (acct.values[i] ?? 0);
      }
    }
    const roundedTotals = sectionTotals.map(roundToFourDecimals);
    const grandTotal = roundToFourDecimals(roundedTotals.reduce((s, v) => s + v, 0));

    sections.push({
      classification: code,
      name,
      accounts: sectionAccounts.map((a) => ({
        accountCode: a.code,
        accountName: a.name,
        values: a.values,
        total: a.total,
      })),
      totals: roundedTotals,
      grandTotal,
    });
    sectionTotalsPerColumn.set(code, roundedTotals);
  }

  // 8. Calculate net profit per column
  const netProfitPerColumn = new Array<number>(columnCount).fill(0);
  const rev = sectionTotalsPerColumn.get('REV') ?? new Array<number>(columnCount).fill(0);
  const cogs = sectionTotalsPerColumn.get('COGS') ?? new Array<number>(columnCount).fill(0);
  const opex = sectionTotalsPerColumn.get('OPEX') ?? new Array<number>(columnCount).fill(0);
  const oi = sectionTotalsPerColumn.get('OI') ?? new Array<number>(columnCount).fill(0);
  const fin = sectionTotalsPerColumn.get('FIN') ?? new Array<number>(columnCount).fill(0);
  const tax = sectionTotalsPerColumn.get('TAX') ?? new Array<number>(columnCount).fill(0);

  for (let i = 0; i < columnCount; i++) {
    netProfitPerColumn[i] = roundToFourDecimals(
      (rev[i] ?? 0) -
        (cogs[i] ?? 0) -
        (opex[i] ?? 0) +
        (oi[i] ?? 0) -
        (fin[i] ?? 0) -
        (tax[i] ?? 0),
    );
  }

  const totalNetProfit = roundToFourDecimals(netProfitPerColumn.reduce((s, v) => s + v, 0));

  return {
    fiscalYear,
    periodFrom,
    periodTo,
    dimensionTypeName: dimType.name,
    columns,
    sections,
    summary: { netProfitPerColumn, totalNetProfit },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate net Profit/Loss for the given periods by summing P&L account balances.
 *
 * Revenue accounts (CREDIT normal) produce positive balances (credits - debits).
 * Expense accounts (DEBIT normal) produce positive balances (debits - credits).
 * Net P&L = sum of revenue balances - sum of expense balances.
 *
 * A positive result means profit; negative means loss.
 *
 * Optionally filters by dimension value and includes simulation data.
 */
async function calculatePeriodNetPnl(
  prisma: PrismaClient,
  companyId: string,
  periodIds: string[],
  dimensionValueId?: string,
  includeSimulations?: boolean,
): Promise<number> {
  if (periodIds.length === 0) return 0;

  // Use the shared helper for dimension-filtered aggregation
  const lineMap = await getDimensionFilteredAggregations(
    prisma,
    companyId,
    periodIds,
    dimensionValueId,
  );

  // Optionally merge simulation data
  if (includeSimulations) {
    const simMap = await getSimulationLineAggregations(
      prisma,
      companyId,
      periodIds,
      dimensionValueId,
    );
    mergeSimulationAggregations(lineMap, simMap);
  }

  // Fetch P&L accounts (reportSection = PROFIT_AND_LOSS)
  const pnlAccounts = await (prisma as any).chartOfAccount.findMany({
    where: {
      companyId,
      isActive: true,
      classification: {
        reportSection: 'PROFIT_AND_LOSS',
      },
    },
    select: {
      code: true,
      normalBalance: true,
      openingBalance: true,
    },
  });

  let netPnl = 0;
  for (const account of pnlAccounts) {
    const openingBalance = Number(account.openingBalance ?? 0);
    const lineTotals = lineMap.get(account.code);
    const debits = lineTotals?.totalDebit ?? 0;
    const credits = lineTotals?.totalCredit ?? 0;

    if (openingBalance === 0 && debits === 0 && credits === 0) continue;

    // Balance in the account's natural direction
    const balance =
      account.normalBalance === 'DEBIT'
        ? openingBalance + debits - credits
        : openingBalance + credits - debits;

    // Revenue (CREDIT normal) adds to profit; Expenses (DEBIT normal) subtract.
    if (account.normalBalance === 'CREDIT') {
      netPnl += balance; // Revenue adds
    } else {
      netPnl -= balance; // Expenses subtract
    }
  }

  return netPnl;
}

function roundToFourDecimals(value: number): number {
  return Math.round(value * 10000) / 10000;
}
