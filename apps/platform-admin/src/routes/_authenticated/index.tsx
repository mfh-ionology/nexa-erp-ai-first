import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: () => {
    // Dashboard home redirects to intelligence page for now
    throw redirect({ to: '/intelligence' });
  },
});
