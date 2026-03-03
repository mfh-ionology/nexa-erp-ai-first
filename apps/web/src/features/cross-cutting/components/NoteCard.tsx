/**
 * Single note display card for the NotesPanel timeline.
 *
 * - Type badge colour-coded: General grey, Internal blue, Customer Visible green, System purple
 * - Pin indicator for pinned notes
 * - Action overflow menu: Edit (own notes, not SYSTEM), Delete (MANAGER only), Pin/Unpin
 * - Edit mode: inline content editing with Save/Cancel
 * - System notes: read-only, no actions, italic styling
 */

import { useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import type { Note, NoteType } from '../types';

// ---------------------------------------------------------------------------
// Type badge configuration
// ---------------------------------------------------------------------------

const NOTE_TYPE_STYLES: Record<NoteType, string> = {
  GENERAL: 'bg-gray-100 text-gray-700',
  INTERNAL: 'bg-blue-100 text-blue-700',
  CUSTOMER_VISIBLE: 'bg-green-100 text-green-700',
  SYSTEM: 'bg-purple-100 text-purple-700',
};

const NOTE_TYPE_LABEL_KEYS: Record<NoteType, string> = {
  GENERAL: 'crossCutting.notes.typeGeneral',
  INTERNAL: 'crossCutting.notes.typeInternal',
  CUSTOMER_VISIBLE: 'crossCutting.notes.typeCustomerVisible',
  SYSTEM: 'crossCutting.notes.typeSystem',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NoteCardProps {
  note: Note;
  currentUserId: string;
  canDelete: boolean;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, isPinned: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NoteCard({
  note,
  currentUserId,
  canDelete,
  onEdit,
  onDelete,
  onPin,
}: NoteCardProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isSystem = note.noteType === 'SYSTEM';
  const isOwnNote = note.createdBy === currentUserId;
  const canEdit = isOwnNote && !isSystem;
  // Non-system notes always show the overflow menu (at minimum, pin/unpin is available)
  const showOverflowMenu = !isSystem;

  const relativeTime = formatDistanceToNow(new Date(note.createdAt), {
    addSuffix: true,
  });

  const handleSaveEdit = useCallback(() => {
    if (editContent.trim() && editContent.trim() !== note.content) {
      onEdit(note.id, editContent.trim());
    }
    setIsEditing(false);
  }, [editContent, note.content, note.id, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditContent(note.content);
    setIsEditing(false);
  }, [note.content]);

  const handleStartEdit = useCallback(() => {
    setEditContent(note.content);
    setIsEditing(true);
  }, [note.content]);

  return (
    <>
      <div
        className={`group relative rounded-xl border p-4 transition-all ${
          isSystem
            ? 'bg-muted/30 border-muted'
            : 'bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]'
        }`}
      >
        {/* Header: badge + pin + author + time + actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge
              variant="outline"
              className={`border-0 text-[10px] font-semibold uppercase tracking-wider ${NOTE_TYPE_STYLES[note.noteType]}`}
            >
              {t(NOTE_TYPE_LABEL_KEYS[note.noteType])}
            </Badge>

            {note.isPinned && (
              <Pin
                className="size-3.5 text-primary shrink-0"
                aria-label={t('crossCutting.notes.pinned')}
              />
            )}
          </div>

          {/* Overflow menu — hidden for SYSTEM notes */}
          {showOverflowMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                  aria-label={t('crossCutting.notes.actions')}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {canEdit && (
                  <DropdownMenuItem onClick={handleStartEdit}>
                    <Pencil className="mr-2 size-3.5" />
                    {t('common:edit')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onPin(note.id, note.isPinned)}>
                  {note.isPinned ? (
                    <>
                      <PinOff className="mr-2 size-3.5" />
                      {t('crossCutting.notes.unpin')}
                    </>
                  ) : (
                    <>
                      <Pin className="mr-2 size-3.5" />
                      {t('crossCutting.notes.pin')}
                    </>
                  )}
                </DropdownMenuItem>
                {canDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    {t('common:delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Author + timestamp */}
        <p className="text-xs text-muted-foreground mb-2">
          {note.createdByName ?? note.createdBy}
          {' \u00B7 '}
          {relativeTime}
        </p>

        {/* Content — edit mode or read-only */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                {t('common:cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editContent.trim() || editContent.trim() === note.content}
              >
                {t('common:save')}
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={`text-sm whitespace-pre-wrap break-words ${
              isSystem ? 'italic text-muted-foreground' : ''
            }`}
          >
            {note.content}
          </p>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('crossCutting.notes.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('crossCutting.notes.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete(note.id);
                setShowDeleteConfirm(false);
              }}
            >
              {t('common:delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
