/**
 * Financial Periods API client functions.
 *
 * Endpoints from E14-API periods routes:
 *   GET    /finance/periods              — list periods grouped by fiscal year
 *   POST   /finance/periods/year         — create fiscal year (12 + optional P13)
 *   POST   /finance/periods/:id/close    — close an OPEN period
 *   POST   /finance/periods/:id/reopen   — reopen a CLOSED period
 *   POST   /finance/periods/:id/lock     — lock a CLOSED period (irreversible)
 */

import { apiGet, apiPost, buildQueryString } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types (matching API response shapes from periods.schema.ts)
// ---------------------------------------------------------------------------

export type PeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface Period {
  id: string;
  name: string;
  periodNumber: number;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedAt: string | null;
  closedBy: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalYearSummary {
  total: number;
  open: number;
  closed: number;
  locked: number;
}

export interface FiscalYearGroup {
  fiscalYear: number;
  periods: Period[];
  summary: FiscalYearSummary;
}

export interface ListPeriodsParams {
  fiscalYear?: number;
  status?: PeriodStatus;
}

export interface CreateFiscalYearInput {
  fiscalYear: number;
  includeP13: boolean;
}

// ---------------------------------------------------------------------------
// GET /finance/periods — List periods grouped by fiscal year
// ---------------------------------------------------------------------------

export async function listPeriods(params: ListPeriodsParams = {}): Promise<FiscalYearGroup[]> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<FiscalYearGroup[]>(`/finance/periods${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/periods/year — Create fiscal year periods
// ---------------------------------------------------------------------------

export async function createFiscalYear(input: CreateFiscalYearInput): Promise<Period[]> {
  const result = await apiPost<Period[]>('/finance/periods/year', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/periods/:id/close — Close an OPEN period
// ---------------------------------------------------------------------------

export async function closePeriod(id: string): Promise<Period> {
  const result = await apiPost<Period>(`/finance/periods/${encodeURIComponent(id)}/close`);
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/periods/:id/reopen — Reopen a CLOSED period
// ---------------------------------------------------------------------------

export async function reopenPeriod(id: string): Promise<Period> {
  const result = await apiPost<Period>(`/finance/periods/${encodeURIComponent(id)}/reopen`);
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/periods/:id/lock — Lock a CLOSED period (irreversible)
// ---------------------------------------------------------------------------

export async function lockPeriod(id: string): Promise<Period> {
  const result = await apiPost<Period>(`/finance/periods/${encodeURIComponent(id)}/lock`);
  return result.data;
}
