// ---------------------------------------------------------------------------
// ConfirmationDialog — Reusable confirmation dialog with optional reason input
// Uses shadcn AlertDialog. When requireReason is true, Confirm is disabled
// until a non-empty reason is entered (BR-PLT-001).
// Story: E13b.2 Task 1.4
// ---------------------------------------------------------------------------

import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmationDialogProps {
  open: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  requireReason?: boolean;
  loading?: boolean;
}

export function ConfirmationDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  requireReason = false,
  loading = false,
}: ConfirmationDialogProps) {
  const [reason, setReason] = useState('');

  const canConfirm = !requireReason || reason.trim().length > 0;

  function handleConfirm() {
    if (!canConfirm || loading) return;
    onConfirm(requireReason ? reason.trim() : undefined);
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setReason('');
      onCancel();
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {requireReason && (
          <div className="px-0">
            <label htmlFor="confirmation-reason" className="mb-1.5 block text-sm font-medium">
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              id="confirmation-reason"
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </AlertDialogCancel>
          <Button variant={variant} onClick={handleConfirm} disabled={!canConfirm || loading}>
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
