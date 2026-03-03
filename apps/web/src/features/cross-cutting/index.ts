/**
 * Cross-cutting feature module — barrel exports.
 *
 * Provides attachment, note, and record link components, hooks,
 * and types for use across all record detail pages.
 */

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export { AttachmentPanel } from './components/AttachmentPanel';
export { NotesPanel } from './components/NotesPanel';
export { LinksPanel } from './components/LinksPanel';
export { CrossCuttingPanels } from './components/CrossCuttingPanels';
export { NotesTab } from './components/NotesTab';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export {
  useAttachments,
  useAttachmentCount,
  useUploadAttachment,
  useDownloadAttachment,
  useDeleteAttachment,
} from './hooks/use-attachments';
export {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  usePinNote,
} from './hooks/use-notes';
export {
  useRecordLinks,
  useRecordLinkCount,
  useCreateRecordLink,
  useDeleteRecordLink,
} from './hooks/use-record-links';
export { useCrossCuttingPanels } from './hooks/use-cross-cutting-panels';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  Attachment,
  Note,
  NoteType,
  CreateNoteType,
  RecordLink,
  RecordLinkType,
  LinkDirection,
  UploadProgress,
  UploadStatus,
  ListResponse,
  PresignResponse,
  DownloadResponse,
  PresignUploadInput,
  ConfirmUploadInput,
  CreateNoteInput,
  UpdateNoteInput,
  CreateRecordLinkInput,
} from './types';
