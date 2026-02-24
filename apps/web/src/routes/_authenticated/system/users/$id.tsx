import { createFileRoute } from '@tanstack/react-router';

import { UserDetailPage } from '@/features/admin/users/user-detail-page';

export const Route = createFileRoute(
  '/_authenticated/system/users/$id',
)({
  component: UserDetailRoute,
});

/**
 * Extracts `id` from route params and passes to the detail page.
 * ADMIN guard and ModuleGuard are handled by the parent layout route.
 */
function UserDetailRoute() {
  const { id } = Route.useParams();
  return <UserDetailPage id={id} />;
}
