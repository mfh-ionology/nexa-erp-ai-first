import { useNavigate } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';

import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuthStore } from '@/stores/auth-store';

import { AppLayout } from './app-layout';

/**
 * Auth guard component that protects authenticated routes.
 *
 * - Checks auth store for valid JWT token
 * - If not authenticated → redirect to /login
 * - If authenticated → render `<AppLayout>` which composes
 *   sidebar, header, breadcrumbs, and `<Outlet />` for route content
 *
 * Used as the _authenticated.tsx layout route component.
 */
export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      void navigate({ to: '/login' });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AppLayout />
    </Suspense>
  );
}
