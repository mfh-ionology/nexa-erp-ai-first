import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const PromptListPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.PromptListPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/prompts/')({
  component: PromptListPage,
});
