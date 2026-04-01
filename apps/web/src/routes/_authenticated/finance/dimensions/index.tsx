import { createFileRoute } from '@tanstack/react-router';

import { DimensionTypeList } from '@/features/finance/dimensions/DimensionTypeList';

export const Route = createFileRoute('/_authenticated/finance/dimensions/')({
  component: DimensionTypeList,
});
