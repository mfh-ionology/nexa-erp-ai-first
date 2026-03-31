import { createFileRoute, Outlet } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/finance/chart-of-accounts')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: ChartOfAccountsLayout,
});

/**
 * Layout route for /finance/chart-of-accounts/*.
 *
 * beforeLoad centralises the finance module guard
 * so individual child routes (index, $id) don't need to duplicate the check.
 */
function ChartOfAccountsLayout() {
  return <Outlet />;
}
