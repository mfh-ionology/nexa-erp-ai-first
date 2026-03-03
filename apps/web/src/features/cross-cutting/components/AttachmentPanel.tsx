/**
 * Attachment side panel (Sheet) for viewing, uploading, and managing attachments.
 *
 * - Wraps Shadcn Sheet (right side, 400px desktop, full-screen phone)
 * - Orchestrates upload flow: FileUploadZone → UploadProgressBar → list refresh
 * - Permission-gated delete (MANAGER role per AC #8)
 * - Keyboard: Escape closes, Tab navigates (Sheet built-in focus trap)
 */

import { useCallback } from 'react';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { usePrefersReducedMotion } from '@/hooks/use-breakpoint';
import { usePermission } from '@/hooks/use-permissions';

import {
  useAttachments,
  useUploadAttachment,
  useDownloadAttachment,
  useDeleteAttachment,
} from '../hooks/use-attachments';

import { AttachmentList } from './AttachmentList';
import { FileUploadZone } from './FileUploadZone';
import { UploadProgressBar } from './UploadProgressBar';

interface AttachmentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  resourceCode: string;
}

export function AttachmentPanel({
  open,
  onOpenChange,
  entityType,
  entityId,
  resourceCode,
}: AttachmentPanelProps) {
  const { t } = useI18n();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { canDelete } = usePermission(resourceCode);

  const { attachments, total, isLoading } = useAttachments(entityType, entityId);
  const { upload, cancelUpload, retry, isUploading, progress } = useUploadAttachment(
    entityType,
    entityId,
  );
  const downloadMutation = useDownloadAttachment();
  const deleteMutation = useDeleteAttachment(entityType, entityId);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const first = files[0];
      if (first) {
        void upload(first);
      }
    },
    [upload],
  );

  const handleDownload = useCallback(
    (id: string) => {
      downloadMutation.mutate(id);
    },
    [downloadMutation],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const handleRetry = useCallback(() => {
    retry();
  }, [retry]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full md:w-[400px] md:max-w-[400px] flex flex-col">
        <SheetHeader className="border-b border-primary/20 pb-3">
          <div className="flex items-center gap-2">
            <SheetTitle className="font-serif">{t('crossCutting.attachments.title')}</SheetTitle>
            {total > 0 && (
              <Badge variant="secondary" className="text-xs">
                {total}
              </Badge>
            )}
          </div>
          <SheetDescription className="sr-only">
            {t('crossCutting.attachments.panelDescription')}
          </SheetDescription>
        </SheetHeader>

        <div
          className={`flex-1 overflow-y-auto space-y-4 p-4 pt-3${prefersReducedMotion ? '' : ' animate-fade-in-up'}`}
        >
          <FileUploadZone onFilesSelected={handleFilesSelected} isUploading={isUploading} />

          {progress.status !== 'idle' && (
            <UploadProgressBar
              fileName={progress.fileName}
              progress={progress.progress}
              status={progress.status}
              onCancel={cancelUpload}
              onRetry={handleRetry}
            />
          )}

          <div aria-live="polite" aria-relevant="additions removals">
            <AttachmentList
              attachments={attachments}
              isLoading={isLoading}
              canDelete={canDelete}
              onDownload={handleDownload}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
