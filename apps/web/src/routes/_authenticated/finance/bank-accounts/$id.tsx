import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { BankAccountDetailPage } from '@/features/finance/pages/bank-account-detail-page';

export const Route = createFileRoute('/_authenticated/finance/bank-accounts/$id')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: BankAccountDetailRoute,
});

/**
 * Extracts `id` from route params and passes to the detail page.
 * Module guard is handled by beforeLoad.
 */
function BankAccountDetailRoute() {
  const { id } = Route.useParams();
  return <BankAccountDetailPage id={id} />;
}
