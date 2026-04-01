import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/finance/reports/departmental-pnl')({
  beforeLoad: () => {
    throw redirect({ to: '/finance/reports/profit-and-loss' });
  },
});
