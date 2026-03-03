import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const presignRequestSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.uuid(),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive(),
});

export const confirmRequestSchema = z.object({
  storageKey: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.uuid(),
  fileName: z.string().min(1).max(200),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  description: z.string().max(500).optional(),
});

export const attachmentListQuerySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.uuid(),
  limit: z.coerce.number().int().min(1).max(200).default(100).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export const attachmentParamsSchema = z.object({
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const presignResponseSchema = z.object({
  uploadUrl: z.string(),
  storageKey: z.string(),
  bucket: z.string(),
  expiresIn: z.number(),
});

export const attachmentResponseSchema = z.object({
  id: z.uuid(),
  entityType: z.string(),
  entityId: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  storageKey: z.string(),
  storageBucket: z.string(),
  description: z.string().nullable(),
  uploadedBy: z.string(),
  uploadedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const downloadResponseSchema = z.object({
  downloadUrl: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
});

export const attachmentListResponseSchema = z.object({
  items: z.array(attachmentResponseSchema),
  total: z.number().int(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type PresignRequest = z.infer<typeof presignRequestSchema>;
export type ConfirmRequest = z.infer<typeof confirmRequestSchema>;
export type AttachmentListQuery = z.infer<typeof attachmentListQuerySchema>;
export type AttachmentParams = z.infer<typeof attachmentParamsSchema>;
export type PresignResponse = z.infer<typeof presignResponseSchema>;
export type AttachmentResponse = z.infer<typeof attachmentResponseSchema>;
export type DownloadResponse = z.infer<typeof downloadResponseSchema>;
