import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const ModelFormPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.ModelFormPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/models/new')({
  component: ModelFormPage,
});
