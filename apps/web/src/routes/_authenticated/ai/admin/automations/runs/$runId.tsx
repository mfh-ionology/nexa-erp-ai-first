import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const AutomationRunDetailPage = lazy(() =>
  import('@/features/ai-admin/automation-runs/automation-run-detail-page').then((m) => ({
    default: m.AutomationRunDetailPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/automations/runs/$runId')({
  component: AutomationRunDetailRoute,
});

/**
 * Extracts `runId` from route params and passes to the detail page.
 * Breadcrumb context (automation name) is loaded from the query data inside the page.
 */
function AutomationRunDetailRoute() {
  const { runId } = Route.useParams();
  return <AutomationRunDetailPage runId={runId} />;
}
