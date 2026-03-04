import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/system/email-templates')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: EmailTemplatesLayout,
});

/**
 * Layout route for /system/email-templates/*.
 *
 * beforeLoad centralises the ADMIN role + system module guard
 * so individual child routes (index, new, $id) don't need to duplicate the check.
 */
function EmailTemplatesLayout() {
  return <Outlet />;
}
