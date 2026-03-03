import { createFileRoute, redirect } from '@tanstack/react-router';

import { useAuthStore } from '@/stores/auth-store';
import { NotificationPreferencesPage } from '@/features/notifications/preferences/notification-preferences-page';

export const Route = createFileRoute('/_authenticated/system/notification-preferences')({
  beforeLoad: () => {
    // All authenticated users can manage their own notification preferences.
    const { permissions } = useAuthStore.getState();
    if (!permissions) {
      throw redirect({ to: '/login' });
    }
  },
  component: NotificationPreferencesRoute,
});

function NotificationPreferencesRoute() {
  return <NotificationPreferencesPage />;
}
