import { createFileRoute } from '@tanstack/react-router';

import { MyTasksPage } from '@/features/tasks/pages/MyTasksPage';
import { createRoleBeforeLoad } from '@/lib/route-guards';

/**
 * Tasks is a cross-cutting feature (no module key), but requires STAFF+
 * role minimum per E11.2 AC. VIEWER-level users cannot access this page.
 */
export const Route = createFileRoute('/_authenticated/tasks/')({
  beforeLoad: createRoleBeforeLoad('STAFF'),
  component: MyTasksPage,
});
