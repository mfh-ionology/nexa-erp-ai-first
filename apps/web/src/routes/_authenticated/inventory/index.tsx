/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';
import { Warehouse } from 'lucide-react';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ModulePlaceholder } from '@/components/templates/module-placeholder';

export const Route = createFileRoute('/_authenticated/inventory/')({
  beforeLoad: createModuleBeforeLoad('inventory'),
  component: InventoryPage,
});

function InventoryPage() {
  return (
    <ModulePlaceholder
      moduleKey="inventory"
      icon={Warehouse}
      descriptionKey="modules.inventory.description"
      features={[
        'modules.inventory.features.items',
        'modules.inventory.features.warehouses',
        'modules.inventory.features.stockMovements',
        'modules.inventory.features.stockTakes',
      ]}
    />
  );
}
