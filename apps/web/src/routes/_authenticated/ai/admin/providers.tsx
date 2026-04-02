import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';

const ProviderKeysPage = lazy(() =>
  import('@/features/ai-admin/providers/provider-keys-page').then((m) => ({
    default: m.ProviderKeysPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/providers')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: ProviderKeysPage,
});
