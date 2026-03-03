/**
 * Shared TypeScript types for the cross-cutting feature module.
 *
 * Mirrors backend schemas from E8.1 (Attachment), E8.2 (Note),
 * E8.3 (RecordLink) to ensure frontend type safety.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type NoteType = 'GENERAL' | 'INTERNAL' | 'CUSTOMER_VISIBLE' | 'SYSTEM';

/** Subset of NoteType available for user creation (SYSTEM excluded per AC #4). */
export type CreateNoteType = 'GENERAL' | 'INTERNAL' | 'CUSTOMER_VISIBLE';

export type RecordLinkType =
  | 'CREATED_FROM'
  | 'FULFILLS'
  | 'PAYMENT_FOR'
  | 'CREDIT_FOR'
  | 'RELATES_TO'
  | 'PARENT_CHILD';

export type LinkDirection = 'outgoing' | 'incoming';

// ---------------------------------------------------------------------------
// Attachment types
// ---------------------------------------------------------------------------

export interface Attachment {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  storageBucket: string;
  description: string | null;
  uploadedBy: string;
  /** Display name resolved by backend; falls back to uploadedBy when absent. */
  uploadedByName?: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresignResponse {
  uploadUrl: string;
  storageKey: string;
  bucket: string;
  expiresIn: number;
}

export interface DownloadResponse {
  downloadUrl: string;
  fileName: string;
  mimeType: string;
}

export interface PresignUploadInput {
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface ConfirmUploadInput {
  storageKey: string;
  entityType: string;
  entityId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Note types
// ---------------------------------------------------------------------------

export interface Note {
  id: string;
  entityType: string;
  entityId: string;
  noteType: NoteType;
  classification: string | null;
  title: string | null;
  content: string;
  isPinned: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Display name resolved by backend; falls back to createdBy when absent. */
  createdByName?: string;
  updatedBy: string;
}

export interface CreateNoteInput {
  entityType: string;
  entityId: string;
  noteType?: CreateNoteType;
  content: string;
  title?: string;
}

export interface UpdateNoteInput {
  content?: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// RecordLink types
// ---------------------------------------------------------------------------

export interface RecordLink {
  id: string;
  sourceEntityType: string;
  sourceEntityId: string;
  targetEntityType: string;
  targetEntityId: string;
  linkType: RecordLinkType;
  isSystemGenerated: boolean;
  description: string | null;
  direction?: LinkDirection;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecordLinkInput {
  sourceEntityType: string;
  sourceEntityId: string;
  targetEntityType: string;
  targetEntityId: string;
  linkType: RecordLinkType;
  description?: string;
}

// ---------------------------------------------------------------------------
// List response wrapper (common shape from API envelope)
// ---------------------------------------------------------------------------

export interface ListResponse<T> {
  items: T[];
  total: number;
}

// ---------------------------------------------------------------------------
// Upload progress tracking
// ---------------------------------------------------------------------------

export type UploadStatus =
  | 'idle'
  | 'presigning'
  | 'uploading'
  | 'confirming'
  | 'error'
  | 'complete';

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: UploadStatus;
  error?: string;
}
