import { createFileRoute } from '@tanstack/react-router';

import { FinanceSettingsPage } from '@/features/finance/pages/FinanceSettingsPage';

export const Route = createFileRoute('/_authenticated/finance/settings')({
  component: FinanceSettingsPage,
});
