/**
 * Bank Reconciliation API client functions.
 *
 * Actual backend endpoints:
 *   POST /finance/bank-accounts/:bankAccountId/reconciliations          — create session
 *   GET  /finance/bank-accounts/:bankAccountId/reconciliations          — list sessions
 *   GET  /finance/bank-accounts/:bankAccountId/reconciliations/:id      — detail (matched+unmatched)
 *   POST /finance/bank-accounts/:bankAccountId/reconciliations/:id/complete — complete
 *   POST /finance/bank-accounts/:id/match                              — match bank tx to journal line
 *   POST /finance/bank-transactions/:id/unmatch                        — unmatch
 */

import { apiGet, apiPost, buildQueryString } from '@/lib/api-client';

import type {
  BankTransaction,
  JournalLineForMatching,
  ReconciliationSummary,
  MatchResult,
  UnmatchResult,
} from '../types';

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts/:bankAccountId/reconciliations — list sessions
// ---------------------------------------------------------------------------

export async function listReconciliations(bankAccountId: string): Promise<ReconciliationSummary[]> {
  const result = await apiGet<ReconciliationSummary[]>(
    `/finance/bank-accounts/${bankAccountId}/reconciliations`,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts/:bankAccountId/reconciliations — create session
// ---------------------------------------------------------------------------

export async function createReconciliation(
  bankAccountId: string,
  input: { statementDate: string; statementBalance: number },
): Promise<ReconciliationSummary> {
  const result = await apiPost<ReconciliationSummary>(
    `/finance/bank-accounts/${bankAccountId}/reconciliations`,
    input,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts/:bankAccountId/reconciliations/:id — detail
// Returns matched transactions, unmatched bank transactions, unmatched journal lines
// ---------------------------------------------------------------------------

interface ReconciliationApiResponse {
  id: string;
  bankAccountId: string;
  statementDate: string;
  statementBalance: number;
  glBalance: number | null;
  difference: number | null;
  status: string;
  matchedTransactions: BankTransaction[];
  unmatchedTransactions: BankTransaction[];
  unmatchedJournalLines: JournalLineForMatching[];
}

export interface ReconciliationDetail {
  id: string;
  bankAccountId: string;
  statementDate: string;
  statementBalance: number;
  glBalance: number | null;
  difference: number | null;
  status: string;
  matchedTransactions: BankTransaction[];
  unmatchedBankTransactions: BankTransaction[];
  unmatchedJournalLines: JournalLineForMatching[];
}

export async function getReconciliationDetail(
  bankAccountId: string,
  reconciliationId: string,
): Promise<ReconciliationDetail> {
  const result = await apiGet<ReconciliationApiResponse>(
    `/finance/bank-accounts/${bankAccountId}/reconciliations/${reconciliationId}`,
  );
  const api = result.data;

  // Transform API shape to frontend shape
  return {
    id: api.id,
    bankAccountId: api.bankAccountId,
    statementDate: api.statementDate,
    statementBalance: api.statementBalance,
    glBalance: api.glBalance,
    difference: api.difference,
    status: api.status,
    matchedTransactions: api.matchedTransactions ?? [],
    unmatchedBankTransactions: api.unmatchedTransactions ?? [],
    unmatchedJournalLines: api.unmatchedJournalLines ?? [],
  };
}

// ---------------------------------------------------------------------------
// For the workspace page — get or create an active reconciliation
// ---------------------------------------------------------------------------

export async function getOrCreateReconciliation(
  bankAccountId: string,
): Promise<ReconciliationSummary> {
  // First check for existing IN_PROGRESS reconciliation
  const existing = await listReconciliations(bankAccountId);
  const active = existing.find((r) => r.status === 'IN_PROGRESS');
  if (active) return active;

  // Create a new one with today's date and 0 balance (user can update)
  const today = new Date().toISOString().split('T')[0]!;
  return createReconciliation(bankAccountId, {
    statementDate: today,
    statementBalance: 0,
  });
}

// ---------------------------------------------------------------------------
// Compatibility shims for existing hooks
// ---------------------------------------------------------------------------

export async function getReconciliationSummary(
  bankAccountId: string,
): Promise<ReconciliationSummary> {
  return getOrCreateReconciliation(bankAccountId);
}

export async function listBankTransactions(
  bankAccountId: string,
  _params: { status?: string; cursor?: string; limit?: number } = {},
): Promise<{ data: BankTransaction[]; meta: { cursor?: string; hasMore: boolean } }> {
  // Get the active reconciliation detail which includes bank transactions
  const recon = await getOrCreateReconciliation(bankAccountId);
  const detail = await getReconciliationDetail(bankAccountId, recon.id);
  return {
    data: [...detail.unmatchedBankTransactions, ...detail.matchedTransactions],
    meta: { hasMore: false },
  };
}

export async function listUnmatchedJournalLines(
  bankAccountId: string,
  _params: { cursor?: string; limit?: number } = {},
): Promise<{ data: JournalLineForMatching[]; meta: { cursor?: string; hasMore: boolean } }> {
  const recon = await getOrCreateReconciliation(bankAccountId);
  const detail = await getReconciliationDetail(bankAccountId, recon.id);
  return {
    data: detail.unmatchedJournalLines,
    meta: { hasMore: false },
  };
}

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts/:id/match
// ---------------------------------------------------------------------------

export async function matchTransaction(
  bankAccountId: string,
  bankTransactionId: string,
  journalLineId: string,
): Promise<MatchResult> {
  const result = await apiPost<MatchResult>(`/finance/bank-accounts/${bankAccountId}/match`, {
    bankTransactionId,
    journalLineId,
  });
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/bank-transactions/:id/unmatch
// ---------------------------------------------------------------------------

export async function unmatchTransaction(bankTransactionId: string): Promise<UnmatchResult> {
  const result = await apiPost<UnmatchResult>(
    `/finance/bank-transactions/${bankTransactionId}/unmatch`,
  );
  return result.data;
}
