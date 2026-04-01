import { createFileRoute } from '@tanstack/react-router';

import { DimensionRequirementList } from '@/features/finance/dimensions/DimensionRequirementList';

export const Route = createFileRoute('/_authenticated/finance/dimensions/requirements')({
  component: DimensionRequirementList,
});
