/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { FinanceDashboardPage } from '@/features/finance/pages/FinanceDashboardPage';

export const Route = createFileRoute('/_authenticated/finance/')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: FinancePage,
});

function FinancePage() {
  return <FinanceDashboardPage />;
}
