/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';
import { Receipt } from 'lucide-react';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ModulePlaceholder } from '@/components/templates/module-placeholder';

export const Route = createFileRoute('/_authenticated/ar/')({
  beforeLoad: createModuleBeforeLoad('ar'),
  component: ArPage,
});

function ArPage() {
  return (
    <ModulePlaceholder
      moduleKey="ar"
      icon={Receipt}
      descriptionKey="modules.ar.description"
      features={[
        'modules.ar.features.customers',
        'modules.ar.features.invoices',
        'modules.ar.features.payments',
        'modules.ar.features.creditNotes',
        'modules.ar.features.statements',
      ]}
    />
  );
}
