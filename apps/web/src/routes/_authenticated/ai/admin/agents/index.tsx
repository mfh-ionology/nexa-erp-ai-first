import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const AgentListPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.AgentListPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/agents/')({
  component: AgentListPage,
});
