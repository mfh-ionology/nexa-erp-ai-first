import { useState } from 'react';
import { useI18n } from '@nexa/i18n';
import { AlertTriangle } from 'lucide-react';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ForgetAllDialogProps {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ForgetAllDialog({ open, onConfirm, onClose }: ForgetAllDialogProps) {
  const { t } = useI18n('ai');
  const [confirmText, setConfirmText] = useState('');

  const confirmWord = t('memory.forgetAllConfirmWord');
  const canConfirm = confirmText === confirmWord;

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  const handleConfirm = () => {
    if (canConfirm) {
      setConfirmText('');
      onConfirm();
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <AlertDialogContent className="animate-step-in sm:max-w-sm">
        <AlertDialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#fee2e2]">
            <AlertTriangle className="h-5 w-5 text-[#dc2626]" aria-hidden="true" />
          </div>
          <AlertDialogTitle className="font-serif text-[#dc2626]">
            {t('memory.forgetAllTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('memory.forgetAllBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div>
          <Label htmlFor="forget-confirm-input" className="text-sm text-foreground">
            {t('memory.forgetAllConfirmLabel')}
          </Label>
          <Input
            id="forget-confirm-input"
            className="mt-2 rounded-lg border-[#fecaca] font-mono focus-visible:ring-2 focus-visible:ring-[#dc2626]/30"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            aria-label={t('memory.forgetAllConfirmLabel')}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose} className="rounded-lg">
            {t('common:cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c] disabled:pointer-events-none disabled:opacity-40"
          >
            {t('memory.forgetAllTitle')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
