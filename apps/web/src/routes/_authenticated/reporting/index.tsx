import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/reporting/')({
  beforeLoad: createModuleBeforeLoad('reporting'),
  component: ReportingPage,
});

function ReportingPage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="reporting-heading">
      <h1
        id="reporting-heading"
        className="text-2xl font-semibold text-text"
      >
        {t('navigation:reporting')}
      </h1>
    </section>
  );
}
