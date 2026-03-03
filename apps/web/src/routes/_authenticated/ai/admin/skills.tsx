import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/ai/admin/skills')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: SkillsLayout,
});

/**
 * Layout route for /ai/admin/skills/*.
 *
 * beforeLoad centralises the ADMIN role + system module guard
 * so individual child routes (index, $id, new) don't need to duplicate the check.
 */
function SkillsLayout() {
  return <Outlet />;
}
