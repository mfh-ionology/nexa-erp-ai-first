/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';
import { ShoppingCart } from 'lucide-react';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ModulePlaceholder } from '@/components/templates/module-placeholder';

export const Route = createFileRoute('/_authenticated/sales/')({
  beforeLoad: createModuleBeforeLoad('sales'),
  component: SalesPage,
});

function SalesPage() {
  return (
    <ModulePlaceholder
      moduleKey="sales"
      icon={ShoppingCart}
      descriptionKey="modules.sales.description"
      features={[
        'modules.sales.features.quotes',
        'modules.sales.features.orders',
        'modules.sales.features.deliveryNotes',
      ]}
    />
  );
}
