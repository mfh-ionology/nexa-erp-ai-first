import { createFileRoute } from '@tanstack/react-router';

import { JournalFormPage } from '@/features/finance/pages/JournalFormPage';

export const Route = createFileRoute('/_authenticated/finance/journals/new')({
  component: JournalFormPage,
});
