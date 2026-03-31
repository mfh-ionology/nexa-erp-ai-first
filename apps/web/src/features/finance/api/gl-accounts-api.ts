/**
 * GL Accounts lookup API — lightweight for account pickers.
 *
 * Used by account mappings and bank account forms to search GL accounts.
 */

import { apiGet, buildQueryString } from '@/lib/api-client';

import type { AccountListItem } from '../types';

export interface GlAccountLookupParams {
  search?: string;
  isActive?: boolean;
  isPostable?: boolean;
  limit?: number;
}

export async function searchGlAccounts(
  params: GlAccountLookupParams = {},
): Promise<AccountListItem[]> {
  const qs = buildQueryString({
    ...params,
    isActive: params.isActive ?? true,
    limit: params.limit ?? 50,
  } as Record<string, unknown>);
  const result = await apiGet<AccountListItem[]>(`/finance/accounts${qs}`);
  return result.data;
}
