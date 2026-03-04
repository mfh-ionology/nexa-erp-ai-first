import { createFileRoute, redirect } from '@tanstack/react-router';

import { PlatformLogin } from '@/components/auth/platform-login';
import { usePlatformAuthStore } from '@/stores/auth-store';

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const { isAuthenticated } = usePlatformAuthStore.getState();
    if (isAuthenticated) {
      throw redirect({ to: '/' });
    }
  },
  component: PlatformLogin,
});
