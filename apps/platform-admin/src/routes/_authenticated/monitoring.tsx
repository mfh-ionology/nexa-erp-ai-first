import { createFileRoute } from '@tanstack/react-router';

import { PlaceholderPage } from '@/components/layout/placeholder-page';

export const Route = createFileRoute('/_authenticated/monitoring')({
  component: MonitoringPage,
});

function MonitoringPage() {
  return (
    <PlaceholderPage
      title="Monitoring"
      description="View system health dashboards, performance metrics, and alerts."
      epicReference="Coming in a future epic"
    />
  );
}
