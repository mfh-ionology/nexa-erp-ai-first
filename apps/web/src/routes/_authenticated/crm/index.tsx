/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';
import { Users } from 'lucide-react';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ModulePlaceholder } from '@/components/templates/module-placeholder';

export const Route = createFileRoute('/_authenticated/crm/')({
  beforeLoad: createModuleBeforeLoad('crm'),
  component: CrmPage,
});

function CrmPage() {
  return (
    <ModulePlaceholder
      moduleKey="crm"
      icon={Users}
      descriptionKey="modules.crm.description"
      features={[
        'modules.crm.features.leads',
        'modules.crm.features.opportunities',
        'modules.crm.features.campaigns',
        'modules.crm.features.contacts',
      ]}
    />
  );
}
