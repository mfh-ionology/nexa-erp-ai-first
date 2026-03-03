/**
 * Record Link API client functions.
 *
 * Endpoints from E8.3 record-link routes:
 *   POST   /record-links     — create record link
 *   GET    /record-links     — list record links for entity
 *   DELETE /record-links/:id — delete record link
 */

import { apiGet, apiPost, apiDelete, buildQueryString } from '@/lib/api-client';

import type {
  RecordLink,
  RecordLinkType,
  LinkDirection,
  CreateRecordLinkInput,
  ListResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Create record link
// ---------------------------------------------------------------------------

export async function createRecordLink(input: CreateRecordLinkInput): Promise<RecordLink> {
  const result = await apiPost<RecordLink>('/record-links', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// List record links
// ---------------------------------------------------------------------------

export async function listRecordLinks(
  entityType: string,
  entityId: string,
  direction?: LinkDirection | 'all',
  linkType?: RecordLinkType,
  limit?: number,
  offset?: number,
): Promise<ListResponse<RecordLink>> {
  const qs = buildQueryString({ entityType, entityId, direction, linkType, limit, offset });
  const result = await apiGet<ListResponse<RecordLink>>(`/record-links${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Delete record link
// ---------------------------------------------------------------------------

export async function deleteRecordLink(linkId: string): Promise<void> {
  await apiDelete(`/record-links/${encodeURIComponent(linkId)}`);
}
