import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { GeneralLedgerPage } from '@/features/finance/pages/GeneralLedgerPage';

export const Route = createFileRoute('/_authenticated/finance/reports/general-ledger')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: GeneralLedgerPage,
});
