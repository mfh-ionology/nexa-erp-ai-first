import { createFileRoute } from '@tanstack/react-router';

import { BulkAssignMandatoryDimensions } from '@/features/finance/dimensions/BulkAssignMandatoryDimensions';

export const Route = createFileRoute('/_authenticated/finance/dimensions/bulk-assign')({
  component: BulkAssignMandatoryDimensions,
});
