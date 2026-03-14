/**
 * Favourite pages API client functions.
 *
 * Consumes the backend system/favourite-pages endpoints:
 *   GET    /system/favourite-pages             — list user's pinned pages
 *   POST   /system/favourite-pages             — pin a page
 *   DELETE /system/favourite-pages/:id          — unpin by ID
 *   POST   /system/favourite-pages/unpin-by-path — unpin by path
 *   PUT    /system/favourite-pages/reorder      — reorder pins
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';

import type { FavouritePage, CreateFavouritePageInput } from './types';

const BASE = '/system/favourite-pages';

export async function fetchFavouritePages(): Promise<FavouritePage[]> {
  const result = await apiGet<FavouritePage[]>(BASE);
  return result.data;
}

export async function pinPage(input: CreateFavouritePageInput): Promise<FavouritePage> {
  const result = await apiPost<FavouritePage>(BASE, input);
  return result.data;
}

export async function unpinPage(id: string): Promise<void> {
  await apiDelete(`${BASE}/${encodeURIComponent(id)}`);
}

export async function unpinPageByPath(path: string): Promise<void> {
  await apiPost(`${BASE}/unpin-by-path`, { path });
}

export async function reorderPages(orderedIds: string[]): Promise<void> {
  await apiPut(`${BASE}/reorder`, { orderedIds });
}
