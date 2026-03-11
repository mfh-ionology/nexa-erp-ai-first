import { useState, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  ChevronDown,
  Layers,
  RefreshCw,
  Users,
  Wrench,
} from 'lucide-react';

import { usePatterns, useCorrections } from '@/api/use-intelligence';
import { cn } from '@/lib/utils';

import type { TenantPattern, TenantCorrection } from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  { value: '', label: 'All Industries' },
  { value: 'Construction', label: 'Construction' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Professional Services', label: 'Professional Services' },
  { value: 'Other', label: 'Other' },
] as const;

/** Purple palette for bars */
const BAR_COLORS = [
  'bg-[#7c3aed]',
  'bg-[#8b5cf6]',
  'bg-[#a78bfa]',
  'bg-[#c4b5fd]',
  'bg-[#ddd6fe]',
  'bg-[#ede9fe]',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Aggregate query categories from patterns into a ranked map */
function aggregateQueryCategories(patterns: TenantPattern[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const p of patterns) {
    const cats = p.queryCategories as Record<string, number> | null;
    if (!cats || typeof cats !== 'object') continue;
    for (const [cat, count] of Object.entries(cats)) {
      if (typeof count === 'number') {
        result[cat] = (result[cat] ?? 0) + count;
      }
    }
  }
  return result;
}

/** Aggregate skill usage from patterns into a ranked map */
function aggregateSkillUsage(patterns: TenantPattern[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const p of patterns) {
    const skills = p.skillUsage as Record<string, number> | null;
    if (!skills || typeof skills !== 'object') continue;
    for (const [skill, count] of Object.entries(skills)) {
      if (typeof count === 'number') {
        result[skill] = (result[skill] ?? 0) + count;
      }
    }
  }
  return result;
}

/**
 * Count pattern records as a proxy for tenant activity.
 * NOTE: This is an upper-bound approximation — each pattern is one tenant-date
 * entry, so multi-period data may overcount. The API should ideally return a
 * pre-aggregated tenantCount per industry to avoid transmitting tenantId to
 * the frontend (privacy concern). See ISSUE #21.
 */
function countPatternRecords(patterns: TenantPattern[]): number {
  return patterns.length;
}

/** Aggregate correction types from corrections */
function aggregateCorrectionTypes(corrections: TenantCorrection[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const c of corrections) {
    result[c.correctionType] = (result[c.correctionType] ?? 0) + c.occurrenceCount;
  }
  return result;
}

/** Sort entries descending by value, return top N */
function topEntries(data: Record<string, number>, limit = 8): [string, number][] {
  return Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function IndustrySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border/50 p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-5 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Industry Selector
// ---------------------------------------------------------------------------

function IndustrySelector({
  value,
  onChange,
  label,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  id: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'appearance-none rounded-[var(--radius-button)] border border-border bg-background',
            'py-1.5 pl-3 pr-8 text-sm font-medium',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            'transition-colors hover:bg-muted/30',
          )}
        >
          {INDUSTRIES.map((ind) => (
            <option key={ind.value} value={ind.value}>
              {ind.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranked Bar List (reusable within section)
// ---------------------------------------------------------------------------

function RankedBarList({
  title,
  icon: Icon,
  data,
  emptyLabel,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  data: [string, number][];
  emptyLabel: string;
}) {
  const maxVal = data.length > 0 ? (data[0]?.[1] ?? 0) : 0;

  return (
    <div className="rounded-lg border border-border/50 p-4">
      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </h4>

      {data.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-1.5" role="list" aria-label={title}>
          {data.map(([name, count], idx) => {
            const widthPercent = maxVal > 0 ? Math.max((count / maxVal) * 100, 2) : 0;
            const barColor = BAR_COLORS[idx % BAR_COLORS.length];

            return (
              <div key={name} className="group flex items-center gap-2" role="listitem">
                <span className="w-28 shrink-0 truncate text-right text-xs font-medium text-muted-foreground">
                  {name}
                </span>
                <div className="relative h-4 flex-1 rounded bg-muted/30">
                  <div
                    className={cn(
                      'h-full rounded transition-all duration-300',
                      barColor,
                      'motion-reduce:transition-none',
                    )}
                    style={{ width: `${widthPercent}%` }}
                    role="presentation"
                  />
                </div>
                <span className="mono-amount w-10 shrink-0 text-right text-xs text-muted-foreground">
                  {count.toLocaleString('en-GB')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Screen reader summary */}
      {data.length > 0 && (
        <div className="sr-only">
          {title}: {data.map(([name, count]) => `${name}: ${count}`).join(', ')}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Correction Category Badges
// ---------------------------------------------------------------------------

const CORRECTION_COLORS: Record<string, { bg: string; text: string }> = {
  TERMINOLOGY: { bg: 'bg-blue-100', text: 'text-blue-700' },
  PROCESS: { bg: 'bg-amber-100', text: 'text-amber-700' },
  DATA: { bg: 'bg-green-100', text: 'text-green-700' },
  PREFERENCE: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

function CorrectionBadges({ data }: { data: [string, number][] }) {
  if (data.length === 0) {
    return <p className="py-3 text-center text-xs text-muted-foreground">No correction data</p>;
  }

  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Common correction types">
      {data.map(([type, count]) => {
        const color = CORRECTION_COLORS[type] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
        return (
          <span
            key={type}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
              color.bg,
              color.text,
            )}
            role="listitem"
          >
            {type}
            <span className="mono-amount ml-0.5 text-[10px] opacity-70">
              ({count.toLocaleString('en-GB')})
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Industry Panel — renders the 4 sub-panels for one industry
// ---------------------------------------------------------------------------

interface IndustryPanelData {
  queryCategories: [string, number][];
  skillUsage: [string, number][];
  correctionTypes: [string, number][];
  tenantCount: number;
}

function IndustryPanel({ label, data }: { label: string; data: IndustryPanelData }) {
  return (
    <div className="space-y-4">
      {/* Tenant count KPI */}
      <div className="flex items-center gap-2 rounded-lg border border-border/50 p-4">
        <Users className="h-5 w-5 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs text-muted-foreground">Tenants in {label || 'All Industries'}</p>
          <p className="mono-amount text-xl font-bold text-foreground">
            {data.tenantCount.toLocaleString('en-GB')}
          </p>
        </div>
      </div>

      {/* Sub-panels in 2-column grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <RankedBarList
          title="Top Query Categories"
          icon={BarChart3}
          data={data.queryCategories}
          emptyLabel="No query data"
        />

        <RankedBarList
          title="Most-Used Skills"
          icon={Wrench}
          data={data.skillUsage}
          emptyLabel="No skill data"
        />
      </div>

      {/* Correction types */}
      <div className="rounded-lg border border-border/50 p-4">
        <h4 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          Common Correction Types
        </h4>
        <CorrectionBadges data={data.correctionTypes} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook: derive panel data from patterns + corrections
// ---------------------------------------------------------------------------

function useIndustryPanelData(
  patterns: TenantPattern[],
  corrections: TenantCorrection[],
): IndustryPanelData {
  return useMemo(() => {
    const queryCategories = topEntries(aggregateQueryCategories(patterns));
    const skillUsage = topEntries(aggregateSkillUsage(patterns));
    const correctionTypes = topEntries(aggregateCorrectionTypes(corrections));
    const tenantCount = countPatternRecords(patterns);
    return { queryCategories, skillUsage, correctionTypes, tenantCount };
  }, [patterns, corrections]);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function IndustryBreakdownSection() {
  const [industry1, setIndustry1] = useState('');
  const [industry2, setIndustry2] = useState('');
  const [compareMode, setCompareMode] = useState(false);

  // Fetch patterns for each industry (server-side industry filter)
  const patternsQuery1 = usePatterns(industry1 ? { industry: industry1 } : {});
  const patternsQuery2 = usePatterns(compareMode && industry2 ? { industry: industry2 } : {}, {
    enabled: compareMode && !!industry2,
  });

  // Single corrections query — shared between both panels, filtered client-side by industry
  const correctionsQuery = useCorrections({});

  // Flatten paginated data
  const patterns1 = useMemo(
    () => patternsQuery1.data?.pages.flatMap((p) => p.data) ?? [],
    [patternsQuery1.data],
  );
  const patterns2 = useMemo(
    () => patternsQuery2.data?.pages.flatMap((p) => p.data) ?? [],
    [patternsQuery2.data],
  );

  // All fetched corrections (single query, filtered client-side per industry)
  const allCorrections = useMemo(
    () => correctionsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [correctionsQuery.data],
  );
  const corrections1 = useMemo(() => {
    if (!industry1) return allCorrections;
    return allCorrections.filter((c) => c.industry === industry1);
  }, [allCorrections, industry1]);
  const corrections2 = useMemo(() => {
    if (!industry2) return allCorrections;
    return allCorrections.filter((c) => c.industry === industry2);
  }, [allCorrections, industry2]);

  // Derive panel data
  const panelData1 = useIndustryPanelData(patterns1, corrections1);
  const panelData2 = useIndustryPanelData(patterns2, corrections2);

  const isLoading = patternsQuery1.isLoading || correctionsQuery.isLoading;
  const isLoadingCompare = compareMode && patternsQuery2.isLoading;
  const error = patternsQuery1.error ?? correctionsQuery.error;

  const handleToggleCompare = useCallback(() => {
    setCompareMode((prev) => {
      const entering = !prev;
      if (entering) {
        // Default second industry to something different from the first
        setIndustry2((currentIndustry2) => {
          if (currentIndustry2) return currentIndustry2;
          const other = INDUSTRIES.find((ind) => ind.value !== '' && ind.value !== industry1);
          return other?.value ?? '';
        });
      }
      return entering;
    });
  }, [industry1]);

  const industryLabel1 =
    INDUSTRIES.find((ind) => ind.value === industry1)?.label ?? 'All Industries';
  const industryLabel2 =
    INDUSTRIES.find((ind) => ind.value === industry2)?.label ?? 'All Industries';

  // ----- Loading -----
  if (isLoading) {
    return (
      <section
        className="animate-fade-in-up rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]"
        aria-label="Industry Breakdown"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Industry Breakdown
          </h2>
          <p className="text-sm text-muted-foreground">Patterns grouped by tenant industry</p>
        </div>
        <IndustrySkeleton />
      </section>
    );
  }

  // ----- Error -----
  if (error) {
    return (
      <section
        className="animate-fade-in-up rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]"
        aria-label="Industry Breakdown"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Industry Breakdown
          </h2>
        </div>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm">Failed to load industry data</span>
        </div>
        <button
          onClick={() => {
            void patternsQuery1.refetch();
            void correctionsQuery.refetch();
          }}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      </section>
    );
  }

  // ----- Data -----
  return (
    <section
      className="animate-fade-in-up rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
      aria-label="Industry Breakdown"
    >
      {/* Header with controls */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Industry Breakdown
          </h2>
          <p className="text-sm text-muted-foreground">Patterns grouped by tenant industry</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <IndustrySelector
            value={industry1}
            onChange={setIndustry1}
            label="Industry"
            id="industry-primary"
          />

          <button
            onClick={handleToggleCompare}
            className={cn(
              'rounded-[var(--radius-button)] border px-3 py-1.5 text-xs font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              compareMode
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted/30',
            )}
            aria-pressed={compareMode}
          >
            <Building2 className="mr-1 inline-block h-3.5 w-3.5" aria-hidden="true" />
            Compare Industries
          </button>

          {compareMode && (
            <IndustrySelector
              value={industry2}
              onChange={setIndustry2}
              label="vs"
              id="industry-compare"
            />
          )}
        </div>
      </div>

      {/* Content — single or comparison mode */}
      {patterns1.length === 0 && corrections1.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Building2 className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">
            No data for {industryLabel1} — run aggregation to collect intelligence
          </p>
        </div>
      ) : compareMode ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Industry 1 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{industryLabel1}</h3>
            <IndustryPanel label={industryLabel1} data={panelData1} />
          </div>

          {/* Industry 2 */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{industryLabel2}</h3>
            {isLoadingCompare ? (
              <IndustrySkeleton />
            ) : (
              <IndustryPanel label={industryLabel2} data={panelData2} />
            )}
          </div>
        </div>
      ) : (
        <IndustryPanel label={industryLabel1} data={panelData1} />
      )}
    </section>
  );
}
