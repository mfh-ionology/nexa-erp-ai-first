import { createFileRoute } from '@tanstack/react-router';

import { AccessGroupDetailPage } from '@/features/admin/access-groups/access-group-detail-page';

export const Route = createFileRoute(
  '/_authenticated/system/access-groups/$id',
)({
  component: AccessGroupDetailRoute,
});

/**
 * Extracts `id` from route params and passes to the detail page.
 * ADMIN guard and ModuleGuard are handled by the parent layout route.
 */
function AccessGroupDetailRoute() {
  const { id } = Route.useParams();
  return <AccessGroupDetailPage id={id} />;
}
