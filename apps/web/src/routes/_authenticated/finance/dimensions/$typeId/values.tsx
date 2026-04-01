import { createFileRoute } from '@tanstack/react-router';

import { DimensionValueTree } from '@/features/finance/dimensions/DimensionValueTree';

export const Route = createFileRoute('/_authenticated/finance/dimensions/$typeId/values')({
  component: DimensionValueRoute,
});

function DimensionValueRoute() {
  const { typeId } = Route.useParams();
  return <DimensionValueTree typeId={typeId} />;
}
