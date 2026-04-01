/**
 * Bank Reconciliation Rules API client functions.
 *
 * Endpoints:
 *   GET    /finance/bank-recon-rules         — list rules
 *   GET    /finance/bank-recon-rules/:id     — get rule detail
 *   POST   /finance/bank-recon-rules         — create rule
 *   PATCH  /finance/bank-recon-rules/:id     — update rule
 *   DELETE /finance/bank-recon-rules/:id     — delete rule
 *   POST   /finance/bank-accounts/:id/apply-rules         — get suggestions
 *   POST   /finance/bank-accounts/:id/create-journal-from-rule — create journal from rule
 */

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BankReconRule {
  id: string;
  companyId: string;
  name: string;
  matchType: 'EXACT' | 'STARTS_WITH' | 'CONTAINS' | 'REGEX';
  matchPattern: string;
  targetAccountCode: string;
  description: string | null;
  vatCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateRuleInput {
  name: string;
  matchType: 'EXACT' | 'STARTS_WITH' | 'CONTAINS' | 'REGEX';
  matchPattern: string;
  targetAccountCode: string;
  description?: string;
  vatCode?: string;
  isActive?: boolean;
}

export interface UpdateRuleInput {
  name?: string;
  matchType?: 'EXACT' | 'STARTS_WITH' | 'CONTAINS' | 'REGEX';
  matchPattern?: string;
  targetAccountCode?: string;
  description?: string | null;
  vatCode?: string | null;
  isActive?: boolean;
}

export interface ListRulesParams {
  isActive?: boolean;
  cursor?: string;
  limit?: number;
}

export interface RuleSuggestion {
  bankTransactionId: string;
  ruleId: string;
  ruleName: string;
  suggestedAccountCode: string;
  suggestedDescription: string | null;
}

export interface CreateJournalFromRuleInput {
  bankTransactionId: string;
  ruleId: string;
  accountCode?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// GET /finance/bank-recon-rules — list
// ---------------------------------------------------------------------------

export async function listReconRules(
  params: ListRulesParams = {},
): Promise<{ data: BankReconRule[]; meta: { cursor?: string; hasMore: boolean; total?: number } }> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<BankReconRule[]>(`/finance/bank-recon-rules${qs}`);
  return {
    data: result.data,
    meta: (result.meta as { cursor?: string; hasMore: boolean; total?: number }) ?? {
      hasMore: false,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /finance/bank-recon-rules/:id — detail
// ---------------------------------------------------------------------------

export async function getReconRule(id: string): Promise<BankReconRule> {
  const result = await apiGet<BankReconRule>(`/finance/bank-recon-rules/${id}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/bank-recon-rules — create
// ---------------------------------------------------------------------------

export async function createReconRule(input: CreateRuleInput): Promise<BankReconRule> {
  const result = await apiPost<BankReconRule>('/finance/bank-recon-rules', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// PATCH /finance/bank-recon-rules/:id — update
// ---------------------------------------------------------------------------

export async function updateReconRule(id: string, input: UpdateRuleInput): Promise<BankReconRule> {
  const result = await apiPatch<BankReconRule>(`/finance/bank-recon-rules/${id}`, input);
  return result.data;
}

// ---------------------------------------------------------------------------
// DELETE /finance/bank-recon-rules/:id — delete
// ---------------------------------------------------------------------------

export async function deleteReconRule(id: string): Promise<void> {
  await apiDelete(`/finance/bank-recon-rules/${id}`);
}

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts/:id/apply-rules — get suggestions
// ---------------------------------------------------------------------------

export async function applyRules(bankAccountId: string): Promise<RuleSuggestion[]> {
  const result = await apiPost<RuleSuggestion[]>(
    `/finance/bank-accounts/${bankAccountId}/apply-rules`,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts/:id/create-journal-from-rule
// ---------------------------------------------------------------------------

export async function createJournalFromRule(
  bankAccountId: string,
  input: CreateJournalFromRuleInput,
): Promise<unknown> {
  const result = await apiPost<unknown>(
    `/finance/bank-accounts/${bankAccountId}/create-journal-from-rule`,
    input,
  );
  return result.data;
}
