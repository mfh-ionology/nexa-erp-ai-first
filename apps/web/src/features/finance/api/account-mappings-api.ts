/**
 * Account Mappings API client functions.
 *
 * Endpoints:
 *   GET  /finance/account-mappings       — fetch all mapping types with assigned accounts
 *   PUT  /finance/account-mappings       — update mappings (batch)
 *   POST /finance/account-mappings/reset — reset all mappings to defaults
 */

import { apiGet, apiPut, apiPost } from '@/lib/api-client';

import type { AccountMapping, UpdateAccountMappingInput } from '../types';

// ---------------------------------------------------------------------------
// GET /finance/account-mappings
// ---------------------------------------------------------------------------

export async function getAccountMappings(): Promise<AccountMapping[]> {
  const result = await apiGet<AccountMapping[]>('/finance/account-mappings');
  return result.data;
}

// ---------------------------------------------------------------------------
// PUT /finance/account-mappings
// ---------------------------------------------------------------------------

export async function updateAccountMappings(
  input: UpdateAccountMappingInput,
): Promise<AccountMapping[]> {
  const result = await apiPut<AccountMapping[]>('/finance/account-mappings', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/account-mappings/reset
// ---------------------------------------------------------------------------

export async function resetAccountMappings(): Promise<AccountMapping[]> {
  const result = await apiPost<AccountMapping[]>('/finance/account-mappings/reset');
  return result.data;
}
