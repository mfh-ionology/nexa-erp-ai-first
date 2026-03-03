/**
 * React Query hooks for the Attachment API.
 *
 * - useAttachments: list query
 * - useUploadAttachment: presign → S3 PUT → confirm orchestration
 * - useDownloadAttachment: presigned GET URL → open in new tab
 * - useDeleteAttachment: delete mutation with cache invalidation
 */

import { useCallback, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import {
  listAttachments,
  presignUpload,
  confirmUpload,
  getDownloadUrl,
  deleteAttachment,
} from '../api/attachment-api';
import type { Attachment, ListResponse, UploadProgress } from '../types';

// ---------------------------------------------------------------------------
// useAttachments — list query
// ---------------------------------------------------------------------------

export function useAttachments(entityType: string, entityId: string) {
  const query = useQuery<ListResponse<Attachment>>({
    queryKey: queryKeys.attachments.list(entityType, entityId),
    queryFn: () => listAttachments(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });

  return {
    attachments: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// useAttachmentCount — lightweight count-only query (limit=0)
// ---------------------------------------------------------------------------

export function useAttachmentCount(entityType: string, entityId: string) {
  const query = useQuery<ListResponse<Attachment>, Error, number>({
    queryKey: queryKeys.attachments.count(entityType, entityId),
    queryFn: () => listAttachments(entityType, entityId, 0),
    enabled: !!entityType && !!entityId,
    select: (data) => data.total,
  });

  return query.data ?? 0;
}

// ---------------------------------------------------------------------------
// useUploadAttachment — presign → S3 PUT → confirm
// ---------------------------------------------------------------------------

export function useUploadAttachment(entityType: string, entityId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    fileName: '',
    progress: 0,
    status: 'idle',
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const upload = useCallback(
    async (file: File) => {
      lastFileRef.current = file;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Step 1: Presign
        setUploadProgress({ fileName: file.name, progress: 0, status: 'presigning' });

        const presignResult = await presignUpload({
          entityType,
          entityId,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
        });

        if (abortController.signal.aborted) return;

        // Step 2: Direct S3 upload via XMLHttpRequest (for progress events)
        setUploadProgress({ fileName: file.name, progress: 0, status: 'uploading' });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const pct = Math.round((event.loaded / event.total) * 100);
              setUploadProgress({ fileName: file.name, progress: pct, status: 'uploading' });
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${String(xhr.status)}`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));

          abortController.signal.addEventListener('abort', () => {
            xhr.abort();
            reject(new Error('Upload cancelled'));
          });

          xhr.open('PUT', presignResult.uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.send(file);
        });

        if (abortController.signal.aborted) return;

        // Step 3: Confirm upload
        setUploadProgress({ fileName: file.name, progress: 100, status: 'confirming' });

        await confirmUpload({
          storageKey: presignResult.storageKey,
          entityType,
          entityId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
        });

        setUploadProgress({ fileName: file.name, progress: 100, status: 'complete' });

        // Invalidate list and count queries so they refresh
        await queryClient.invalidateQueries({
          queryKey: queryKeys.attachments.list(entityType, entityId),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.attachments.count(entityType, entityId),
        });
      } catch (err) {
        if (abortController.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : t('crossCutting.attachments.uploadFailed');
        setUploadProgress({ fileName: file.name, progress: 0, status: 'error', error: message });
        toast({ title: t('crossCutting.attachments.uploadFailed'), variant: 'destructive' });
      } finally {
        abortControllerRef.current = null;
      }
    },
    [entityType, entityId, queryClient, t],
  );

  const cancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    setUploadProgress((prev) => ({ ...prev, status: 'idle', progress: 0 }));
  }, []);

  const resetProgress = useCallback(() => {
    setUploadProgress({ fileName: '', progress: 0, status: 'idle' });
    lastFileRef.current = null;
  }, []);

  const retry = useCallback(() => {
    const file = lastFileRef.current;
    if (file) {
      void upload(file);
    }
  }, [upload]);

  return {
    upload,
    cancelUpload,
    resetProgress,
    retry,
    isUploading:
      uploadProgress.status === 'uploading' ||
      uploadProgress.status === 'presigning' ||
      uploadProgress.status === 'confirming',
    progress: uploadProgress,
  };
}

// ---------------------------------------------------------------------------
// useDownloadAttachment — fetch presigned URL and open in new tab
// ---------------------------------------------------------------------------

export function useDownloadAttachment() {
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const result = await getDownloadUrl(attachmentId);
      window.open(result.downloadUrl, '_blank');
    },
    onError: () => {
      toast({ title: t('crossCutting.attachments.downloadFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteAttachment — delete with cache invalidation
// ---------------------------------------------------------------------------

export function useDeleteAttachment(entityType: string, entityId: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.list(entityType, entityId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.count(entityType, entityId),
      });
    },
    onError: () => {
      toast({ title: t('crossCutting.attachments.deleteFailed'), variant: 'destructive' });
    },
  });
}
