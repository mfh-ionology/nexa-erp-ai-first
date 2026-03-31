/**
 * Bank Accounts API client functions.
 *
 * Endpoints:
 *   GET    /finance/bank-accounts      — list bank accounts (cursor-paginated)
 *   GET    /finance/bank-accounts/:id  — get single bank account detail
 *   POST   /finance/bank-accounts      — create a new bank account
 *   PATCH  /finance/bank-accounts/:id  — update bank account
 */

import { apiGet, apiPost, apiPatch, buildQueryString } from '@/lib/api-client';

import type {
  BankAccount,
  BankAccountDetail,
  BankAccountListParams,
  BankAccountListResponse,
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from '../types';

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts — list
// ---------------------------------------------------------------------------

export async function listBankAccounts(
  params: BankAccountListParams = {},
): Promise<BankAccountListResponse> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<BankAccount[]>(`/finance/bank-accounts${qs}`);
  return {
    data: result.data,
    meta: (result.meta as { cursor?: string; hasMore: boolean }) ?? {
      hasMore: false,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /finance/bank-accounts/:id — detail
// ---------------------------------------------------------------------------

export async function getBankAccount(id: string): Promise<BankAccountDetail> {
  const result = await apiGet<BankAccountDetail>(`/finance/bank-accounts/${id}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/bank-accounts — create
// ---------------------------------------------------------------------------

export async function createBankAccount(input: CreateBankAccountInput): Promise<BankAccountDetail> {
  const result = await apiPost<BankAccountDetail>('/finance/bank-accounts', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// PATCH /finance/bank-accounts/:id — update
// ---------------------------------------------------------------------------

export async function updateBankAccount(
  id: string,
  input: UpdateBankAccountInput,
): Promise<BankAccountDetail> {
  const result = await apiPatch<BankAccountDetail>(`/finance/bank-accounts/${id}`, input);
  return result.data;
}
