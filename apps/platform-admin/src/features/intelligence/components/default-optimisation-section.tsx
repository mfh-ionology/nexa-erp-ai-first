import { useState, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Settings2,
  Sparkles,
} from 'lucide-react';

import { useInsights, useUpdateInsightStatus } from '@/api/use-intelligence';
import { cn } from '@/lib/utils';
import { extractModule, extractTenantCount } from '@/lib/insight-helpers';
import { usePlatformAuthStore } from '@/stores/auth-store';

import type { PlatformInsight } from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractAdoptionPercentage(insight: PlatformInsight): number {
  const evidence = insight.evidence as Record<string, unknown> | null;
  if (evidence && typeof evidence.adoptionPercentage === 'number')
    return evidence.adoptionPercentage;
  if (evidence && typeof evidence.percentage === 'number') return evidence.percentage;
  return 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModuleGroup {
  module: string;
  insights: PlatformInsight[];
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DefaultOptSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
            <div className="flex-1 space-y-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
            </div>
            <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adoption Bar
// ---------------------------------------------------------------------------

function AdoptionBar({ percentage }: { percentage: number }) {
  const clamped = Math.min(100, Math.max(0, percentage));
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${clamped.toFixed(0)}% adoption`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="mono-amount w-12 text-right text-xs font-bold text-foreground">
        {clamped.toFixed(0)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Make Default Button
// ---------------------------------------------------------------------------

function MakeDefaultButton({ insight, disabled }: { insight: PlatformInsight; disabled: boolean }) {
  const { mutate, isPending } = useUpdateInsightStatus();
  const user = usePlatformAuthStore((s) => s.user);

  const handleMakeDefault = useCallback(() => {
    mutate({
      id: insight.id,
      body: { status: 'ACTIONED', reviewedById: user?.id },
    });
  }, [insight.id, mutate, user?.id]);

  const isActioned = insight.status === 'ACTIONED';

  return (
    <button
      onClick={handleMakeDefault}
      disabled={disabled || isActioned || isPending}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
        isActioned
          ? 'bg-green-100 text-green-700 cursor-default'
          : 'bg-primary text-primary-foreground hover:bg-primary-dark',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
      aria-label={
        isActioned ? `Already actioned: ${insight.title}` : `Make default: ${insight.title}`
      }
    >
      {isPending ? (
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : isActioned ? (
        <>
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Actioned
        </>
      ) : (
        <>
          <Settings2 className="h-3 w-3" aria-hidden="true" />
          Make Default
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Insight Row
// ---------------------------------------------------------------------------

function DefaultCandidateRow({
  insight,
  isViewerOnly,
}: {
  insight: PlatformInsight;
  isViewerOnly: boolean;
}) {
  const adoption = extractAdoptionPercentage(insight);
  const tenantCount = extractTenantCount(insight);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/30">
      {/* Title & description */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-foreground">{insight.title}</p>
        <p className="text-xs text-muted-foreground">{insight.description}</p>
        <AdoptionBar percentage={adoption} />
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="mono-amount" title="Tenant count">
          {tenantCount} {tenantCount === 1 ? 'tenant' : 'tenants'}
        </span>
      </div>

      {/* Action */}
      <MakeDefaultButton insight={insight} disabled={isViewerOnly} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Module Group
// ---------------------------------------------------------------------------

function ModuleGroupPanel({ group, isViewerOnly }: { group: ModuleGroup; isViewerOnly: boolean }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm font-semibold text-foreground hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
          {group.module}
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          ({group.insights.length} {group.insights.length === 1 ? 'candidate' : 'candidates'})
        </span>
      </button>

      {isExpanded && (
        <div className="mt-1 space-y-2 pl-6">
          {group.insights.map((insight) => (
            <DefaultCandidateRow key={insight.id} insight={insight} isViewerOnly={isViewerOnly} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DefaultOptimisationSection() {
  const { data, isLoading, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInsights({ insightType: 'DEFAULT_CANDIDATE' });

  const user = usePlatformAuthStore((s) => s.user);
  const isViewerOnly = user?.role !== 'PLATFORM_ADMIN';

  // Flatten paginated pages
  const allInsights = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  // Group by module, sorted by adoption percentage descending within each group
  const moduleGroups = useMemo<ModuleGroup[]>(() => {
    const groupMap = new Map<string, PlatformInsight[]>();
    for (const insight of allInsights) {
      const mod = extractModule(insight);
      const existing = groupMap.get(mod) ?? [];
      existing.push(insight);
      groupMap.set(mod, existing);
    }

    return Array.from(groupMap.entries())
      .map(([module, insights]) => ({
        module,
        insights: insights.sort(
          (a, b) => extractAdoptionPercentage(b) - extractAdoptionPercentage(a),
        ),
      }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [allInsights]);

  // ----- Loading -----
  if (isLoading) {
    return (
      <section
        className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up"
        aria-label="Default Optimisation"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Default Optimisation
          </h2>
          <p className="text-sm text-muted-foreground">
            Configurations &gt;60% of tenants create manually
          </p>
        </div>
        <DefaultOptSkeleton />
      </section>
    );
  }

  // ----- Error -----
  if (error) {
    return (
      <section
        className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up"
        aria-label="Default Optimisation"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Default Optimisation
          </h2>
        </div>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm">Failed to load default candidates</span>
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
        aria-label="Default Optimisation"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Default Optimisation
          </h2>
          <p className="text-sm text-muted-foreground">
            Configurations &gt;60% of tenants create manually
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Settings2 className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">
            No default candidates detected yet — run aggregation to collect intelligence
          </p>
        </div>
      </section>
    );
  }

  // ----- Data -----
  return (
    <section
      className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)] animate-fade-in-up"
      aria-label="Default Optimisation"
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="heading-section text-lg font-semibold text-foreground">
          Default Optimisation
        </h2>
        <p className="text-sm text-muted-foreground">
          Configurations &gt;60% of tenants create manually
        </p>
      </div>

      {/* Module groups */}
      <div className="space-y-4" role="list" aria-label="Default candidate insights by module">
        {moduleGroups.map((group) => (
          <div key={group.module} role="listitem">
            <ModuleGroupPanel group={group} isViewerOnly={isViewerOnly} />
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
