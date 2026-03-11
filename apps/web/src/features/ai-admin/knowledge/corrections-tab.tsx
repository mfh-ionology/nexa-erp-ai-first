/* eslint-disable i18next/no-literal-string */
/**
 * Corrections Tab — read-only correction log with stats row, accordion-grouped list,
 * and "Create Article from Correction" flow.
 *
 * AC-6: Corrections displayed in two parts:
 *   1. Stats row (total, last 30 days trend, type breakdown bar, auto-resolved %)
 *   2. Corrections list grouped by correctionType (collapsible accordions)
 * Corrections are immutable (no edit/delete). Each can generate a knowledge article.
 * Concept D: 12px radius, custom shadow, purple-tinted hover shadow.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookPlus,
  Calendar,
  ChevronDown,
  Filter,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { CorrectionLog, CorrectionStats, CorrectionType } from '../api/types';
import { useCorrections, useCorrectionStats } from '../api/use-corrections';

// ─── Constants ──────────────────────────────────────────────────────────────

const CORRECTION_TYPE_CONFIG: Record<CorrectionType, { label: string; order: number }> = {
  TERMINOLOGY: { label: 'Terminology', order: 0 },
  PROCESS: { label: 'Process', order: 1 },
  DATA: { label: 'Data', order: 2 },
  PREFERENCE: { label: 'Preference', order: 3 },
  OTHER: { label: 'Other', order: 4 },
};

const ALL_CORRECTION_TYPES = Object.keys(CORRECTION_TYPE_CONFIG) as CorrectionType[];

/** Colours for segmented bar chart (type breakdown). */
const TYPE_COLOURS: Record<CorrectionType, string> = {
  TERMINOLOGY: '#7c3aed',
  PROCESS: '#2563eb',
  DATA: '#059669',
  PREFERENCE: '#d97706',
  OTHER: '#6b7280',
};

type AutoResolvedFilter = 'all' | 'resolved' | 'pending';

interface CorrectionFilters {
  types: CorrectionType[];
  skillKey: string;
  autoResolved: AutoResolvedFilter;
  from: string;
  to: string;
}

const DEFAULT_FILTERS: CorrectionFilters = {
  types: [],
  skillKey: '',
  autoResolved: 'all',
  from: '',
  to: '',
};

// ─── Stats Row ──────────────────────────────────────────────────────────────

function CorrectionStatsRow({ stats, isLoading }: { stats?: CorrectionStats; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const autoResolvedPct =
    stats.total > 0 ? Math.round((stats.autoResolvedCount / stats.total) * 100) : 0;

  // Determine trend direction: compare last 7 days vs previous 7 days
  const trendData = stats.trend ?? [];
  const recent7 = trendData.slice(-7).reduce((sum, d) => sum + d.count, 0);
  const previous7 = trendData.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);
  const trendUp = recent7 > previous7;
  const trendFlat = recent7 === previous7;

  // Total for segmented bar
  const typeTotal = Object.values(stats.byType).reduce((s, v) => s + v, 0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total corrections */}
      <Card className="rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] animate-fade-in-up">
        <CardContent className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">Total Corrections</span>
          <span className="font-mono text-2xl font-semibold">{stats.total.toLocaleString()}</span>
        </CardContent>
      </Card>

      {/* Last 30 days + trend */}
      <Card
        className="rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <CardContent className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">Last 30 Days</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold">
              {stats.last30Days.toLocaleString()}
            </span>
            {!trendFlat && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  trendUp ? 'text-amber-600' : 'text-green-600',
                )}
              >
                {trendUp ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {trendUp ? 'Increasing' : 'Decreasing'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Type breakdown bar */}
      <Card
        className="rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] animate-fade-in-up"
        style={{ animationDelay: '100ms' }}
      >
        <CardContent className="flex flex-col gap-2 p-4">
          <span className="text-xs font-medium text-muted-foreground">By Type</span>
          {typeTotal > 0 ? (
            <>
              {/* Segmented bar */}
              <div
                className="flex h-3 w-full overflow-hidden rounded-full"
                role="img"
                aria-label="Correction type distribution"
              >
                {ALL_CORRECTION_TYPES.map((type) => {
                  const count = stats.byType[type] ?? 0;
                  if (count === 0) return null;
                  const pct = (count / typeTotal) * 100;
                  return (
                    <div
                      key={type}
                      className="h-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: TYPE_COLOURS[type] }}
                      title={`${CORRECTION_TYPE_CONFIG[type].label}: ${count}`}
                    />
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {ALL_CORRECTION_TYPES.map((type) => {
                  const count = stats.byType[type] ?? 0;
                  if (count === 0) return null;
                  return (
                    <span
                      key={type}
                      className="flex items-center gap-1 text-xs text-muted-foreground"
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: TYPE_COLOURS[type] }}
                      />
                      {CORRECTION_TYPE_CONFIG[type].label}
                      <span className="font-mono">{count}</span>
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No data</span>
          )}
        </CardContent>
      </Card>

      {/* Auto-resolved */}
      <Card
        className="rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] animate-fade-in-up"
        style={{ animationDelay: '150ms' }}
      >
        <CardContent className="flex flex-col gap-1 p-4">
          <span className="text-xs font-medium text-muted-foreground">Auto-resolved</span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold">
              {stats.autoResolvedCount.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">
              (<span className="font-mono">{autoResolvedPct}%</span>)
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Filter Bar ────────────────────────────────────────────────────────────

function CorrectionFilterBar({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
}: {
  filters: CorrectionFilters;
  onChange: (filters: CorrectionFilters) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}) {
  const handleTypeToggle = useCallback(
    (type: CorrectionType, checked: boolean) => {
      const next = checked ? [...filters.types, type] : filters.types.filter((t) => t !== type);
      onChange({ ...filters, types: next });
    },
    [filters, onChange],
  );

  const typeLabel =
    filters.types.length === 0
      ? 'All Types'
      : filters.types.length === 1
        ? CORRECTION_TYPE_CONFIG[filters.types[0]!].label
        : `${filters.types.length} types`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Correction type multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-xs',
              filters.types.length > 0 && 'border-[#7c3aed]/40 bg-[#f5f3ff]',
            )}
          >
            <Filter className="size-3.5" />
            {typeLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1">
            {ALL_CORRECTION_TYPES.map((type) => (
              <label
                key={type}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={filters.types.includes(type)}
                  onCheckedChange={(checked) => handleTypeToggle(type, !!checked)}
                />
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: TYPE_COLOURS[type] }}
                  />
                  {CORRECTION_TYPE_CONFIG[type].label}
                </span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Skill key text input */}
      <div className="relative">
        <Input
          placeholder="Filter by skill key..."
          value={filters.skillKey}
          onChange={(e) => onChange({ ...filters, skillKey: e.target.value })}
          className={cn(
            'h-8 w-40 text-xs font-mono',
            filters.skillKey && 'border-[#7c3aed]/40 bg-[#f5f3ff]',
          )}
          aria-label="Filter by skill key"
        />
      </div>

      {/* Auto-resolved toggle */}
      <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
        {[
          { value: 'all' as const, label: 'All' },
          { value: 'resolved' as const, label: 'Resolved' },
          { value: 'pending' as const, label: 'Pending' },
        ].map(({ value, label }) => (
          <Button
            key={value}
            variant={filters.autoResolved === value ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 rounded-md px-2.5 text-xs',
              filters.autoResolved === value && 'bg-background shadow-sm',
            )}
            onClick={() => onChange({ ...filters, autoResolved: value })}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Date range — from */}
      <div className="relative">
        <Calendar className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => onChange({ ...filters, from: e.target.value })}
          className={cn(
            'h-8 w-36 pl-8 text-xs',
            filters.from && 'border-[#7c3aed]/40 bg-[#f5f3ff]',
          )}
          aria-label="Filter from date"
        />
      </div>

      {/* Date range — to */}
      <div className="relative">
        <Calendar className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => onChange({ ...filters, to: e.target.value })}
          className={cn('h-8 w-36 pl-8 text-xs', filters.to && 'border-[#7c3aed]/40 bg-[#f5f3ff]')}
          aria-label="Filter to date"
        />
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 gap-1 text-xs text-muted-foreground"
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ─── Correction Card ───────────────────────────────────────────────────────

function CorrectionCard({
  correction,
  onCreateArticle,
  animationIndex,
}: {
  correction: CorrectionLog;
  onCreateArticle: (correction: CorrectionLog) => void;
  animationIndex: number;
}) {
  return (
    <Card
      className="rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] animate-fade-in-up"
      style={animationIndex <= 8 ? { animationDelay: `${animationIndex * 50}ms` } : undefined}
    >
      <CardContent className="space-y-3 p-4">
        {/* Original response (italic, muted) */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Original Response</p>
          <p className="line-clamp-2 text-sm italic leading-snug text-muted-foreground">
            {correction.originalResponse}
          </p>
        </div>

        {/* Corrected response (bold) */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Corrected Response</p>
          <p className="line-clamp-2 text-sm font-medium leading-snug">
            {correction.correctedResponse}
          </p>
        </div>

        {/* Badges + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Skill key badge */}
            {correction.skillKey && (
              <Badge
                variant="secondary"
                className="border-0 bg-[#7c3aed]/10 font-mono text-xs text-[#7c3aed]"
              >
                {correction.skillKey}
              </Badge>
            )}

            {/* Auto-resolved badge */}
            <Badge
              variant="secondary"
              className={cn(
                'border-0 text-xs',
                correction.wasAutoResolved
                  ? 'bg-green-50 text-green-700'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {correction.wasAutoResolved ? 'Auto-resolved' : 'Pending'}
            </Badge>

            {/* Timestamp */}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(correction.createdAt), { addSuffix: true })}
            </span>
          </div>

          {/* Create Article button */}
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={() => onCreateArticle(correction)}
          >
            <BookPlus className="size-3.5" />
            Create Article
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Grouped Accordion View ────────────────────────────────────────────────

interface TypeGroup {
  type: CorrectionType;
  label: string;
  corrections: CorrectionLog[];
}

function GroupedCorrectionView({
  groups,
  isLoading,
  onCreateArticle,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: {
  groups: TypeGroup[];
  isLoading: boolean;
  onCreateArticle: (correction: CorrectionLog) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-40 rounded-lg" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((__, j) => (
                <Skeleton key={j} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No corrections found. Corrections appear here when users correct AI responses.
        </p>
      </div>
    );
  }

  const defaultExpanded = groups.slice(0, 3).map((g) => g.type);

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={defaultExpanded}>
        {groups.map((group) => (
          <AccordionItem key={group.type} value={group.type}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: TYPE_COLOURS[group.type] }}
                />
                <Badge
                  variant="secondary"
                  className="border border-[#6d28d9]/20 bg-[#ede9fe] text-xs text-[#6d28d9]"
                >
                  {group.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ({group.corrections.length}{' '}
                  {group.corrections.length === 1 ? 'correction' : 'corrections'})
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {group.corrections.map((correction, idx) => (
                  <CorrectionCard
                    key={correction.id}
                    correction={correction}
                    onCreateArticle={onCreateArticle}
                    animationIndex={idx + 1}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="gap-1.5"
          >
            <ChevronDown className="size-4" />
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Tab Component ────────────────────────────────────────────────────

export interface CorrectionsTabProps {
  onCreateArticleFromCorrection: (correction: CorrectionLog) => void;
}

export function CorrectionsTab({ onCreateArticleFromCorrection }: CorrectionsTabProps) {
  // ── Filters ──
  const [filters, setFilters] = useState<CorrectionFilters>(DEFAULT_FILTERS);

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.skillKey !== '' ||
    filters.autoResolved !== 'all' ||
    filters.from !== '' ||
    filters.to !== '';

  const handleClearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  // ── Query params (server-side filtering) ──
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = {};
    if (filters.types.length === 1) params.correctionType = filters.types[0];
    if (filters.skillKey) params.skillKey = filters.skillKey;
    if (filters.autoResolved === 'resolved') params.wasAutoResolved = true;
    if (filters.autoResolved === 'pending') params.wasAutoResolved = false;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    return params;
  }, [filters.types, filters.skillKey, filters.autoResolved, filters.from, filters.to]);

  // ── Data queries (parallel) ──
  const {
    data: correctionsData,
    isLoading: isLoadingList,
    isError: isListError,
    refetch: refetchList,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useCorrections(queryParams);

  const { data: stats, isLoading: isLoadingStats } = useCorrectionStats();

  const allCorrections = correctionsData?.data ?? [];

  // ── Client-side filtering (multi-type when server only supports single) ──
  const filteredCorrections = useMemo(() => {
    if (filters.types.length <= 1) return allCorrections;
    return allCorrections.filter((c) => filters.types.includes(c.correctionType));
  }, [allCorrections, filters.types]);

  // ── Group by correctionType ──
  const typeGroups = useMemo<TypeGroup[]>(() => {
    const map = new Map<CorrectionType, CorrectionLog[]>();

    for (const correction of filteredCorrections) {
      const existing = map.get(correction.correctionType) ?? [];
      existing.push(correction);
      map.set(correction.correctionType, existing);
    }

    return ALL_CORRECTION_TYPES.filter((type) => map.has(type))
      .sort((a, b) => CORRECTION_TYPE_CONFIG[a].order - CORRECTION_TYPE_CONFIG[b].order)
      .map((type) => ({
        type,
        label: CORRECTION_TYPE_CONFIG[type].label,
        corrections: map.get(type)!,
      }));
  }, [filteredCorrections]);

  if (isListError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up">
        <p className="text-sm text-muted-foreground mb-4">Failed to load corrections.</p>
        <Button variant="outline" onClick={() => refetchList()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row (fetched separately — AC-6) */}
      <CorrectionStatsRow stats={stats} isLoading={isLoadingStats} />

      {/* Filter bar */}
      <CorrectionFilterBar
        filters={filters}
        onChange={setFilters}
        onClear={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Grouped corrections list */}
      <GroupedCorrectionView
        groups={typeGroups}
        isLoading={isLoadingList}
        onCreateArticle={onCreateArticleFromCorrection}
        hasMore={hasNextPage}
        onLoadMore={() => void fetchNextPage()}
        isLoadingMore={isFetchingNextPage}
      />
    </div>
  );
}
