/**
 * System module API functions.
 *
 * Covers company listing and permission fetching needed
 * by the company switcher and navigation shell.
 */

import { apiGet } from './api-client';

// Re-export fetchMyPermissions from auth-api so consumers
// can import system-level helpers from a single module.
export { fetchMyPermissions } from './auth-api';

// --- Types ---

export interface Company {
  id: string;
  name: string;
  slug: string;
  baseCurrencyCode: string;
  isDefault: boolean;
}

// --- API functions ---

/**
 * Fetch all companies the current user has access to.
 * Endpoint: GET /system/companies
 */
export async function fetchCompanies(): Promise<Company[]> {
  const { data } = await apiGet<Company[]>('/system/companies');
  return data;
}
