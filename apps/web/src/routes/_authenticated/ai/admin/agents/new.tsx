import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const AgentFormPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.AgentFormPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/agents/new')({
  component: AgentFormPage,
});
