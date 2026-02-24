import { createFileRoute, Link } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';

export const Route = createFileRoute('/403')({
  component: AccessDeniedPage,
});

/**
 * Access denied page — shown when a user lacks permission for a module.
 */
function AccessDeniedPage() {
  const { t } = useI18n();

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background"
      role="main"
      aria-labelledby="access-denied-heading"
    >
      <div className="text-center max-w-md">
        <h1
          id="access-denied-heading"
          className="text-4xl font-bold text-text"
        >
          403
        </h1>
        <p className="mt-2 text-lg text-text-muted">
          {t('errors:accessDenied')}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          {t('errors:accessDeniedDescription')}
        </p>
        <p className="mt-4 text-sm font-medium text-text-muted">
          {t('errors:contactAdmin')}
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
