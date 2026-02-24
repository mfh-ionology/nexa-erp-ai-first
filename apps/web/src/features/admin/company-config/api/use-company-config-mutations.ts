/**
 * TanStack Query mutation hook for company configuration import.
 *
 * - useImportDefaults: POST /system/company-profile/import-defaults → dry-run or apply
 *
 * Export is handled via useQuery in ExportDialog (fetches data for preview,
 * then triggers client-side file download from the cached response).
 */

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ApiError } from '@nexa/api-client';
import { useI18n } from '@nexa/i18n';

import { apiPost } from '@/lib/api-client';

import type {
  ImportDefaultsRequest,
  ImportDefaultsResponse,
} from './types';

/**
 * Import a configuration JSON into the current company.
 *
 * Accepts an `ImportDefaultsRequest` with `data` (the parsed JSON) and
 * optional `dryRun` flag.
 *
 * Does NOT show toasts on success — the calling dialog displays results inline.
 * On 400 VALIDATION_ERROR or UNSUPPORTED_VERSION: re-throws for the caller
 * to display contextual error messages in the dialog.
 * On unexpected errors: shows a generic error toast.
 */
export function useImportDefaults() {
  const { t } = useI18n();

  return useMutation({
    mutationFn: async (body: ImportDefaultsRequest) => {
      const result = await apiPost<ImportDefaultsResponse>(
        '/system/company-profile/import-defaults',
        body,
      );
      return result.data;
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.statusCode === 400) {
        // VALIDATION_ERROR or UNSUPPORTED_VERSION — re-throw for caller to handle
        // Do NOT show a generic toast; the dialog displays contextual errors.
        return;
      }
      toast.error(t('errors:unexpected'));
    },
  });
}
