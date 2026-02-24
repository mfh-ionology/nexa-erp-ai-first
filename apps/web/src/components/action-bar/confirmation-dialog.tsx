import { Loader2 } from 'lucide-react';
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

export interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Close handler */
  onOpenChange: (open: boolean) => void;
  /** i18n key for dialog title (e.g., 'actionBar.confirm.voidTitle') */
  titleKey: string;
  /** i18n key for dialog description — receives {{ entityName }} */
  descriptionKey: string;
  /** Entity display name injected into description */
  entityName: string;
  /** Callback when user confirms the action */
  onConfirm: () => void;
  /** Whether the confirm action is currently processing */
  isLoading?: boolean;
  /** Variant of the confirm button */
  variant?: 'default' | 'destructive';
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  titleKey,
  descriptionKey,
  entityName,
  onConfirm,
  isLoading,
  variant = 'destructive',
}: ConfirmationDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(titleKey)}</DialogTitle>
          <DialogDescription>
            {t(descriptionKey, { entityName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t('actionBar.confirm.cancel')}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="animate-spin" />}
            {t('actionBar.confirm.button')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
