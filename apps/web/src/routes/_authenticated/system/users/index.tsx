import { createFileRoute } from '@tanstack/react-router';

import { UserListPage } from '@/features/admin/users/user-list-page';

export const Route = createFileRoute(
  '/_authenticated/system/users/',
)({
  component: UserListPage,
});
