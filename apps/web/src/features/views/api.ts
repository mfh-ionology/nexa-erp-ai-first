/**
 * Views feature API functions.
 *
 * Consumes the backend views module endpoints (§3.13 API Contracts).
 * All functions return unwrapped data via the shared API client.
 */

import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/lib/api-client';

import type {
  ViewInitResponse,
  SavedViewDto,
  FavouriteViewDto,
  CreateSavedViewRequest,
  UpdateSavedViewRequest,
  ColumnPrefInput,
  LovStaticValue,
} from './types';

// ---------------------------------------------------------------------------
// Init — bundled endpoint
// ---------------------------------------------------------------------------

export async function fetchViewInit(viewKey: string): Promise<ViewInitResponse> {
  const result = await apiGet<ViewInitResponse>(
    `/views/init?viewKey=${encodeURIComponent(viewKey)}`,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// Saved view CRUD
// ---------------------------------------------------------------------------

export async function createSavedView(data: CreateSavedViewRequest): Promise<SavedViewDto> {
  const result = await apiPost<SavedViewDto>('/views/saved', data);
  return result.data;
}

export async function updateSavedView(
  id: string,
  data: UpdateSavedViewRequest,
): Promise<SavedViewDto> {
  const result = await apiPatch<SavedViewDto>(`/views/saved/${encodeURIComponent(id)}`, data);
  return result.data;
}

export async function deleteSavedView(id: string): Promise<void> {
  await apiDelete(`/views/saved/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Favourites & defaults
// ---------------------------------------------------------------------------

/** Fetch all favourite views across ALL data_views for the current user. */
export async function fetchFavourites(): Promise<FavouriteViewDto[]> {
  const res = await apiGet<FavouriteViewDto[]>('/views/favourites');
  return res.data;
}

export async function toggleFavourite(id: string): Promise<void> {
  await apiPost(`/views/saved/${encodeURIComponent(id)}/toggle-favourite`);
}

export async function setDefault(id: string): Promise<void> {
  await apiPost(`/views/saved/${encodeURIComponent(id)}/set-default`);
}

// ---------------------------------------------------------------------------
// Column preferences
// ---------------------------------------------------------------------------

export async function bulkUpdateColumns(viewKey: string, prefs: ColumnPrefInput[]): Promise<void> {
  await apiPut(`/views/columns/${encodeURIComponent(viewKey)}`, prefs);
}

export async function updateColumnWidth(
  viewKey: string,
  fieldId: string,
  width: number,
): Promise<void> {
  await apiPatch(
    `/views/columns/${encodeURIComponent(viewKey)}/${encodeURIComponent(fieldId)}/width`,
    { width },
  );
}

// ---------------------------------------------------------------------------
// LOV (List of Values) — batch & single fetch
// ---------------------------------------------------------------------------

export interface BatchLovItem {
  fieldId: string;
  lovScope: string;
  search?: string;
  parentValue?: string;
  limit?: number;
}

/** Batch fetch all VIEW_SPECIFIC LOVs for a filter modal in a single request. */
export async function batchFetchLov(
  items: BatchLovItem[],
): Promise<Record<string, LovStaticValue[]>> {
  const res = await apiPost<{ results: Record<string, LovStaticValue[]> }>('/views/lov/batch', {
    items,
  });
  return res.data.results;
}

/** Single LOV fetch with server-side search for large LOV sets. */
export async function fetchLov(
  lovScope: string,
  search?: string,
  limit?: number,
): Promise<LovStaticValue[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const path = `/views/lov/${encodeURIComponent(lovScope)}${qs ? `?${qs}` : ''}`;
  const res = await apiGet<LovStaticValue[]>(path);
  return res.data;
}
