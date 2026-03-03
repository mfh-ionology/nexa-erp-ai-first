import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/ai/admin/prompts')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: PromptsLayout,
});

/**
 * Layout route for /ai/admin/prompts/*.
 *
 * beforeLoad centralises the ADMIN role + system module guard
 * so individual child routes (index, $id, new) don't need to duplicate the check.
 */
function PromptsLayout() {
  return <Outlet />;
}
