import { useEffect, useState } from 'react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

import type { Memory } from '../types';

interface MemoryEditDialogProps {
  open: boolean;
  memory: Memory | null;
  onSave: (id: string, content: string) => void;
  onClose: () => void;
}

export function MemoryEditDialog({ open, memory, onSave, onClose }: MemoryEditDialogProps) {
  const { t } = useI18n('ai');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (memory) {
      setContent(memory.content);
    }
  }, [memory]);

  const hasChanged = content !== (memory?.content ?? '');
  const canSave = hasChanged && content.trim().length > 0;

  const handleSave = () => {
    if (memory && canSave) {
      onSave(memory.id, content.trim());
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="animate-step-in sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">{t('memory.editTitle')}</DialogTitle>
          <DialogDescription>{t('memory.description')}</DialogDescription>
        </DialogHeader>
        <Textarea
          className="min-h-[120px] resize-y rounded-lg border-border focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-label={t('memory.editTitle')}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-lg">
            {t('common:cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6] disabled:opacity-40"
          >
            {t('common:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
