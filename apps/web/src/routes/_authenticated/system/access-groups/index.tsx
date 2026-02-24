import { createFileRoute } from '@tanstack/react-router';

import { AccessGroupListPage } from '@/features/admin/access-groups/access-group-list-page';

export const Route = createFileRoute(
  '/_authenticated/system/access-groups/',
)({
  component: AccessGroupListPage,
});
