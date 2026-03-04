import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/ai/admin/knowledge')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: KnowledgeLayout,
});

/**
 * Layout route for /ai/admin/knowledge.
 *
 * beforeLoad centralises the ADMIN role + system module guard
 * so the child index route doesn't need to duplicate the check.
 */
function KnowledgeLayout() {
  return <Outlet />;
}
