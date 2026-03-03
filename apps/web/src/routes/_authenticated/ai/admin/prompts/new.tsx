import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const PromptEditorPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.PromptEditorPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/prompts/new')({
  component: PromptEditorPage,
});
