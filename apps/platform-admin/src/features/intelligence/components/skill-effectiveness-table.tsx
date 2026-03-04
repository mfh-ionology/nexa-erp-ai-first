import { useState, useCallback, useMemo } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AlertTriangle,
  ChevronRight,
  Filter,
  RefreshCw,
  BarChart3,
} from 'lucide-react';

import { useSkillEffectiveness } from '@/api/use-intelligence';
import { cn } from '@/lib/utils';

import type { SkillEffectiveness, SkillTrend } from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const TREND_CONFIG: Record<SkillTrend, { icon: typeof ArrowUp; color: string; label: string }> = {
  IMPROVING: { icon: ArrowUp, color: 'text-[var(--confidence-high)]', label: 'Improving' },
  STABLE: { icon: ArrowRight, color: 'text-[var(--confidence-medium)]', label: 'Stable' },
  DECLINING: { icon: ArrowDown, color: 'text-[var(--confidence-low)]', label: 'Declining' },
};

const MODULE_OPTIONS = [
  'All',
  'AR',
  'AP',
  'Finance',
  'Sales',
  'Purchasing',
  'Inventory',
  'CRM',
  'HR',
  'Manufacturing',
  'Reporting',
  'System',
] as const;

type SortField =
  | 'skillKey'
  | 'module'
  | 'avgSuccessRate'
  | 'avgCorrectionRate'
  | 'totalQueries'
  | 'tenantCount'
  | 'avgConfidence'
  | 'trend';

type SortDirection = 'ascending' | 'descending';

interface SortState {
  field: SortField;
  direction: SortDirection;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract module name from a skill key (e.g. "ar.aging_report" → "AR") */
function extractModuleFromSkillKey(skillKey: string): string {
  const prefix = skillKey.split('.')[0];
  if (!prefix) return 'Other';
  return prefix.toUpperCase();
}

/** Parse decimal string to number, defaulting to 0 */
function parseDecimal(value: string): number {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

/** Format a decimal (0–1 range) as percentage with 1 decimal place */
function formatPercent(value: string): string {
  const n = parseDecimal(value);
  return (n * 100).toFixed(1);
}

/** Get success rate colour class based on percentage */
function getSuccessRateClass(value: string): string {
  const pct = parseDecimal(value) * 100;
  if (pct > 80) return 'bg-green-50 text-green-800';
  if (pct >= 50) return 'bg-amber-50 text-amber-800';
  return 'bg-red-50 text-red-800';
}

/** Get success rate label for accessibility */
function getSuccessRateLabel(value: string): string {
  const pct = parseDecimal(value) * 100;
  if (pct > 80) return 'High';
  if (pct >= 50) return 'Medium';
  return 'Low';
}

/** Sort comparator for skill effectiveness rows */
function compareRows(a: SkillEffectiveness, b: SkillEffectiveness, field: SortField): number {
  switch (field) {
    case 'skillKey':
      return a.skillKey.localeCompare(b.skillKey);
    case 'module':
      return extractModuleFromSkillKey(a.skillKey).localeCompare(
        extractModuleFromSkillKey(b.skillKey),
      );
    case 'avgSuccessRate':
      return parseDecimal(a.avgSuccessRate) - parseDecimal(b.avgSuccessRate);
    case 'avgCorrectionRate':
      return parseDecimal(a.avgCorrectionRate) - parseDecimal(b.avgCorrectionRate);
    case 'totalQueries':
      return a.totalQueries - b.totalQueries;
    case 'tenantCount':
      return a.tenantCount - b.tenantCount;
    case 'avgConfidence':
      return parseDecimal(a.avgConfidence) - parseDecimal(b.avgConfidence);
    case 'trend': {
      const trendOrder: Record<string, number> = { DECLINING: 0, STABLE: 1, IMPROVING: 2 };
      return (trendOrder[a.trend ?? 'STABLE'] ?? 1) - (trendOrder[b.trend ?? 'STABLE'] ?? 1);
    }
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface Column {
  key: SortField;
  label: string;
  shortLabel?: string;
  className?: string;
}

const COLUMNS: Column[] = [
  { key: 'skillKey', label: 'Skill Name', className: 'text-left' },
  { key: 'module', label: 'Module', className: 'text-left' },
  {
    key: 'avgSuccessRate',
    label: 'Avg Success Rate',
    shortLabel: 'Success %',
    className: 'text-right',
  },
  {
    key: 'avgCorrectionRate',
    label: 'Avg Correction Rate',
    shortLabel: 'Correction %',
    className: 'text-right',
  },
  { key: 'totalQueries', label: 'Usage Count', shortLabel: 'Usage', className: 'text-right' },
  { key: 'tenantCount', label: 'Tenant Count', shortLabel: 'Tenants', className: 'text-right' },
  { key: 'avgConfidence', label: 'Confidence', className: 'text-right' },
  { key: 'trend', label: 'Trend', className: 'text-center' },
];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 px-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="flex-1" />
          <div className="h-4 w-14 animate-pulse rounded bg-muted" />
          <div className="h-4 w-14 animate-pulse rounded bg-muted" />
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="h-4 w-14 animate-pulse rounded bg-muted" />
          <div className="h-4 w-10 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend Indicator
// ---------------------------------------------------------------------------

function TrendIndicator({ trend }: { trend: string | null }) {
  const key = (trend as SkillTrend) ?? 'STABLE';
  const config = TREND_CONFIG[key] ?? TREND_CONFIG.STABLE;
  const Icon = config.icon;

  return (
    <span
      className={cn('inline-flex items-center gap-1', config.color)}
      aria-label={`Trend: ${config.label}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="text-xs font-medium">{config.label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sort Header
// ---------------------------------------------------------------------------

function SortHeader({
  column,
  sort,
  onSort,
}: {
  column: Column;
  sort: SortState;
  onSort: (field: SortField) => void;
}) {
  const isActive = sort.field === column.key;
  const ariaSortValue = isActive ? sort.direction : undefined;

  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
        'cursor-pointer select-none hover:text-foreground transition-colors',
        'focus-within:text-foreground',
        column.className,
      )}
      aria-sort={ariaSortValue}
    >
      <button
        onClick={() => onSort(column.key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSort(column.key);
          }
        }}
        className={cn(
          'inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1 rounded px-1 py-0.5',
          column.className === 'text-right' && 'ml-auto',
          column.className === 'text-center' && 'mx-auto',
        )}
        aria-label={`Sort by ${column.label}${isActive ? `, currently ${sort.direction}` : ''}`}
      >
        <span className="hidden sm:inline">{column.label}</span>
        <span className="sm:hidden">{column.shortLabel ?? column.label}</span>
        {isActive && (
          <span aria-hidden="true">
            {sort.direction === 'ascending' ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
          </span>
        )}
      </button>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Component: SkillEffectivenessTable
// ---------------------------------------------------------------------------

export interface SkillEffectivenessTableProps {
  /** Callback to filter the Corrections section by a skill key */
  onFilterBySkill?: (skillKey: string) => void;
}

export function SkillEffectivenessTable({ onFilterBySkill }: SkillEffectivenessTableProps) {
  const [moduleFilter, setModuleFilter] = useState<string>('All');
  const [sort, setSort] = useState<SortState>({ field: 'avgSuccessRate', direction: 'descending' });

  const { data, isLoading, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useSkillEffectiveness({ limit: PAGE_SIZE });

  // Flatten all pages
  const allRows = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  // Apply module filter
  const filteredRows = useMemo(() => {
    if (moduleFilter === 'All') return allRows;
    return allRows.filter((row) => extractModuleFromSkillKey(row.skillKey) === moduleFilter);
  }, [allRows, moduleFilter]);

  // Apply sort
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => compareRows(a, b, sort.field));
    if (sort.direction === 'descending') sorted.reverse();
    return sorted;
  }, [filteredRows, sort]);

  // All loaded rows are displayed (server handles pagination via cursor)
  const pagedRows = sortedRows;

  const handleModuleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setModuleFilter(e.target.value);
  }, []);

  // Toggle sort
  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === 'ascending' ? 'descending' : 'ascending',
    }));
  }, []);

  const handleNextPage = useCallback(() => {
    if (hasNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  // ----- Loading -----
  if (isLoading) {
    return (
      <section
        className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up"
        aria-label="Skill Effectiveness"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Skill Effectiveness
          </h2>
          <p className="text-sm text-muted-foreground">Cross-tenant skill performance metrics</p>
        </div>
        <TableSkeleton />
      </section>
    );
  }

  // ----- Error -----
  if (error) {
    return (
      <section
        className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up"
        aria-label="Skill Effectiveness"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Skill Effectiveness
          </h2>
        </div>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm">Failed to load skill effectiveness data</span>
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
  if (allRows.length === 0) {
    return (
      <section
        className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up"
        aria-label="Skill Effectiveness"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Skill Effectiveness
          </h2>
          <p className="text-sm text-muted-foreground">Cross-tenant skill performance metrics</p>
        </div>
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <BarChart3 className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm">No skill data yet — run aggregation to collect intelligence</p>
        </div>
      </section>
    );
  }

  // ----- Data -----
  return (
    <section
      className="rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)] animate-fade-in-up"
      aria-label="Skill Effectiveness"
    >
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Skill Effectiveness
          </h2>
          <p className="text-sm text-muted-foreground">Cross-tenant skill performance metrics</p>
        </div>

        {/* Module filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="module-filter" className="sr-only">
            Filter by module
          </label>
          <select
            id="module-filter"
            value={moduleFilter}
            onChange={handleModuleChange}
            className={cn(
              'rounded-md border border-border bg-background px-3 py-1.5 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
            )}
          >
            {MODULE_OPTIONS.map((mod) => (
              <option key={mod} value={mod}>
                {mod === 'All' ? 'All Modules' : mod}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table wrapper — horizontally scrollable on small screens */}
      <div
        className="overflow-x-auto -mx-5 px-5"
        role="region"
        aria-label="Skill effectiveness data table"
        tabIndex={0}
      >
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((col) => (
                <SortHeader key={col.key} column={col} sort={sort} onSort={handleSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => {
              const module = extractModuleFromSkillKey(row.skillKey);
              const correctionPct = parseDecimal(row.avgCorrectionRate) * 100;
              const confidencePct = parseDecimal(row.avgConfidence) * 100;
              const highCorrection = correctionPct > 30;

              return (
                <tr
                  key={row.id}
                  className="border-b border-border/50 transition-colors hover:bg-muted/30"
                >
                  {/* Skill Name */}
                  <td className="px-3 py-3 text-sm text-foreground">
                    {onFilterBySkill ? (
                      <button
                        onClick={() => onFilterBySkill(row.skillKey)}
                        className="font-medium text-primary hover:text-primary-dark hover:underline focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-0.5"
                        title={`Filter corrections by ${row.skillKey}`}
                      >
                        {row.skillKey}
                      </button>
                    ) : (
                      <span className="font-medium">{row.skillKey}</span>
                    )}
                  </td>

                  {/* Module */}
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      {module}
                    </span>
                  </td>

                  {/* Avg Success Rate */}
                  <td className="px-3 py-3 text-right">
                    <span
                      className={cn(
                        'mono-amount inline-flex items-center rounded px-2 py-0.5 text-sm font-medium',
                        getSuccessRateClass(row.avgSuccessRate),
                      )}
                      aria-label={`Success rate: ${formatPercent(row.avgSuccessRate)}%, ${getSuccessRateLabel(row.avgSuccessRate)}`}
                    >
                      {formatPercent(row.avgSuccessRate)}%
                    </span>
                  </td>

                  {/* Avg Correction Rate */}
                  <td className="px-3 py-3 text-right">
                    <span className="mono-amount inline-flex items-center gap-1 text-sm">
                      {correctionPct.toFixed(1)}%
                      {highCorrection && (
                        <AlertTriangle
                          className="h-4 w-4 text-[var(--confidence-medium)]"
                          aria-label="High correction rate warning: above 30%"
                        />
                      )}
                    </span>
                  </td>

                  {/* Usage Count */}
                  <td className="px-3 py-3 text-right">
                    <span className="mono-amount text-sm">
                      {row.totalQueries.toLocaleString('en-GB')}
                    </span>
                  </td>

                  {/* Tenant Count */}
                  <td className="px-3 py-3 text-right">
                    <span className="mono-amount text-sm">
                      {row.tenantCount.toLocaleString('en-GB')}
                    </span>
                  </td>

                  {/* Confidence */}
                  <td className="px-3 py-3 text-right">
                    <span className="mono-amount text-sm">{confidencePct.toFixed(1)}%</span>
                  </td>

                  {/* Trend */}
                  <td className="px-3 py-3 text-center">
                    <TrendIndicator trend={row.trend} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
        <p className="text-xs text-muted-foreground">
          Showing{' '}
          <span className="mono-amount font-medium">
            {sortedRows.length}
            {hasNextPage ? '+' : ''}
          </span>{' '}
          skills
          {moduleFilter !== 'All' && (
            <span>
              {' '}
              in <span className="font-medium">{moduleFilter}</span>
            </span>
          )}
        </p>

        {hasNextPage && (
          <button
            onClick={handleNextPage}
            disabled={isFetchingNextPage}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium',
              'hover:bg-muted/50 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
            aria-label="Load more skills"
          >
            {isFetchingNextPage ? (
              <RefreshCw className="h-3 w-3 animate-spin" aria-label="Loading more data" />
            ) : (
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            )}
            {isFetchingNextPage ? 'Loading…' : 'Load More'}
          </button>
        )}
      </div>
    </section>
  );
}
