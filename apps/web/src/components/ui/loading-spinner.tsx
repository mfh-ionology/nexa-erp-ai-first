import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton-based loading indicator used as a <Suspense fallback>
 * for route code splitting and lazy-loaded components.
 */
export function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-4 p-8">
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
