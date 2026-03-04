/**
 * useDocumentEmailPreview — fetches email preview for a document.
 *
 * Calls POST /documents/email/preview to get pre-filled form data
 * (from, to, subject, bodyHtml, attachmentFileName).
 *
 * E10-3 Task 6.2 (created with Task 5 as the dialog depends on it)
 */

import { useQuery } from '@tanstack/react-query';

import { apiPost } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export interface DocumentEmailPreview {
  from: string;
  to: string;
  subject: string;
  bodyHtml: string;
  attachmentFileName: string | null;
}

export function useDocumentEmailPreview(
  documentType: string,
  recordId: string,
  templateId?: string,
  enabled = true,
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.email.preview(documentType, recordId, templateId),
    queryFn: async () => {
      const body: Record<string, unknown> = { documentType, recordId };
      if (templateId) body.templateId = templateId;
      const result = await apiPost<DocumentEmailPreview>('/documents/email/preview', body);
      return result.data;
    },
    enabled: enabled && isAuthenticated && !!documentType && !!recordId,
    // POST-based query — disable caching to ensure fresh preview data
    staleTime: 0,
    gcTime: 0,
  });
}
