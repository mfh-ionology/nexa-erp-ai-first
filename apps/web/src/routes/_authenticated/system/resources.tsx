import { createFileRoute } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';
import { ResourceRegistryPage } from '@/features/admin/resources/resource-registry-page';

export const Route = createFileRoute('/_authenticated/system/resources')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: ResourceRegistryRoute,
});

/**
 * Route wrapper for /system/resources.
 *
 * - beforeLoad checks the user has ADMIN or SUPER_ADMIN role
 *   AND access to the "system" module
 */
function ResourceRegistryRoute() {
  return <ResourceRegistryPage />;
}
