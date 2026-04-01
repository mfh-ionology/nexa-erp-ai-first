import { createFileRoute } from '@tanstack/react-router';

import { JournalListPage } from '@/features/finance/pages/JournalListPage';

export const Route = createFileRoute('/_authenticated/finance/journals/')({
  component: JournalListPage,
});
