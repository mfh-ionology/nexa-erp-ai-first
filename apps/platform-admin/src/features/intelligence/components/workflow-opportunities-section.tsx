import { useState, useCallback, useEffect, useMemo } from 'react';
import { AlertCircle, ChevronDown, Lightbulb, MoreHorizontal, RefreshCw } from 'lucide-react';

import { useInsights, useUpdateInsightStatus } from '@/api/use-intelligence';
import { cn } from '@/lib/utils';
import { extractTenantCount, extractFrequency } from '@/lib/insight-helpers';
import { usePlatformAuthStore } from '@/stores/auth-store';

import type { InsightStatus, PlatformInsight } from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowOpportunitiesProps {
  /** Called when the user wants to create an automation suggestion from an insight */
  onCreateAutomationSuggestion?: (insight: PlatformInsight) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: InsightStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'ACTIONED', label: 'Actioned' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function WorkflowSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
          <div className="flex-1 space-y-1">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Dropdown
// ---------------------------------------------------------------------------

function ActionDropdown({
  insight,
  disabled,
  onCreateAutomation,
}: {
  insight: PlatformInsight;
  disabled: boolean;
  onCreateAutomation?: (insight: PlatformInsight) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { mutate, isPending } = useUpdateInsightStatus();
  const user = usePlatformAuthStore((s) => s.user);

  const handleStatusChange = useCallback(
    (status: InsightStatus) => {
      mutate({
        id: insight.id,
        body: { status, reviewedById: user?.id },
      });
      setIsOpen(false);
    },
    [insight.id, mutate, user?.id],
  );

  const handleCreateAutomation = useCallback(() => {
    onCreateAutomation?.(insight);
    setIsOpen(false);
  }, [insight, onCreateAutomation]);

  // Close dropdown on scroll or Escape to prevent disconnected backdrop
  useEffect(() => {
    if (!isOpen) return;
    const closeOnScroll = () => setIsOpen(false);
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('scroll', closeOnScroll, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled || isPending}
        className={cn(
          'flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium',
          'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        aria-label={`Actions for: ${insight.title}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
        Action
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />

          <div
            className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-border bg-card shadow-lg"
            role="menu"
            aria-label="Insight actions"
          >
            {STATUS_OPTIONS.filter((opt) => opt.value !== insight.status).map((opt) => (
              <button
                key={opt.value}
                role="menuitem"
                onClick={() => handleStatusChange(opt.value)}
                className="flex w-full items-center px-3 py-2 text-left text-xs hover:bg-muted/50"
              >
                Mark as {opt.label}
              </button>
            ))}
            <div className="border-t border-border" />
            <button
              role="menuitem"
              onClick={handleCreateAutomation}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-primary hover:bg-muted/50"
            >
              <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
              Create Automation Suggestion
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const safeStatus = status || 'NEW';
  const colorMap: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-700',
    REVIEWED: 'bg-amber-100 text-amber-700',
    ACTIONED: 'bg-green-100 text-green-700',
    DISMISSED: 'bg-gray-100 text-gray-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        colorMap[safeStatus] ?? colorMap.NEW,
      )}
      aria-label={`Status: ${safeStatus.toLowerCase()}`}
    >
      {safeStatus.charAt(0) + safeStatus.slice(1).toLowerCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Insight Row
// ---------------------------------------------------------------------------

function WorkflowRow({
  insight,
  isViewerOnly,
  onCreateAutomation,
}: {
  insight: PlatformInsight;
  isViewerOnly: boolean;
  onCreateAutomation?: (insight: PlatformInsight) => void;
}) {
  const tenantCount = extractTenantCount(insight);
  const frequency = extractFrequency(insight);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/30">
      {/* Status badge */}
      <StatusBadge status={insight.status} />

      {/* Title & description */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{insight.title}</p>
        <p className="truncate text-xs text-muted-foreground">{insight.description}</p>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="mono-amount" title="Tenant count">
          {tenantCount} {tenantCount === 1 ? 'tenant' : 'tenants'}
        </span>
        <span className="mono-amount" title="Frequency">
          {frequency.toLocaleString('en-GB')}×
        </span>
      </div>

      {/* Action dropdown */}
      <ActionDropdown
        insight={insight}
        disabled={isViewerOnly}
        onCreateAutomation={onCreateAutomation}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowOpportunitiesSection({
  onCreateAutomationSuggestion,
}: WorkflowOpportunitiesProps) {
  const { data, isLoading, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInsights({ insightType: 'WORKFLOW_OPPORTUNITY' });

  const user = usePlatformAuthStore((s) => s.user);
  const isViewerOnly = user?.role !== 'PLATFORM_ADMIN';

  // Flatten paginated pages and sort by tenant count descending (AC#4).
  // NOTE: This client-side sort is best-effort — it only sorts currently loaded
  // pages. For fully correct ordering, the API should support a sortBy parameter.
  // For MVP this is acceptable since the server returns data in a stable order and
  // the first pages typically contain the most relevant items.
  const allInsights = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    return [...flat].sort((a, b) => extractTenantCount(b) - extractTenantCount(a));
  }, [data]);

  // ----- Loading -----
  if (isLoading) {
    return (
      <section
        className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up"
        aria-label="Workflow Opportunities"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Workflow Opportunities
          </h2>
          <p className="text-sm text-muted-foreground">
            Repeated manual patterns — automation candidates
          </p>
        </div>
        <WorkflowSkeleton />
      </section>
    );
  }

  // ----- Error -----
  if (error) {
    return (
      <section
        className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up"
        aria-label="Workflow Opportunities"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Workflow Opportunities
          </h2>
        </div>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm">Failed to load workflow opportunities</span>
        </div>
        <button
          onClick={() => void refetch()}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      </section>
    );
  }

  // ----- Empty -----
  if (allInsights.length === 0) {
    return (
      <section
        className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up"
        aria-label="Workflow Opportunities"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Workflow Opportunities
          </h2>
          <p className="text-sm text-muted-foreground">
            Repeated manual patterns — automation candidates
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Lightbulb className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">
            No workflow opportunities detected yet — run aggregation to collect intelligence
          </p>
        </div>
      </section>
    );
  }

  // ----- Data -----
  return (
    <section
      className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)] animate-fade-in-up"
      aria-label="Workflow Opportunities"
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="heading-section text-lg font-semibold text-foreground">
          Workflow Opportunities
        </h2>
        <p className="text-sm text-muted-foreground">
          Repeated manual patterns — automation candidates
        </p>
      </div>

      {/* Insight list */}
      <div className="space-y-2" role="list" aria-label="Workflow opportunity insights">
        {allInsights.map((insight) => (
          <div key={insight.id} role="listitem">
            <WorkflowRow
              insight={insight}
              isViewerOnly={isViewerOnly}
              onCreateAutomation={onCreateAutomationSuggestion}
            />
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasNextPage && (
        <div className="mt-4 flex items-center justify-center">
          <button
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className={cn(
              'flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded-md px-2 py-1',
              'disabled:opacity-50',
            )}
          >
            {isFetchingNextPage ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading…
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                Load More
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
