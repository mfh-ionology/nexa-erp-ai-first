/**
 * Attachment list component rendering file rows with download/delete actions.
 *
 * - File type icons mapped from MIME type
 * - Human-readable file size (e.g. "2.4 MB")
 * - Relative upload date (e.g. "3 hours ago")
 * - Delete gated by canDelete prop (MANAGER role, per AC #8)
 */

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Download, File, Trash2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

import type { Attachment } from '../types';
import { getMimeTypeIcon, formatFileSize } from '../utils/entity-display';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AttachmentListProps {
  attachments: Attachment[];
  isLoading: boolean;
  canDelete: boolean;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttachmentList({
  attachments,
  isLoading,
  canDelete,
  onDownload,
  onDelete,
}: AttachmentListProps) {
  const { t } = useI18n();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-8 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <File className="size-12 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          {t('crossCutting.attachments.emptyState')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1">
        {attachments.map((attachment) => {
          const Icon = getMimeTypeIcon(attachment.mimeType);
          const uploadDate = formatDistanceToNow(new Date(attachment.uploadedAt), {
            addSuffix: true,
          });

          return (
            <div
              key={attachment.id}
              className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent/50 transition-colors"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-primary">
                <Icon className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{formatFileSize(attachment.fileSize)}</span>
                  {' \u00B7 '}
                  {attachment.uploadedByName ?? attachment.uploadedBy}
                  {' \u00B7 '}
                  {uploadDate}
                </p>
              </div>

              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onDownload(attachment.id)}
                  aria-label={t('crossCutting.attachments.download')}
                >
                  <Download className="size-4" />
                </Button>

                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTargetId(attachment.id)}
                    aria-label={t('crossCutting.attachments.delete')}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('crossCutting.attachments.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('crossCutting.attachments.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId) {
                  onDelete(deleteTargetId);
                  setDeleteTargetId(null);
                }
              }}
            >
              {t('crossCutting.attachments.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
