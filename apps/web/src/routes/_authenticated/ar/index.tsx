import { createFileRoute } from '@tanstack/react-router';

import { useI18n } from '@nexa/i18n';
import { createModuleBeforeLoad } from '@/lib/route-guards';

export const Route = createFileRoute('/_authenticated/ar/')({
  beforeLoad: createModuleBeforeLoad('ar'),
  component: ArPage,
});

function ArPage() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="ar-heading">
      <h1 id="ar-heading" className="text-2xl font-semibold text-text">
        {t('navigation:ar')}
      </h1>
    </section>
  );
}
