/**
 * Month-End Close API client functions.
 *
 * Endpoints:
 *   GET  /finance/month-end              — list month-end periods
 *   GET  /finance/month-end/:periodId    — get period detail with steps
 *   POST /finance/month-end/:periodId/close   — close period
 *   POST /finance/month-end/:periodId/steps/:stepId/complete — complete a step
 */

import { apiGet, apiPost, buildQueryString } from '@/lib/api-client';

import type { MonthEndPeriod, MonthEndListResponse, MonthEndListParams } from '../types';

export async function listMonthEndPeriods(
  params: MonthEndListParams = {},
): Promise<MonthEndListResponse> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<MonthEndListResponse>(`/finance/month-end${qs}`);
  return result.data;
}

export async function getMonthEndPeriod(periodId: string): Promise<MonthEndPeriod> {
  const result = await apiGet<MonthEndPeriod>(`/finance/month-end/${encodeURIComponent(periodId)}`);
  return result.data;
}

export async function closeMonthEnd(periodId: string): Promise<MonthEndPeriod> {
  const result = await apiPost<MonthEndPeriod>(
    `/finance/month-end/${encodeURIComponent(periodId)}/close`,
  );
  return result.data;
}

export async function completeMonthEndStep(
  periodId: string,
  stepId: string,
): Promise<MonthEndPeriod> {
  const result = await apiPost<MonthEndPeriod>(
    `/finance/month-end/${encodeURIComponent(periodId)}/steps/${encodeURIComponent(stepId)}/complete`,
  );
  return result.data;
}
