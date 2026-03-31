/**
 * Financial Reports API client functions.
 *
 * Endpoints:
 *   GET /finance/reports/trial-balance    — generate trial balance
 *   GET /finance/reports/profit-and-loss  — generate P&L
 *   GET /finance/reports/balance-sheet    — generate balance sheet
 */

import { apiGet, buildQueryString } from '@/lib/api-client';

import type {
  ReportParams,
  TrialBalanceReport,
  ProfitAndLossReport,
  BalanceSheetReport,
} from '../types';

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

export async function getProfitAndLoss(params: ReportParams): Promise<ProfitAndLossReport> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result = await apiGet<ProfitAndLossReport>(`/finance/reports/profit-and-loss${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// GET /finance/reports/balance-sheet
// ---------------------------------------------------------------------------

export async function getBalanceSheet(params: ReportParams): Promise<BalanceSheetReport> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result = await apiGet<BalanceSheetReport>(`/finance/reports/balance-sheet${qs}`);
  return result.data;
}
