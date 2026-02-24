import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/finance/')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: FinancePage,
});

function FinancePage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="finance-heading">
      <h1 id="finance-heading" className="page-title">
        {t('navigation:finance')}
      </h1>
    </section>
  );
}
