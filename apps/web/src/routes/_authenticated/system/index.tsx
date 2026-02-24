import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/system/')({
  beforeLoad: createModuleBeforeLoad('system'),
  component: SystemPage,
});

function SystemPage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="system-heading">
      <h1 id="system-heading" className="page-title">
        {t('navigation:system')}
      </h1>
    </section>
  );
}
