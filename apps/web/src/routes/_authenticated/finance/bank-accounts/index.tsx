import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { BankAccountListPage } from '@/features/finance/pages/bank-account-list-page';

export const Route = createFileRoute('/_authenticated/finance/bank-accounts/')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: BankAccountListPage,
});
