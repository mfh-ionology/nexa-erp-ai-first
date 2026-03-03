/**
 * Note API client functions.
 *
 * Endpoints from E8.2 note routes:
 *   POST   /notes          — create note
 *   GET    /notes          — list notes for entity
 *   PATCH  /notes/:id      — update note
 *   DELETE /notes/:id      — soft-delete note
 *   PATCH  /notes/:id/pin  — toggle pin
 */

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';

import type { Note, NoteType, CreateNoteInput, UpdateNoteInput, ListResponse } from '../types';

// ---------------------------------------------------------------------------
// Create note
// ---------------------------------------------------------------------------

export async function createNote(input: CreateNoteInput): Promise<Note> {
  const result = await apiPost<Note>('/notes', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// List notes
// ---------------------------------------------------------------------------

export async function listNotes(
  entityType: string,
  entityId: string,
  noteType?: NoteType,
  limit?: number,
  offset?: number,
): Promise<ListResponse<Note>> {
  const qs = buildQueryString({ entityType, entityId, noteType, limit, offset });
  const result = await apiGet<ListResponse<Note>>(`/notes${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Update note
// ---------------------------------------------------------------------------

export async function updateNote(noteId: string, input: UpdateNoteInput): Promise<Note> {
  const result = await apiPatch<Note>(`/notes/${encodeURIComponent(noteId)}`, input);
  return result.data;
}

// ---------------------------------------------------------------------------
// Delete note
// ---------------------------------------------------------------------------

export async function deleteNote(noteId: string): Promise<void> {
  await apiDelete(`/notes/${encodeURIComponent(noteId)}`);
}

// ---------------------------------------------------------------------------
// Pin / unpin note
// ---------------------------------------------------------------------------

export async function pinNote(noteId: string): Promise<Note> {
  const result = await apiPatch<Note>(`/notes/${encodeURIComponent(noteId)}/pin`);
  return result.data;
}
