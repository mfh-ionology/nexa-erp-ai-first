/**
 * Upload progress indicator showing file name, percentage, and animated bar.
 *
 * Supports cancel (AbortController) and retry on error.
 * Uses Shadcn Progress component.
 */

import { Loader2, X, RotateCcw, CheckCircle2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePrefersReducedMotion } from '@/hooks/use-breakpoint';

import type { UploadStatus } from '../types';

interface UploadProgressBarProps {
  fileName: string;
  progress: number;
  status: UploadStatus;
  onCancel?: () => void;
  onRetry?: () => void;
}

export function UploadProgressBar({
  fileName,
  progress,
  status,
  onCancel,
  onRetry,
}: UploadProgressBarProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();

  if (status === 'idle') return null;

  const isActive = status === 'uploading' || status === 'presigning' || status === 'confirming';
  const isError = status === 'error';
  const isComplete = status === 'complete';

  const statusLabel =
    status === 'presigning'
      ? t('crossCutting.attachments.preparing')
      : status === 'uploading'
        ? `${String(progress)}%`
        : status === 'confirming'
          ? t('crossCutting.attachments.confirming')
          : status === 'complete'
            ? t('crossCutting.attachments.uploadComplete')
            : t('crossCutting.attachments.uploadFailed');

  return (
    <div className="rounded-xl border bg-card shadow-[var(--shadow-card)] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isActive && (
            <Loader2
              className={`size-4 shrink-0 text-primary${prefersReducedMotion ? '' : ' animate-spin'}`}
            />
          )}
          {isComplete && <CheckCircle2 className="size-4 shrink-0 text-green-600" />}
          <span className="text-sm truncate">{fileName}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-xs ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>
            {statusLabel}
          </span>

          {isActive && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onCancel}
              aria-label={t('crossCutting.attachments.cancelUpload')}
            >
              <X className="size-3.5" />
            </Button>
          )}

          {isError && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onRetry}
              aria-label={t('crossCutting.attachments.retryUpload')}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <Progress
        value={isError ? 100 : progress}
        className={`h-1.5 ${isError ? '[&>[data-slot=progress-indicator]]:bg-destructive' : ''}`}
      />
    </div>
  );
}
