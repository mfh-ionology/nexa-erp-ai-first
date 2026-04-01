/**
 * Enhanced Reports API client functions.
 *
 * Endpoints:
 *   GET /finance/reports/gl-detail         — single account activity with running balance
 *   GET /finance/reports/general-ledger    — multi-account general ledger
 *   GET /finance/reports/departmental-pnl  — P&L columns by dimension
 */

import { apiGet, buildQueryString } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// GL Detail
// ---------------------------------------------------------------------------

export interface GlDetailRow {
  date: string;
  journalNumber: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface GlDetailParams {
  accountId: string;
  dateFrom: string;
  dateTo: string;
  dimensionTypeId?: string;
  dimensionValueId?: string;
  includeSimulations?: boolean;
}

export interface GlDetailReport {
  accountCode: string;
  accountName: string;
  openingBalance: number;
  rows: GlDetailRow[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  generatedAt: string;
}

export async function getGlDetail(params: GlDetailParams): Promise<GlDetailReport> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result = await apiGet<GlDetailReport>(`/finance/reports/gl-detail${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// General Ledger
// ---------------------------------------------------------------------------

export interface GeneralLedgerAccount {
  accountCode: string;
  accountName: string;
  openingBalance: number;
  entries: GlDetailRow[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

export interface GeneralLedgerParams {
  dateFrom: string;
  dateTo: string;
  accountCodeFrom?: string;
  accountCodeTo?: string;
  dimensionTypeId?: string;
  dimensionValueId?: string;
  includeSimulations?: boolean;
}

export interface GeneralLedgerReport {
  accounts: GeneralLedgerAccount[];
  generatedAt: string;
}

export async function getGeneralLedger(params: GeneralLedgerParams): Promise<GeneralLedgerReport> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result = await apiGet<GeneralLedgerReport>(`/finance/reports/general-ledger${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Departmental P&L
// ---------------------------------------------------------------------------

export interface DepartmentalPnlRow {
  accountCode: string;
  accountName: string;
  section: string;
  columns: Record<string, number>;
  total: number;
}

export interface DepartmentalPnlParams {
  fiscalYear: number;
  periodFrom: number;
  periodTo: number;
  dimensionTypeId: string;
  includeSimulations?: boolean;
}

export interface DepartmentalPnlReport {
  dimensionTypeName: string;
  columnHeaders: Array<{ id: string; code: string; name: string }>;
  sections: Array<{
    sectionName: string;
    rows: DepartmentalPnlRow[];
    subtotals: Record<string, number>;
    subtotalTotal: number;
  }>;
  grandTotals: Record<string, number>;
  grandTotal: number;
  generatedAt: string;
}

export async function getDepartmentalPnl(
  params: DepartmentalPnlParams,
): Promise<DepartmentalPnlReport> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result = await apiGet<DepartmentalPnlReport>(`/finance/reports/departmental-pnl${qs}`);
  return result.data;
}
