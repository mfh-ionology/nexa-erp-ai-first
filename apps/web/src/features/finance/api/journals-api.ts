/**
 * Journal Entry API client functions.
 *
 * Endpoints from E14-API journal routes:
 *   GET    /finance/journals           — list journal entries with filters + pagination
 *   GET    /finance/journals/search    — text search on entryNumber, description, reference
 *   GET    /finance/journals/:id       — journal entry detail with lines
 *   POST   /finance/journals           — create a draft journal entry
 *   PATCH  /finance/journals/:id       — update a draft journal entry
 *   POST   /finance/journals/:id/post  — post a draft journal entry
 *   POST   /finance/journals/:id/reverse — reverse a posted journal entry
 */

import { apiGet, apiPost, apiPatch, buildQueryString } from '@/lib/api-client';
import type { ApiResult } from '@/lib/api-client';

import type {
  JournalListItem,
  JournalDetail,
  ListJournalsParams,
  CreateJournalInput,
  UpdateJournalInput,
} from './journals-types';

// ---------------------------------------------------------------------------
// GET /finance/journals — list with cursor pagination
// ---------------------------------------------------------------------------

export async function listJournals(
  params: ListJournalsParams = {},
): Promise<ApiResult<JournalListItem[]>> {
  const qs = buildQueryString(params as Record<string, unknown>);
  return apiGet<JournalListItem[]>(`/finance/journals${qs}`);
}

// ---------------------------------------------------------------------------
// GET /finance/journals/search — text search
// ---------------------------------------------------------------------------

export async function searchJournals(
  search: string,
  params: { status?: string; source?: string; limit?: number } = {},
): Promise<JournalListItem[]> {
  const qs = buildQueryString({ search, ...params } as Record<string, unknown>);
  const result = await apiGet<JournalListItem[]>(`/finance/journals/search${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// GET /finance/journals/:id — detail with lines
// ---------------------------------------------------------------------------

export async function getJournal(id: string): Promise<JournalDetail> {
  const result = await apiGet<JournalDetail>(`/finance/journals/${encodeURIComponent(id)}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/journals — create a draft
// ---------------------------------------------------------------------------

export async function createJournal(input: CreateJournalInput): Promise<JournalDetail> {
  const result = await apiPost<JournalDetail>('/finance/journals', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// PATCH /finance/journals/:id — update a draft
// ---------------------------------------------------------------------------

export async function updateJournal(id: string, input: UpdateJournalInput): Promise<JournalDetail> {
  const result = await apiPatch<JournalDetail>(
    `/finance/journals/${encodeURIComponent(id)}`,
    input,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/journals/:id/post — post a draft entry
// ---------------------------------------------------------------------------

export async function postJournal(id: string): Promise<JournalDetail> {
  const result = await apiPost<JournalDetail>(`/finance/journals/${encodeURIComponent(id)}/post`);
  return result.data;
}

// ---------------------------------------------------------------------------
// POST /finance/journals/:id/reverse — reverse a posted entry
// ---------------------------------------------------------------------------

export async function reverseJournal(id: string): Promise<JournalDetail> {
  const result = await apiPost<JournalDetail>(
    `/finance/journals/${encodeURIComponent(id)}/reverse`,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// GET /finance/accounts/search — search accounts for picker
// ---------------------------------------------------------------------------

export interface AccountSearchResult {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isPostable: boolean;
  isControl: boolean;
}

export async function searchAccounts(search: string, limit = 20): Promise<AccountSearchResult[]> {
  const qs = buildQueryString({ search, limit } as Record<string, unknown>);
  const result = await apiGet<AccountSearchResult[]>(`/finance/accounts/search${qs}`);
  return result.data;
}
