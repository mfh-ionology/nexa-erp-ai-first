import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/ai/admin/agents')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: AgentsLayout,
});

/**
 * Layout route for /ai/admin/agents/*.
 *
 * beforeLoad centralises the ADMIN role + system module guard
 * so individual child routes (index, $id, new) don't need to duplicate the check.
 */
function AgentsLayout() {
  return <Outlet />;
}
