import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const AISkillsPage = lazy(() =>
  import('@/features/ai/skills').then((m) => ({ default: m.AISkillsPage })),
);

export const Route = createFileRoute('/_authenticated/ai/skills/')({
  component: AISkillsPage,
});
