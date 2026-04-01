/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { MonthEndClosePage } from '@/features/finance/pages/MonthEndClosePage';

export const Route = createFileRoute('/_authenticated/finance/month-end/$periodId')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: MonthEndCloseRoute,
});

function MonthEndCloseRoute() {
  const { periodId } = Route.useParams();
  return <MonthEndClosePage periodId={periodId} />;
}
