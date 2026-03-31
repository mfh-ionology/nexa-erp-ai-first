/**
 * Additional Reports API client functions.
 *
 * Endpoints:
 *   GET /finance/reports/transaction-journal — transaction journal report
 *   GET /finance/reports/budget-variance     — budget variance report
 */

import { apiGet, buildQueryString } from '@/lib/api-client';

import type {
  TransactionJournalEntry,
  TransactionJournalParams,
  BudgetVarianceRow,
  BudgetVarianceParams,
  ReportDataResponse,
} from '../types';

export async function getTransactionJournal(
  params: TransactionJournalParams,
): Promise<ReportDataResponse<TransactionJournalEntry>> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result = await apiGet<ReportDataResponse<TransactionJournalEntry>>(
    `/finance/reports/transaction-journal${qs}`,
  );
  return result.data;
}

export async function getBudgetVariance(
  params: BudgetVarianceParams,
): Promise<ReportDataResponse<BudgetVarianceRow>> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result = await apiGet<ReportDataResponse<BudgetVarianceRow>>(
    `/finance/reports/budget-variance${qs}`,
  );
  return result.data;
}
