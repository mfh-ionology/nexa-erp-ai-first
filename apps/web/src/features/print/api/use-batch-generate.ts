/**
 * TanStack Query hooks for batch PDF generation.
 *
 * - `useBatchGenerate()` — mutation wrapping `POST /system/documents/batch-generate`
 * - `useBatchGenerateStatus(batchJobId)` — query polling `GET /system/documents/batch-generate/:batchJobId/status`
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import { apiGet, apiPost } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

import type { DocumentType } from './use-print-preferences';

// -- Types --------------------------------------------------------------------

export interface BatchGenerateInput {
  documentType: DocumentType;
  recordIds: string[];
}

export interface BatchGenerateResponse {
  batchJobId: string;
}

export type BatchJobStatus = 'waiting' | 'active' | 'completed' | 'failed';

export interface BatchGenerateStatusResponse {
  batchJobId: string;
  status: BatchJobStatus;
  total: number;
  completed: number;
  failed: number;
  errors: string[];
}

// -- Hooks --------------------------------------------------------------------

/**
 * Mutation to enqueue a batch PDF generation job.
 *
 * Calls `POST /system/documents/batch-generate` and returns `{ batchJobId }`.
 */
export function useBatchGenerate() {
  return useMutation({
    mutationFn: async (input: BatchGenerateInput) => {
      const result = await apiPost<BatchGenerateResponse>(
        '/system/documents/batch-generate',
        input,
      );
      return result.data;
    },
  });
}

/**
 * Query to poll batch generation status.
 *
 * Polls every 2 seconds while the job is still processing (`waiting` or `active`).
 * Stops polling when status is `completed` or `failed`.
 *
 * @param batchJobId - The batch job ID returned by `useBatchGenerate`. Pass `null` to disable.
 */
export function useBatchGenerateStatus(batchJobId: string | null) {
  return useQuery({
    queryKey: queryKeys.printPreferences.batchStatus(batchJobId ?? ''),
    queryFn: async () => {
      const result = await apiGet<BatchGenerateStatusResponse>(
        `/system/documents/batch-generate/${batchJobId ?? ''}/status`,
      );
      return result.data;
    },
    enabled: batchJobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') {
        return false;
      }
      return 2000;
    },
  });
}
