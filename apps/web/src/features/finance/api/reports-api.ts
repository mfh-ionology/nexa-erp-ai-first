/**
 * Financial Reports API client functions.
 *
 * Transforms the API response shape into the frontend component shape.
 *
 * API returns:  { sections: [{ classification, name, accounts, total }], grossProfit, ... }
 * Frontend expects: { revenue: { rows, subtotal }, costOfGoodsSold: { rows, subtotal }, ... }
 */

import { apiGet, buildQueryString } from '@/lib/api-client';

import type {
  ReportParams,
  TrialBalanceReport,
  ProfitAndLossReport,
  BalanceSheetReport,
  ReportSection,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ApiSection {
  classification: string;
  name: string;
  accounts: Array<{
    accountCode: string;
    accountName: string;
    balance: number;
  }>;
  total: number;
}

function findSection(sections: ApiSection[], classification: string): ReportSection {
  const s = sections.find((sec) => sec.classification === classification);
  return {
    sectionName: s?.name ?? classification,
    rows: (s?.accounts ?? []).map((a) => ({
      accountCode: a.accountCode,
      accountName: a.accountName,
      amount: a.balance,
    })),
    subtotal: s?.total ?? 0,
  };
}

// ---------------------------------------------------------------------------
// GET /finance/reports/trial-balance
// ---------------------------------------------------------------------------

export async function getTrialBalance(params: ReportParams): Promise<TrialBalanceReport> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result = await apiGet<TrialBalanceReport>(`/finance/reports/trial-balance${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// GET /finance/reports/profit-and-loss
// ---------------------------------------------------------------------------

interface PnlApiResponse {
  fiscalYear: number;
  periodFrom: number;
  periodTo: number;
  sections: ApiSection[];
  grossProfit: number;
  operatingExpenses: number;
  operatingProfit: number;
  otherIncome: number;
  financeCosts: number;
  profitBeforeTax: number;
  taxation: number;
  netProfit: number;
}

export async function getProfitAndLoss(params: ReportParams): Promise<ProfitAndLossReport> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result = await apiGet<PnlApiResponse>(`/finance/reports/profit-and-loss${qs}`);
  const api = result.data;

  return {
    revenue: findSection(api.sections, 'REV'),
    costOfGoodsSold: findSection(api.sections, 'COGS'),
    grossProfit: api.grossProfit,
    operatingExpenses: findSection(api.sections, 'OPEX'),
    operatingProfit: api.operatingProfit,
    otherIncome: findSection(api.sections, 'OI'),
    otherExpenses: findSection(api.sections, 'FIN'),
    netProfit: api.netProfit,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET /finance/reports/balance-sheet
// ---------------------------------------------------------------------------

interface BsApiResponse {
  fiscalYear: number;
  periodFrom: number;
  periodTo: number;
  sections: ApiSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
}

export async function getBalanceSheet(params: ReportParams): Promise<BalanceSheetReport> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result = await apiGet<BsApiResponse>(`/finance/reports/balance-sheet${qs}`);
  const api = result.data;

  return {
    assets: {
      fixedAssets: findSection(api.sections, 'FA'),
      currentAssets: findSection(api.sections, 'CA'),
      totalAssets: api.totalAssets,
    },
    liabilities: {
      currentLiabilities: findSection(api.sections, 'CL'),
      longTermLiabilities: findSection(api.sections, 'LTL'),
      totalLiabilities: api.totalLiabilities,
    },
    equity: findSection(api.sections, 'EQ'),
    totalLiabilitiesAndEquity: api.totalLiabilities + api.totalEquity,
    generatedAt: new Date().toISOString(),
  };
}
