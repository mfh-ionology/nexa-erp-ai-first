import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { BankAccountCreatePage } from '@/features/finance/pages/bank-account-create-page';

export const Route = createFileRoute('/_authenticated/finance/bank-accounts/new')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: BankAccountCreatePage,
});
