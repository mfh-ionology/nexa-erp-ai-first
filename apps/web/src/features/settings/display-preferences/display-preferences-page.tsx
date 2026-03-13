/**
 * DisplayPreferencesPage — T7 Settings layout for managing display-related
 * user preferences such as mobile navigation style.
 *
 * Follows the same pattern as PrintPreferencesPage and
 * NotificationPreferencesPage.
 */

import { useMemo } from 'react';

import { useI18n } from '@nexa/i18n';

import { PageHeader } from '@/components/templates/page-header';
import { MobileNavSettings } from '../components/mobile-nav-settings';

export function DisplayPreferencesPage() {
  const { t } = useI18n();

  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system' },
      { label: t('navigation:system.displayPreferences') },
    ],
    [t],
  );

  return (
    <main className="flex flex-col gap-6" aria-label={t('navigation:system.displayPreferences')}>
      <PageHeader title={t('navigation:system.displayPreferences')} breadcrumbs={breadcrumbs} />

      <div className="rounded-xl border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up">
        <MobileNavSettings />
      </div>
    </main>
  );
}
