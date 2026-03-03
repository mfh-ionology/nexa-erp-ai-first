import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const AutomationListPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.AutomationListPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/automations/')({
  component: AutomationListPage,
});
