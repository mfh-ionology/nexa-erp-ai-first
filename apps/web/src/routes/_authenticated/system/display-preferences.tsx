import { createFileRoute, redirect } from '@tanstack/react-router';

import { useAuthStore } from '@/stores/auth-store';
import { DisplayPreferencesPage } from '@/features/settings/display-preferences/display-preferences-page';

export const Route = createFileRoute('/_authenticated/system/display-preferences')({
  beforeLoad: () => {
    // All authenticated users can manage their own display preferences.
    const { permissions } = useAuthStore.getState();
    if (!permissions) {
      throw redirect({ to: '/login' });
    }
  },
  component: DisplayPreferencesRoute,
});

function DisplayPreferencesRoute() {
  return <DisplayPreferencesPage />;
}
