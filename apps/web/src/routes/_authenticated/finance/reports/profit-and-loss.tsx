import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ProfitAndLossPage } from '@/features/finance/pages/profit-and-loss-page';

export const Route = createFileRoute('/_authenticated/finance/reports/profit-and-loss')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: ProfitAndLossPage,
});
