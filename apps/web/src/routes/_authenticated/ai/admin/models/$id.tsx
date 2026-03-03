import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const ModelFormPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.ModelFormPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/models/$id')({
  component: ModelDetailRoute,
});

/**
 * Extracts `id` from route params and passes to the form page.
 * ADMIN guard is handled by the parent layout route (models.tsx).
 */
function ModelDetailRoute() {
  const { id } = Route.useParams();
  return <ModelFormPage id={id} />;
}
