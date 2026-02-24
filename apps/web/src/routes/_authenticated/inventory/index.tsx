import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/inventory/')({
  beforeLoad: createModuleBeforeLoad('inventory'),
  component: InventoryPage,
});

function InventoryPage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="inventory-heading">
      <h1
        id="inventory-heading"
        className="page-title"
      >
        {t('navigation:inventory')}
      </h1>
    </section>
  );
}
