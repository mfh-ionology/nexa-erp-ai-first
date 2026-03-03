import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/ai/admin/models')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: ModelsLayout,
});

/**
 * Layout route for /ai/admin/models/*.
 *
 * beforeLoad centralises the ADMIN role + system module guard
 * so individual child routes (index, $id, new) don't need to duplicate the check.
 */
function ModelsLayout() {
  return <Outlet />;
}
