import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/hr/')({
  beforeLoad: createModuleBeforeLoad('hr'),
  component: HrPage,
});

function HrPage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="hr-heading">
      <h1 id="hr-heading" className="text-2xl font-semibold text-text">
        {t('navigation:hr')}
      </h1>
    </section>
  );
}
