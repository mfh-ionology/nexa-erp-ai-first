/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';
import { FileText } from 'lucide-react';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ModulePlaceholder } from '@/components/templates/module-placeholder';

export const Route = createFileRoute('/_authenticated/ap/')({
  beforeLoad: createModuleBeforeLoad('ap'),
  component: ApPage,
});

function ApPage() {
  return (
    <ModulePlaceholder
      moduleKey="ap"
      icon={FileText}
      descriptionKey="modules.ap.description"
      features={[
        'modules.ap.features.suppliers',
        'modules.ap.features.bills',
        'modules.ap.features.payments',
        'modules.ap.features.creditNotes',
      ]}
    />
  );
}
