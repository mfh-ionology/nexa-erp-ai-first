/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';
import { BarChart3 } from 'lucide-react';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ModulePlaceholder } from '@/components/templates/module-placeholder';

export const Route = createFileRoute('/_authenticated/reporting/')({
  beforeLoad: createModuleBeforeLoad('reporting'),
  component: ReportingPage,
});

function ReportingPage() {
  return (
    <ModulePlaceholder
      moduleKey="reporting"
      icon={BarChart3}
      descriptionKey="modules.reporting.description"
      features={[
        'modules.reporting.features.financialReports',
        'modules.reporting.features.customDashboards',
      ]}
    />
  );
}
