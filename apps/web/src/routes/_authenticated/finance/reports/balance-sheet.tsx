import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { BalanceSheetPage } from '@/features/finance/pages/balance-sheet-page';

export const Route = createFileRoute('/_authenticated/finance/reports/balance-sheet')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: BalanceSheetPage,
});
