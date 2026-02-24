import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/sales/')({
  beforeLoad: createModuleBeforeLoad('sales'),
  component: SalesPage,
});

function SalesPage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="sales-heading">
      <h1 id="sales-heading" className="text-2xl font-semibold text-text">
        {t('navigation:sales')}
      </h1>
    </section>
  );
}
