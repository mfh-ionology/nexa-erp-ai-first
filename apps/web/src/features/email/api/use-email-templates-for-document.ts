/**
 * useEmailTemplatesForDocument — fetches available templates for a document type.
 *
 * Used by the TemplateSelector dropdown in the email composition dialog.
 * Calls GET /email/templates?documentType={type}&isActive=true.
 *
 * E10-3 Task 6.4 (created with Task 5 as the dialog depends on it)
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import type { EmailTemplateOption } from '../components/template-selector';

interface TemplateListItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

export function useEmailTemplatesForDocument(documentType: string, enabled = true) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.email.templates(documentType),
    queryFn: async () => {
      const qs = buildQueryString({
        documentType,
        isActive: 'true',
        limit: '50',
      });
      const result = await apiGet<TemplateListItem[]>(`/email/templates${qs}`);
      return (result.data ?? []).map(
        (t): EmailTemplateOption => ({
          id: t.id,
          code: t.code,
          name: t.name,
          description: t.description,
        }),
      );
    },
    enabled: enabled && isAuthenticated && !!documentType,
  });
}
