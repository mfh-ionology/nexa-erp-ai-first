import { createFileRoute } from '@tanstack/react-router';

import { JournalFormPage } from '@/features/finance/pages/JournalFormPage';

export const Route = createFileRoute('/_authenticated/finance/journals/$id')({
  component: JournalDetailRoute,
});

/**
 * Extracts `id` from route params and passes to the form page.
 * Finance module guard is handled by the parent layout route.
 */
function JournalDetailRoute() {
  const { id } = Route.useParams();
  return <JournalFormPage id={id} />;
}
