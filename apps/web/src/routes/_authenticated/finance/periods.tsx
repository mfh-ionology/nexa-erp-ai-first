import { createFileRoute } from '@tanstack/react-router';

import { PeriodsPage } from '@/features/finance/pages/PeriodsPage';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/finance/periods')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: PeriodsPage,
});
