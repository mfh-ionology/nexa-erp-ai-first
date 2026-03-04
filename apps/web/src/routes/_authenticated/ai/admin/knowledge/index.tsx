import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const KnowledgeManagementPage = lazy(() =>
  import('@/features/ai-admin').then((m) => ({
    default: m.KnowledgeManagementPage,
  })),
);

export const Route = createFileRoute('/_authenticated/ai/admin/knowledge/')({
  component: KnowledgeManagementPage,
});
