import { createFileRoute } from '@tanstack/react-router';

import { AccountDetailPage } from '@/features/finance/pages/AccountDetailPage';

export const Route = createFileRoute('/_authenticated/finance/chart-of-accounts/$id')({
  component: AccountDetailRoute,
});

/**
 * Extracts `id` from route params and passes to the detail page.
 * Finance module guard is handled by the parent layout route.
 */
function AccountDetailRoute() {
  const { id } = Route.useParams();
  return <AccountDetailPage id={id} />;
}
