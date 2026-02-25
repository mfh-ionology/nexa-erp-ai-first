/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { InvoiceDetailPage } from '@/features/ar/invoices/invoice-detail-page';

export const Route = createFileRoute('/_authenticated/ar/invoices/$id')({
  beforeLoad: createModuleBeforeLoad('ar'),
  component: InvoiceDetailRoute,
});

function InvoiceDetailRoute() {
  const { id: _id } = Route.useParams();
  // Static mock detail page — id param unused until E14 wires real API
  return <InvoiceDetailPage />;
}
