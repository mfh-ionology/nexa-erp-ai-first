/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { VatReturnDetailPage } from '@/features/finance/pages/VatReturnDetailPage';

export const Route = createFileRoute('/_authenticated/finance/vat-returns/$id')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: VatReturnDetailRoute,
});

function VatReturnDetailRoute() {
  const { id } = Route.useParams();
  return <VatReturnDetailPage id={id} />;
}
