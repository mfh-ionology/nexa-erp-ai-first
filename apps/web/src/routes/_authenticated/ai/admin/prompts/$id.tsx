import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const PromptEditorPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.PromptEditorPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/prompts/$id')({
  component: PromptEditorRoute,
});

/**
 * Extracts `id` from route params and passes to the editor page.
 * ADMIN guard is handled by the parent layout route (prompts.tsx).
 */
function PromptEditorRoute() {
  const { id } = Route.useParams();
  return <PromptEditorPage id={id} />;
}
