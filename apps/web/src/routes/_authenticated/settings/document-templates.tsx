import { createFileRoute } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';
import { DocumentTemplatesPage } from '@/features/settings/document-templates/document-templates-page';

export const Route = createFileRoute('/_authenticated/settings/document-templates')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: DocumentTemplatesRoute,
});

/**
 * Route wrapper for /settings/document-templates.
 *
 * - beforeLoad checks ADMIN role + system module access
 */
function DocumentTemplatesRoute() {
  return <DocumentTemplatesPage />;
}
