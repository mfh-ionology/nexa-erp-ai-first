import { createFileRoute, redirect } from '@tanstack/react-router';

import { AuthGuard } from '@/components/layout/auth-guard';
import { useAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();

    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: AuthGuard,
});
