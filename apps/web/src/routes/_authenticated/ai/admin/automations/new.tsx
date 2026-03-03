import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const AutomationFormPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.AutomationFormPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/automations/new')({
  component: AutomationFormPage,
});
