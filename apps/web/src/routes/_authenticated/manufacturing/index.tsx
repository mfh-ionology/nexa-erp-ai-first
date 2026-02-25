/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';
import { Factory } from 'lucide-react';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { ModulePlaceholder } from '@/components/templates/module-placeholder';

export const Route = createFileRoute('/_authenticated/manufacturing/')({
  beforeLoad: createModuleBeforeLoad('manufacturing'),
  component: ManufacturingPage,
});

function ManufacturingPage() {
  return (
    <ModulePlaceholder
      moduleKey="manufacturing"
      icon={Factory}
      descriptionKey="modules.manufacturing.description"
      features={[
        'modules.manufacturing.features.recipes',
        'modules.manufacturing.features.workOrders',
        'modules.manufacturing.features.machines',
        'modules.manufacturing.features.mrp',
      ]}
    />
  );
}
