import { createFileRoute } from '@tanstack/react-router';

import { ChartOfAccountsPage } from '@/features/finance/pages/ChartOfAccountsPage';

export const Route = createFileRoute('/_authenticated/finance/chart-of-accounts/')({
  component: ChartOfAccountsPage,
});
