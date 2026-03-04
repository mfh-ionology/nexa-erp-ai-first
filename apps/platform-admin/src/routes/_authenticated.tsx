import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { PlatformSidebar } from '@/components/layout/platform-sidebar';
import { tryBootstrapAuth } from '@/lib/api-client';
import { usePlatformAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const { isAuthenticated } = usePlatformAuthStore.getState();
    if (isAuthenticated) return;

    // Attempt silent refresh via httpOnly cookie before redirecting to login
    const refreshed = await tryBootstrapAuth();
    if (!refreshed) {
      throw redirect({ to: '/login' });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <PlatformSidebar />
      <main id="main-content" className="flex-1 overflow-y-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
