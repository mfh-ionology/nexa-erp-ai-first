/**
 * Chart of Accounts API client functions.
 *
 * Endpoints from E14-API accounts routes:
 *   GET    /finance/accounts          — list accounts (flat or tree view)
 *   GET    /finance/accounts/search   — search accounts by code/name
 *   GET    /finance/accounts/:id      — account detail
 *   POST   /finance/accounts          — create account
 *   PATCH  /finance/accounts/:id      — update account
 */

import { apiGet, apiPost, apiPatch, buildQueryString } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-client';

import type {
  AccountDetail,
  AccountListItem,
  AccountTreeNode,
  CreateAccountInput,
  UpdateAccountInput,
  ListAccountsParams,
  SearchAccountsParams,
} from '../types';

// ---------------------------------------------------------------------------
// List accounts (flat — with pagination and filters)
// ---------------------------------------------------------------------------

export async function listAccounts(
  params: ListAccountsParams = {},
): Promise<{
  items: AccountListItem[];
  meta?: { cursor?: string; hasMore?: boolean; total?: number };
}> {
  const queryParams: Record<string, unknown> = { ...params };
  // Convert boolean params to strings for query
  if (params.isActive !== undefined) queryParams.isActive = String(params.isActive);
  if (params.isPostable !== undefined) queryParams.isPostable = String(params.isPostable);
  if (params.tree !== undefined) queryParams.tree = String(params.tree);

  const qs = buildQueryString(queryParams);
  const result: ApiResult<AccountListItem[]> = await apiGet(`/finance/accounts${qs}`);
  return { items: result.data, meta: result.meta };
}

// ---------------------------------------------------------------------------
// List accounts tree (?tree=true)
// ---------------------------------------------------------------------------

export async function listAccountsTree(
  params: Omit<ListAccountsParams, 'tree'> = {},
): Promise<AccountTreeNode[]> {
  const queryParams: Record<string, unknown> = { ...params, tree: 'true' };
  if (params.isActive !== undefined) queryParams.isActive = String(params.isActive);
  if (params.isPostable !== undefined) queryParams.isPostable = String(params.isPostable);

  const qs = buildQueryString(queryParams);
  const result: ApiResult<AccountTreeNode[]> = await apiGet(`/finance/accounts${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Search accounts
// ---------------------------------------------------------------------------

export async function searchAccounts(params: SearchAccountsParams): Promise<AccountListItem[]> {
  const qs = buildQueryString(params as unknown as Record<string, unknown>);
  const result: ApiResult<AccountListItem[]> = await apiGet(`/finance/accounts/search${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Get single account
// ---------------------------------------------------------------------------

export async function getAccount(id: string): Promise<AccountDetail> {
  const result = await apiGet<AccountDetail>(`/finance/accounts/${encodeURIComponent(id)}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Create account
// ---------------------------------------------------------------------------

export async function createAccount(input: CreateAccountInput): Promise<AccountDetail> {
  const result = await apiPost<AccountDetail>('/finance/accounts', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// Update account
// ---------------------------------------------------------------------------

export async function updateAccount(id: string, input: UpdateAccountInput): Promise<AccountDetail> {
  const result = await apiPatch<AccountDetail>(
    `/finance/accounts/${encodeURIComponent(id)}`,
    input,
  );
  return result.data;
}
