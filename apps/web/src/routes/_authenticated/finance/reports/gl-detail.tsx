import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { GlDetailPage } from '@/features/finance/pages/GlDetailPage';

export const Route = createFileRoute('/_authenticated/finance/reports/gl-detail')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: GlDetailPage,
});
