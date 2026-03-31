/**
 * Finance Settings API client functions.
 *
 * Endpoints from E14-API finance settings routes:
 *   GET  /finance/settings       — return all settings grouped by tab
 *   PUT  /finance/settings       — update settings (partial tabs)
 *   POST /finance/settings/reset — reset all settings to defaults
 */

import { apiGet, apiPut, apiPost } from '@/lib/api-client';

import type { FinanceSettings, UpdateFinanceSettingsInput } from '../types';

// ---------------------------------------------------------------------------
// GET /finance/settings — fetch all finance settings
// ---------------------------------------------------------------------------

export async function getFinanceSettings(): Promise<FinanceSettings> {
  const result = await apiGet<FinanceSettings>('/finance/settings');
  return result.data;
}

// ---------------------------------------------------------------------------
// PUT /finance/settings — update finance settings (partial tabs)
// ---------------------------------------------------------------------------

export async function updateFinanceSettings(
  input: UpdateFinanceSettingsInput,
): Promise<FinanceSettings> {
  const result = await apiPut<FinanceSettings>('/finance/settings', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/settings/reset — reset to defaults
// ---------------------------------------------------------------------------

export async function resetFinanceSettings(): Promise<FinanceSettings> {
  const result = await apiPost<FinanceSettings>('/finance/settings/reset');
  return result.data;
}
