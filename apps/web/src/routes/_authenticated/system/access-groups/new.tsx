import { createFileRoute } from '@tanstack/react-router';

import { AccessGroupCreatePage } from '@/features/admin/access-groups/access-group-create-page';

export const Route = createFileRoute(
  '/_authenticated/system/access-groups/new',
)({
  component: AccessGroupCreatePage,
});
