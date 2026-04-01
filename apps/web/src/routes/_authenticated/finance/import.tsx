import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { FinanceImportPage } from '@/features/finance/pages/FinanceImportPage';

export const Route = createFileRoute('/_authenticated/finance/import')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: FinanceImportPage,
});
