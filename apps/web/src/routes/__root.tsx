import { createRootRoute, Outlet } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

import { ErrorBoundary } from '@/components/layout/error-boundary';
import { ImpersonationBanner } from '@/components/impersonation/impersonation-banner';
import { NotFound } from '@/components/layout/not-found';
import { useImpersonationSession } from '@/hooks/use-impersonation-session';

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import('@tanstack/react-router-devtools').then((res) => ({
        default: res.TanStackRouterDevtools,
      })),
    );

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const impersonation = useImpersonationSession();

  return (
    <ErrorBoundary>
      {impersonation.isImpersonating && <ImpersonationBanner session={impersonation} />}
      <Outlet />
      <Suspense>
        <TanStackRouterDevtools position="bottom-right" />
      </Suspense>
    </ErrorBoundary>
  );
}
