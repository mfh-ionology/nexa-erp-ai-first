import { createFileRoute } from '@tanstack/react-router';
import { lazy } from 'react';

const AIMemoryPage = lazy(() =>
  import('@/features/ai/memory').then((m) => ({ default: m.AIMemoryPage })),
);

export const Route = createFileRoute('/_authenticated/ai/memory/')({
  component: AIMemoryPage,
});
