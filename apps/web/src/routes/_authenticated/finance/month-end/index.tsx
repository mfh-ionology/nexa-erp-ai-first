/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { MonthEndListPage } from '@/features/finance/pages/MonthEndListPage';

export const Route = createFileRoute('/_authenticated/finance/month-end/')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: MonthEndListPage,
});
