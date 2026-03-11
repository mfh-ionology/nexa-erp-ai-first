import { createFileRoute, redirect } from '@tanstack/react-router';

import { useAuthStore } from '@/stores/auth-store';
import { PrintPreferencesPage } from '@/features/print/preferences/print-preferences-page';

export const Route = createFileRoute('/_authenticated/system/print-preferences')({
  beforeLoad: () => {
    // All authenticated users can manage their own print preferences.
    const { permissions } = useAuthStore.getState();
    if (!permissions) {
      throw redirect({ to: '/login' });
    }
  },
  component: PrintPreferencesRoute,
});

function PrintPreferencesRoute() {
  return <PrintPreferencesPage />;
}
