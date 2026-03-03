import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const AgentFormPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.AgentFormPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/agents/$id')({
  component: AgentDetailRoute,
});

/**
 * Extracts `id` from route params and passes to the form page.
 * ADMIN guard is handled by the parent layout route (agents.tsx).
 */
function AgentDetailRoute() {
  const { id } = Route.useParams();
  return <AgentFormPage id={id} />;
}
