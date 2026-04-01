import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { DepartmentalPnlPage } from '@/features/finance/pages/DepartmentalPnlPage';

export const Route = createFileRoute('/_authenticated/finance/reports/departmental-pnl')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: DepartmentalPnlPage,
});
