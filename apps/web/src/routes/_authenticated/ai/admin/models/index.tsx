import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const ModelListPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.ModelListPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/models/')({
  component: ModelListPage,
});
