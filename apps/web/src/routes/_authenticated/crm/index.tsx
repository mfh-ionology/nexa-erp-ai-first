import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/crm/')({
  beforeLoad: createModuleBeforeLoad('crm'),
  component: CrmPage,
});

function CrmPage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="crm-heading">
      <h1 id="crm-heading" className="page-title">
        {t('navigation:crm')}
      </h1>
    </section>
  );
}
