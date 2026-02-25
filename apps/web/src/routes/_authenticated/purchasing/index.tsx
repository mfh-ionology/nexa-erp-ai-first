/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';
import { Package } from 'lucide-react';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ModulePlaceholder } from '@/components/templates/module-placeholder';

export const Route = createFileRoute('/_authenticated/purchasing/')({
  beforeLoad: createModuleBeforeLoad('purchasing'),
  component: PurchasingPage,
});

function PurchasingPage() {
  return (
    <ModulePlaceholder
      moduleKey="purchasing"
      icon={Package}
      descriptionKey="modules.purchasing.description"
      features={[
        'modules.purchasing.features.purchaseOrders',
        'modules.purchasing.features.goodsReceipts',
      ]}
    />
  );
}
