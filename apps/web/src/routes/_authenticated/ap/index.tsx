import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/ap/')({
  beforeLoad: createModuleBeforeLoad('ap'),
  component: ApPage,
});

function ApPage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="ap-heading">
      <h1 id="ap-heading" className="text-2xl font-semibold text-text">
        {t('navigation:ap')}
      </h1>
    </section>
  );
}
