/**
 * Attachment API client functions.
 *
 * Endpoints from E8.1 attachment routes:
 *   POST /attachments/presign   — get presigned upload URL
 *   POST /attachments/confirm   — confirm upload completion
 *   GET  /attachments/:id/download — get presigned download URL
 *   DELETE /attachments/:id     — delete attachment
 *   GET  /attachments           — list attachments for entity
 */

import { apiGet, apiPost, apiDelete, buildQueryString } from '@/lib/api-client';

import type {
  Attachment,
  PresignResponse,
  DownloadResponse,
  PresignUploadInput,
  ConfirmUploadInput,
  ListResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Presign upload
// ---------------------------------------------------------------------------

export async function presignUpload(input: PresignUploadInput): Promise<PresignResponse> {
  const result = await apiPost<PresignResponse>('/attachments/presign', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// Confirm upload
// ---------------------------------------------------------------------------

export async function confirmUpload(input: ConfirmUploadInput): Promise<Attachment> {
  const result = await apiPost<Attachment>('/attachments/confirm', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// List attachments
// ---------------------------------------------------------------------------

export async function listAttachments(
  entityType: string,
  entityId: string,
  limit?: number,
  offset?: number,
): Promise<ListResponse<Attachment>> {
  const qs = buildQueryString({ entityType, entityId, limit, offset });
  const result = await apiGet<ListResponse<Attachment>>(`/attachments${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Download URL
// ---------------------------------------------------------------------------

export async function getDownloadUrl(attachmentId: string): Promise<DownloadResponse> {
  const result = await apiGet<DownloadResponse>(
    `/attachments/${encodeURIComponent(attachmentId)}/download`,
  );
  return result.data;
}

// ---------------------------------------------------------------------------
// Delete attachment
// ---------------------------------------------------------------------------

export async function deleteAttachment(attachmentId: string): Promise<void> {
  await apiDelete(`/attachments/${encodeURIComponent(attachmentId)}`);
}
