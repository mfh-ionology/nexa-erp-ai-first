/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';
import { Landmark } from 'lucide-react';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ModulePlaceholder } from '@/components/templates/module-placeholder';

export const Route = createFileRoute('/_authenticated/finance/')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: FinancePage,
});

function FinancePage() {
  return (
    <ModulePlaceholder
      moduleKey="finance"
      icon={Landmark}
      descriptionKey="modules.finance.description"
      features={[
        'modules.finance.features.chartOfAccounts',
        'modules.finance.features.journalEntries',
        'modules.finance.features.periodClose',
        'modules.finance.features.bankReconciliation',
        'modules.finance.features.budgets',
      ]}
    />
  );
}
