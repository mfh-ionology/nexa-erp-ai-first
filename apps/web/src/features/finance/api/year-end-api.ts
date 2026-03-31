/**
 * Year-End Close & Opening Balances API client functions.
 *
 * Endpoints:
 *   GET  /finance/year-end/status          — get year-end status/validations
 *   POST /finance/year-end/close           — close fiscal year
 *   POST /finance/opening-balances/import  — CSV import
 *   POST /finance/opening-balances/manual  — manual entry
 */

import { apiGet, apiPost } from '@/lib/api-client';

import type {
  YearEndCloseResult,
  YearEndCloseInput,
  OpeningBalanceImportResult,
  ManualOpeningBalanceInput,
  OpeningBalanceLine,
} from '../types';

export async function getYearEndStatus(fiscalYear: number): Promise<YearEndCloseResult> {
  const result = await apiGet<YearEndCloseResult>(
    `/finance/year-end/status?fiscalYear=${fiscalYear}`,
  );
  return result.data;
}

export async function closeYearEnd(input: YearEndCloseInput): Promise<YearEndCloseResult> {
  const result = await apiPost<YearEndCloseResult>('/finance/year-end/close', input);
  return result.data;
}

export async function importOpeningBalances(file: File): Promise<OpeningBalanceImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const result = await apiPost<OpeningBalanceImportResult>(
    '/finance/opening-balances/import',
    formData,
  );
  return result.data;
}

export async function submitManualOpeningBalances(
  input: ManualOpeningBalanceInput,
): Promise<{ created: number }> {
  const result = await apiPost<{ created: number }>('/finance/opening-balances/manual', input);
  return result.data;
}

export async function getOpeningBalances(): Promise<OpeningBalanceLine[]> {
  const result = await apiGet<OpeningBalanceLine[]>('/finance/opening-balances');
  return result.data;
}
