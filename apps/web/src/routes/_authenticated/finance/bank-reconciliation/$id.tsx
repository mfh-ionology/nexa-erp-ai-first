import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { BankReconciliationPage } from '@/features/finance/pages/bank-reconciliation-page';

export const Route = createFileRoute('/_authenticated/finance/bank-reconciliation/$id')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: BankReconciliationRoute,
});

/**
 * Extracts `id` (bank account ID) from route params and passes to the page.
 * Module guard is handled by beforeLoad.
 */
function BankReconciliationRoute() {
  const { id } = Route.useParams();
  return <BankReconciliationPage bankAccountId={id} />;
}
