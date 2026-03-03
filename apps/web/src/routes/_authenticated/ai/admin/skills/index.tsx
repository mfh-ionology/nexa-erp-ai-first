import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const SkillPackManagerPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.SkillPackManagerPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/skills/')({
  component: SkillPackManagerPage,
});
