/**
 * Expandable "Add Note" form for the NotesPanel.
 *
 * - Collapsed: shows "Add Note" button with Plus icon
 * - Expanded: Textarea + type selector (General/Internal/Customer Visible) + Submit/Cancel
 * - SYSTEM type is NOT available to users (per AC #4)
 * - On submit: calls useCreateNote mutation, collapses, clears content
 */

import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCreateNote } from '../hooks/use-notes';
import type { CreateNoteType } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddNoteFormProps {
  entityType: string;
  entityId: string;
  onNoteCreated?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddNoteForm({ entityType, entityId, onNoteCreated }: AddNoteFormProps) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<CreateNoteType>('GENERAL');

  const createNote = useCreateNote(entityType, entityId);

  const handleSubmit = useCallback(() => {
    if (!content.trim()) return;

    createNote.mutate(
      { content: content.trim(), noteType },
      {
        onSuccess: () => {
          setContent('');
          setNoteType('GENERAL');
          setIsExpanded(false);
          onNoteCreated?.();
        },
      },
    );
  }, [content, noteType, createNote, onNoteCreated]);

  const handleCancel = useCallback(() => {
    setContent('');
    setNoteType('GENERAL');
    setIsExpanded(false);
  }, []);

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 text-muted-foreground"
        onClick={() => setIsExpanded(true)}
      >
        <Plus className="size-4" />
        {t('crossCutting.notes.addNote')}
      </Button>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-[var(--shadow-card)] p-4 space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t('crossCutting.notes.placeholder')}
        className="min-h-[80px] resize-none text-sm"
        autoFocus
      />

      <div className="flex items-center justify-between gap-3">
        <Select
          value={noteType}
          onValueChange={(value: string) => setNoteType(value as CreateNoteType)}
        >
          <SelectTrigger size="sm" className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GENERAL">{t('crossCutting.notes.typeGeneral')}</SelectItem>
            <SelectItem value="INTERNAL">{t('crossCutting.notes.typeInternal')}</SelectItem>
            <SelectItem value="CUSTOMER_VISIBLE">
              {t('crossCutting.notes.typeCustomerVisible')}
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            {t('common:cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || createNote.isPending}
          >
            {t('crossCutting.notes.addNote')}
          </Button>
        </div>
      </div>
    </div>
  );
}
