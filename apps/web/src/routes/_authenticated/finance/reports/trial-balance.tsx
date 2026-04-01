import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { TrialBalancePage } from '@/features/finance/pages/trial-balance-page';

export const Route = createFileRoute('/_authenticated/finance/reports/trial-balance')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: TrialBalancePage,
});
