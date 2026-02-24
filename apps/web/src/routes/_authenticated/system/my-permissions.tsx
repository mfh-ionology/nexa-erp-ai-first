import { createFileRoute, redirect } from '@tanstack/react-router';

import { useAuthStore } from '@/stores/auth-store';
import { MyPermissionsPage } from '@/features/admin/my-permissions/my-permissions-page';

export const Route = createFileRoute('/_authenticated/system/my-permissions')({
  beforeLoad: () => {
    // Only check authentication — every authenticated user can view their own permissions.
    // Do NOT use createModuleBeforeLoad('system') here (see Dev Note #9).
    const { permissions } = useAuthStore.getState();
    if (!permissions) {
      throw redirect({ to: '/login' });
    }
  },
  component: MyPermissionsRoute,
});

function MyPermissionsRoute() {
  return <MyPermissionsPage />;
}
