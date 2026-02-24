import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/system/users')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: UsersLayout,
});

/**
 * Layout route for /system/users/*.
 *
 * beforeLoad centralises the ADMIN role + system module guard
 * so individual child routes (index, $id) don't need to duplicate the check.
 */
function UsersLayout() {
  return <Outlet />;
}
