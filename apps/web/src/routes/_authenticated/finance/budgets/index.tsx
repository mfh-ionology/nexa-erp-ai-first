/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { BudgetListPage } from '@/features/finance/pages/BudgetListPage';

export const Route = createFileRoute('/_authenticated/finance/budgets/')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: BudgetListPage,
});
