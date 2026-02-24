import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/manufacturing/')({
  beforeLoad: createModuleBeforeLoad('manufacturing'),
  component: ManufacturingPage,
});

function ManufacturingPage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="manufacturing-heading">
      <h1
        id="manufacturing-heading"
        className="page-title"
      >
        {t('navigation:manufacturing')}
      </h1>
    </section>
  );
}
