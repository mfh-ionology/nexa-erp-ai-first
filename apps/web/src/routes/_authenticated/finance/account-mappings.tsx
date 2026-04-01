import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { AccountMappingsPage } from '@/features/finance/pages/account-mappings-page';

export const Route = createFileRoute('/_authenticated/finance/account-mappings')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: AccountMappingsPage,
});
