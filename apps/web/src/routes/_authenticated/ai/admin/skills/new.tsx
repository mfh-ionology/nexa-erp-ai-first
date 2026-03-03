import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const SkillFormPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.SkillFormPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/skills/new')({
  component: SkillFormPage,
});
