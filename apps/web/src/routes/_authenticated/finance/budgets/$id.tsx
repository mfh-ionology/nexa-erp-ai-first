/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { BudgetDetailPage } from '@/features/finance/pages/BudgetDetailPage';

export const Route = createFileRoute('/_authenticated/finance/budgets/$id')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: BudgetDetailRoute,
});

function BudgetDetailRoute() {
  const { id } = Route.useParams();
  return <BudgetDetailPage id={id} />;
}
