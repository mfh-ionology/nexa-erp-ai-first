/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { BudgetVariancePage } from '@/features/finance/pages/BudgetVariancePage';

export const Route = createFileRoute('/_authenticated/finance/reports/budget-variance')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: BudgetVariancePage,
});
