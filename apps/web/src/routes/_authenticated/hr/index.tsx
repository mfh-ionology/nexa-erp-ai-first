/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';
import { UserCog } from 'lucide-react';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ModulePlaceholder } from '@/components/templates/module-placeholder';

export const Route = createFileRoute('/_authenticated/hr/')({
  beforeLoad: createModuleBeforeLoad('hr'),
  component: HrPage,
});

function HrPage() {
  return (
    <ModulePlaceholder
      moduleKey="hr"
      icon={UserCog}
      descriptionKey="modules.hr.description"
      features={[
        'modules.hr.features.employees',
        'modules.hr.features.contracts',
        'modules.hr.features.leave',
        'modules.hr.features.payroll',
        'modules.hr.features.appraisals',
      ]}
    />
  );
}
