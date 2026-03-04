import { useState, useCallback } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react';

import { useInsights, useUpdateInsightStatus } from '@/api/use-intelligence';
import { cn } from '@/lib/utils';
import { extractModule, extractTenantCount, extractFrequency } from '@/lib/insight-helpers';
import { usePlatformAuthStore } from '@/stores/auth-store';

import type { InsightSeverity, InsightStatus, PlatformInsight } from '@/types/intelligence';

import { ModuleGapChart } from './module-gap-chart';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<InsightSeverity, { bg: string; text: string; label: string }> = {
  HIGH: { bg: 'bg-red-100', text: 'text-red-700', label: 'High' },
  MEDIUM: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' },
  LOW: { bg: 'bg-green-100', text: 'text-green-700', label: 'Low' },
};

const STATUS_OPTIONS: { value: InsightStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'ACTIONED', label: 'Actioned' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

const INITIAL_DISPLAY_COUNT = 10;

// Helpers: extractModule, extractTenantCount, extractFrequency imported from @/lib/insight-helpers

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function FeatureGapsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-1">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-5 w-14 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Severity Badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  const config = SEVERITY_CONFIG[severity as InsightSeverity] ?? SEVERITY_CONFIG.LOW;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.bg,
        config.text,
      )}
      aria-label={`Severity: ${config.label}`}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Module Badge
// ---------------------------------------------------------------------------

function ModuleBadge({ module }: { module: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
      {module}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status Dropdown
// ---------------------------------------------------------------------------

function StatusDropdown({ insight, disabled }: { insight: PlatformInsight; disabled: boolean }) {
  const updateStatus = useUpdateInsightStatus();
  const user = usePlatformAuthStore((s) => s.user);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newStatus = e.target.value as InsightStatus;
      updateStatus.mutate({
        id: insight.id,
        body: { status: newStatus, reviewedById: user?.id },
      });
    },
    [insight.id, updateStatus, user?.id],
  );

  return (
    <select
      value={insight.status}
      onChange={handleChange}
      disabled={disabled || updateStatus.isPending}
      className={cn(
        'rounded-md border border-border bg-background px-2 py-1 text-xs font-medium',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
      aria-label={`Status for insight: ${insight.title}`}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Insight Row
// ---------------------------------------------------------------------------

function InsightRow({
  insight,
  isViewerOnly,
}: {
  insight: PlatformInsight;
  isViewerOnly: boolean;
}) {
  const module = extractModule(insight);
  const tenantCount = extractTenantCount(insight);
  const frequency = extractFrequency(insight);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/30">
      {/* Severity */}
      <SeverityBadge severity={insight.severity} />

      {/* Module */}
      <ModuleBadge module={module} />

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

      {/* Status */}
      <StatusDropdown insight={insight} disabled={isViewerOnly} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeatureGapsSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data, isLoading, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInsights({ insightType: 'FEATURE_GAP' });

  const user = usePlatformAuthStore((s) => s.user);
  const isViewerOnly = user?.role === 'PLATFORM_VIEWER';

  // Flatten paginated pages
  const allInsights = data?.pages.flatMap((p) => p.data) ?? [];

  // For chart: aggregate by module
  const moduleGapCounts = allInsights.reduce<Record<string, number>>((acc, insight) => {
    const mod = extractModule(insight);
    acc[mod] = (acc[mod] ?? 0) + 1;
    return acc;
  }, {});

  // Determine display list
  const displayInsights = isExpanded ? allInsights : allInsights.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMore = allInsights.length > INITIAL_DISPLAY_COUNT || hasNextPage;

  const handleToggleExpand = useCallback(() => {
    if (!isExpanded && hasNextPage) {
      void fetchNextPage();
    }
    setIsExpanded((prev) => !prev);
  }, [isExpanded, hasNextPage, fetchNextPage]);

  // ----- Loading -----
  if (isLoading) {
    return (
      <section
        className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up"
        aria-label="Feature Gaps"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">Feature Gaps</h2>
          <p className="text-sm text-muted-foreground">
            Unbuilt features — AI queries with no matching skill
          </p>
        </div>
        <FeatureGapsSkeleton />
      </section>
    );
  }

  // ----- Error -----
  if (error) {
    return (
      <section
        className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up"
        aria-label="Feature Gaps"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">Feature Gaps</h2>
        </div>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm">Failed to load feature gaps</span>
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
        aria-label="Feature Gaps"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">Feature Gaps</h2>
          <p className="text-sm text-muted-foreground">
            Unbuilt features — AI queries with no matching skill
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Search className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">
            No feature gaps detected yet — run aggregation to collect intelligence
          </p>
        </div>
      </section>
    );
  }

  // ----- Data -----
  return (
    <section
      className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)] animate-fade-in-up"
      aria-label="Feature Gaps"
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="heading-section text-lg font-semibold text-foreground">Feature Gaps</h2>
        <p className="text-sm text-muted-foreground">
          Unbuilt features — AI queries with no matching skill
        </p>
      </div>

      {/* Module bar chart */}
      {Object.keys(moduleGapCounts).length > 0 && (
        <div className="mb-5">
          <ModuleGapChart data={moduleGapCounts} />
        </div>
      )}

      {/* Insight list */}
      <div className="space-y-2" role="list" aria-label="Feature gap insights">
        {displayInsights.map((insight) => (
          <div key={insight.id} role="listitem">
            <InsightRow insight={insight} isViewerOnly={isViewerOnly} />
          </div>
        ))}
      </div>

      {/* View All / Collapse + Load More */}
      {hasMore && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={handleToggleExpand}
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
            ) : isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                Show Top 10
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                View All ({allInsights.length}
                {hasNextPage ? '+' : ''})
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
