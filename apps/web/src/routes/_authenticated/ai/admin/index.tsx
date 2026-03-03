import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

const AiConfigDashboard = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.AiConfigDashboard,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: AiConfigDashboard,
});
