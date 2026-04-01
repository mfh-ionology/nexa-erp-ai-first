/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { TransactionJournalPage } from '@/features/finance/pages/TransactionJournalPage';

export const Route = createFileRoute('/_authenticated/finance/reports/transaction-journal')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: TransactionJournalPage,
});
