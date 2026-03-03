import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/ai/admin/automations')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: AutomationsLayout,
});

/**
 * Layout route for /ai/admin/automations/*.
 *
 * beforeLoad centralises the ADMIN role + system module guard
 * so individual child routes (index, $automationId, new) don't need to duplicate the check.
 */
function AutomationsLayout() {
  return <Outlet />;
}
