import { createFileRoute } from '@tanstack/react-router';

import { PlaceholderPage } from '@/components/layout/placeholder-page';
import { usePlatformAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
});

function DashboardPage() {
  const userRole = usePlatformAuthStore((s) => s.user?.role);
  const isViewer = userRole === 'PLATFORM_VIEWER';

  return (
    <div>
      {isViewer && (
        <div
          data-testid="read-only-indicator"
          className="mx-8 mt-6 rounded-md border border-[var(--warning)]/30 bg-[var(--warning-bg)] px-4 py-2 text-center text-sm text-[var(--warning-foreground)]"
        >
          Read-only mode — you have view-only access to platform data.
        </div>
      )}
      <PlaceholderPage
        title="Dashboard"
        description="Platform health, active tenants, AI usage summary, and alerts."
        epicReference="Coming in E13b.2"
      />
    </div>
  );
}
