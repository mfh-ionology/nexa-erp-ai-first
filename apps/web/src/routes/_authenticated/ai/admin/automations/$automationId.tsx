import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const AutomationFormPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.AutomationFormPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/automations/$automationId')({
  component: AutomationDetailRoute,
});

/**
 * Extracts `automationId` from route params and passes to the form page.
 * ADMIN guard is handled by the parent layout route (automations.tsx).
 */
function AutomationDetailRoute() {
  const { automationId } = Route.useParams();
  return <AutomationFormPage id={automationId} />;
}
