import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/finance/journals')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: JournalsLayout,
});

/**
 * Layout route for /finance/journals/*.
 *
 * beforeLoad centralises the finance module guard
 * so individual child routes (index, new, $id) don't need to duplicate the check.
 */
function JournalsLayout() {
  return <Outlet />;
}
