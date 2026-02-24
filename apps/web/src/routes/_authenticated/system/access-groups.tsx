import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/system/access-groups')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: AccessGroupsLayout,
});

/**
 * Layout route for /system/access-groups/*.
 *
 * beforeLoad centralises the ADMIN role + system module guard
 * so individual child routes (index, new, $id) don't need to duplicate the check.
 */
function AccessGroupsLayout() {
  return <Outlet />;
}
