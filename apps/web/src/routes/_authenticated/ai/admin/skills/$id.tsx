import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const SkillFormPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.SkillFormPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/skills/$id')({
  component: SkillDetailRoute,
});

/**
 * Extracts `id` from route params and passes to the form page.
 * ADMIN guard is handled by the parent layout route (skills.tsx).
 */
function SkillDetailRoute() {
  const { id } = Route.useParams();
  return <SkillFormPage id={id} />;
}
