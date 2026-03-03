import { useI18n } from '@nexa/i18n';

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

import type { Memory } from '../types';

interface MemoryDeleteDialogProps {
  open: boolean;
  memory: Memory | null;
  onConfirm: (id: string) => void;
  onClose: () => void;
}

export function MemoryDeleteDialog({ open, memory, onConfirm, onClose }: MemoryDeleteDialogProps) {
  const { t } = useI18n('ai');

  const handleConfirm = () => {
    if (memory) {
      onConfirm(memory.id);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <AlertDialogContent className="animate-step-in sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif">{t('memory.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('memory.deleteConfirm')}</AlertDialogDescription>
          {memory && (
            <p className="mt-2 rounded-lg bg-muted/50 p-3 text-xs italic text-muted-foreground">
              &ldquo;
              {memory.content.length > 120 ? `${memory.content.slice(0, 120)}...` : memory.content}
              &rdquo;
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg">{t('common:cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c]"
          >
            {t('common:delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
