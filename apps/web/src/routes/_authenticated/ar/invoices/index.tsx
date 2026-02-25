/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { InvoiceListPage } from '@/features/ar/invoices/invoice-list-page';

export const Route = createFileRoute('/_authenticated/ar/invoices/')({
  beforeLoad: createModuleBeforeLoad('ar'),
  component: InvoiceListPage,
});
