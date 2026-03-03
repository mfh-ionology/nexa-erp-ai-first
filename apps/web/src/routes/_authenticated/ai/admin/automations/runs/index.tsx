import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { z } from 'zod';

const AutomationRunListPage = lazy(() =>
  import('@/features/ai-admin/automation-runs/automation-run-list-page').then((m) => ({
    default: m.AutomationRunListPage,
  })),
);

/**
 * Search params schema for the automation runs list.
 * - automationId: optional — when present, scopes runs to that automation
 * - automationName: optional — passed for breadcrumb display
 */
const runsSearchSchema = z.object({
  automationId: z.string().optional(),
  automationName: z.string().optional(),
});

export const Route = createFileRoute('/_authenticated/ai/admin/automations/runs/')({
  validateSearch: runsSearchSchema,
  component: AutomationRunsRoute,
});

/**
 * Extracts optional `automationId` and `automationName` from search params.
 * When provided, the list page is scoped to runs for that automation.
 */
function AutomationRunsRoute() {
  const { automationId, automationName } = Route.useSearch();
  return <AutomationRunListPage automationId={automationId} automationName={automationName} />;
}
