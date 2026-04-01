/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { VatReturnListPage } from '@/features/finance/pages/VatReturnListPage';

export const Route = createFileRoute('/_authenticated/finance/vat-returns/')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: VatReturnListPage,
});
