import { createFileRoute } from '@tanstack/react-router';

import { createAdminModuleBeforeLoad } from '@/lib/route-guards';
import { CompanyProfilePage } from '@/features/admin/company-config/company-profile-page';

export const Route = createFileRoute('/_authenticated/system/companies')({
  beforeLoad: createAdminModuleBeforeLoad('system'),
  component: CompanyProfileRoute,
});

/**
 * Route wrapper for /system/companies.
 *
 * - beforeLoad checks the user has ADMIN or SUPER_ADMIN role
 *   AND access to the "system" module
 */
function CompanyProfileRoute() {
  return <CompanyProfilePage />;
}
