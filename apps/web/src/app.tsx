import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from '@tanstack/react-router';

import { I18nProvider } from '@nexa/i18n';

import { Toaster } from '@/components/ui/sonner';

import { queryClient } from '@/lib/query-client';
import { router } from '@/router';

/**
 * Root application component.
 *
 * Wraps the application with:
 * - I18nProvider (from @nexa/i18n)
 * - QueryClientProvider (TanStack Query)
 * - RouterProvider (TanStack Router)
 * - Toaster (Sonner toast notifications)
 * - ReactQueryDevtools (development only)
 */
export function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
        {import.meta.env.DEV && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </I18nProvider>
  );
}
