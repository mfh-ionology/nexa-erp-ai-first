import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { BankReconRulesPage } from '@/features/finance/pages/BankReconRulesPage';

export const Route = createFileRoute('/_authenticated/finance/bank-recon-rules')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: BankReconRulesPage,
});
