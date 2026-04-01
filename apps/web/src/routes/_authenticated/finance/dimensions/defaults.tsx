import { createFileRoute } from '@tanstack/react-router';

import { DimensionDefaultList } from '@/features/finance/dimensions/DimensionDefaultList';

export const Route = createFileRoute('/_authenticated/finance/dimensions/defaults')({
  component: DimensionDefaultList,
});
