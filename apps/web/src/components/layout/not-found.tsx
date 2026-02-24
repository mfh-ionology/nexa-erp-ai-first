import { Link, Navigate } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';

import { useAuthStore } from '@/stores/auth-store';

/**
 * 404 Not Found page component.
 *
 * - Redirects unauthenticated users to /login instead of showing 404
 * - Displays translated "page not found" message for authenticated users
 * - Links back to home page
 * - Semantic HTML with ARIA landmarks
 */
export function NotFound() {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background"
      role="main"
      aria-labelledby="not-found-heading"
    >
      <div className="text-center">
        <h1 id="not-found-heading" className="text-4xl font-bold text-foreground">
          404
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {t('errors:pageNotFound')}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {t('common:backToHome')}
        </Link>
      </div>
    </main>
  );
}
