import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/purchasing/')({
  beforeLoad: createModuleBeforeLoad('purchasing'),
  component: PurchasingPage,
});

function PurchasingPage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="purchasing-heading">
      <h1
        id="purchasing-heading"
        className="page-title"
      >
        {t('navigation:purchasing')}
      </h1>
    </section>
  );
}
