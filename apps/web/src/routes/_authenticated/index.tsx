import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardPage,
});

/**
 * Dashboard / home page — placeholder, implemented in later epics.
 */
function DashboardPage() {
  const { t } = useI18n();

  return (
    <section
      className="flex h-full items-center justify-center"
      aria-labelledby="dashboard-heading"
    >
      <h1 id="dashboard-heading" className="page-title">
        {t('navigation:dashboard')}
      </h1>
    </section>
  );
}
