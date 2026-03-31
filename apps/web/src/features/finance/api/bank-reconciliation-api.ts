/**
 * Bank Reconciliation API client functions.
 *
 * Endpoints:
 *   GET  /finance/bank-accounts/:id/reconciliation  — get reconciliation summary
 *   GET  /finance/bank-accounts/:id/transactions     — list bank transactions
 *   GET  /finance/bank-accounts/:id/unmatched-lines  — list unmatched journal lines
 *   POST /finance/bank-accounts/:id/match            — match a bank transaction to a journal line
 *   POST /finance/bank-transactions/:id/unmatch      — unmatch a bank transaction
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
// GET /finance/bank-accounts/:id/reconciliation
// ---------------------------------------------------------------------------

export async function getReconciliationSummary(
  bankAccountId: string,
): Promise<ReconciliationSummary> {
  const result = await apiGet<ReconciliationSummary>(
    `/finance/bank-accounts/${bankAccountId}/reconciliation`,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts/:id/transactions
// ---------------------------------------------------------------------------

export async function listBankTransactions(
  bankAccountId: string,
  params: { status?: string; cursor?: string; limit?: number } = {},
): Promise<{ data: BankTransaction[]; meta: { cursor?: string; hasMore: boolean } }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<BankTransaction[]>(
    `/finance/bank-accounts/${bankAccountId}/transactions${qs}`,
  );
  return {
    data: result.data,
    meta: (result.meta as { cursor?: string; hasMore: boolean }) ?? {
      hasMore: false,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts/:id/unmatched-lines
// ---------------------------------------------------------------------------

export async function listUnmatchedJournalLines(
  bankAccountId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<{ data: JournalLineForMatching[]; meta: { cursor?: string; hasMore: boolean } }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<JournalLineForMatching[]>(
    `/finance/bank-accounts/${bankAccountId}/unmatched-lines${qs}`,
  );
  return {
    data: result.data,
    meta: (result.meta as { cursor?: string; hasMore: boolean }) ?? {
      hasMore: false,
    },
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
