/**
 * Notes timeline panel for record detail pages.
 *
 * Rendered as tab content within RecordDetailPage (AC #3 — "Notes tab or section").
 * NOT a Sheet overlay — notes live inline as part of the record.
 *
 * - Pinned notes first, then reverse chronological
 * - Timeline connector line between cards
 * - AddNoteForm at top
 * - Empty/loading states
 * - Permission-gated actions (edit own only, delete MANAGER only)
 */

import { useCallback, useMemo } from 'react';
import { MessageSquare } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/hooks/use-permissions';
import { useAuthStore } from '@/stores/auth-store';

import { useNotes, useUpdateNote, useDeleteNote, usePinNote } from '../hooks/use-notes';

import { AddNoteForm } from './AddNoteForm';
import { NoteCard } from './NoteCard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotesPanelProps {
  entityType: string;
  entityId: string;
  resourceCode: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotesPanel({ entityType, entityId, resourceCode }: NotesPanelProps) {
  const { t } = useI18n();
  const currentUserId = useAuthStore((s) => s.user?.id ?? '');
  const { canDelete } = usePermission(resourceCode);

  const { notes, total, isLoading } = useNotes(entityType, entityId);
  const updateNote = useUpdateNote(entityType, entityId);
  const deleteNote = useDeleteNote(entityType, entityId);
  const pinNote = usePinNote(entityType, entityId);

  // Sort: pinned first, then reverse chronological
  const sortedNotes = useMemo(() => {
    const pinned = notes.filter((n) => n.isPinned);
    const unpinned = notes.filter((n) => !n.isPinned);

    const byDateDesc = (a: { createdAt: string }, b: { createdAt: string }) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    return [...pinned.sort(byDateDesc), ...unpinned.sort(byDateDesc)];
  }, [notes]);

  const handleEdit = useCallback(
    (noteId: string, content: string) => {
      updateNote.mutate({ noteId, input: { content } });
    },
    [updateNote],
  );

  const handleDelete = useCallback(
    (noteId: string) => {
      deleteNote.mutate(noteId);
    },
    [deleteNote],
  );

  const handlePin = useCallback(
    (noteId: string, _isPinned: boolean) => {
      pinNote.mutate(noteId);
    },
    [pinNote],
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-9 w-full rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header with count */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold font-serif">{t('crossCutting.notes.title')}</h3>
        {total > 0 && (
          <Badge variant="secondary" className="text-xs">
            {total}
          </Badge>
        )}
      </div>

      {/* Add note form */}
      <AddNoteForm entityType={entityType} entityId={entityId} />

      {/* Timeline */}
      <div aria-live="polite" aria-relevant="additions removals">
        {sortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="size-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {t('crossCutting.notes.emptyState')}
            </p>
          </div>
        ) : (
          <div className="relative space-y-3">
            {/* Timeline connector line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" aria-hidden="true" />

            {sortedNotes.map((note) => (
              <div key={note.id} className="relative pl-8">
                {/* Timeline dot */}
                <div
                  className="absolute left-[17px] top-5 size-2 rounded-full bg-primary ring-2 ring-background"
                  aria-hidden="true"
                />
                <NoteCard
                  note={note}
                  currentUserId={currentUserId}
                  canDelete={canDelete}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPin={handlePin}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
