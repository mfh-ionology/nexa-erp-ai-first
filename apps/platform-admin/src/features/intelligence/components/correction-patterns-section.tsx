import { useState, useMemo, useCallback, useEffect } from 'react';
import { AlertCircle, BookPlus, ChevronDown, Filter, RefreshCw, ShieldAlert } from 'lucide-react';

import { useCorrections } from '@/api/use-intelligence';
import { cn } from '@/lib/utils';

import type { TenantCorrection } from '@/types/intelligence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CorrectionPrefill {
  title: string;
  content: string;
  category: 'BEST_PRACTICE' | 'HELP' | 'DEFAULT_CONFIG' | 'SKILL_UPDATE';
  sourceInsightId?: string;
}

export interface CorrectionPatternsSectionProps {
  /** Called when the user clicks "Create Knowledge Article" on a correction */
  onCreateKnowledgeArticle?: (prefill: CorrectionPrefill) => void;
  /** External skill filter (e.g. set by the Skill Effectiveness table) */
  externalSkillFilter?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CORRECTION_CATEGORIES = [
  { value: 'TERMINOLOGY', label: 'Terminology' },
  { value: 'PROCESS', label: 'Process' },
  { value: 'DATA', label: 'Data' },
  { value: 'PREFERENCE', label: 'Preference' },
] as const;

type CorrectionCategory = (typeof CORRECTION_CATEGORIES)[number]['value'];

const CATEGORY_STYLES: Record<CorrectionCategory, { bg: string; text: string; border: string }> = {
  TERMINOLOGY: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  PROCESS: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  DATA: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  PREFERENCE: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

const ITEMS_PER_PAGE = 10;

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CorrectionsSkeleton() {
  return (
    <div className="space-y-3">
      {/* Category tabs skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      {/* Rows skeleton */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
          <div className="flex-1 space-y-1">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Tab
// ---------------------------------------------------------------------------

function CategoryTab({
  category,
  label,
  count,
  isActive,
  onClick,
}: {
  category: CorrectionCategory;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const styles = CATEGORY_STYLES[category];

  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${category}`}
      id={`tab-${category}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        isActive
          ? cn(styles.bg, styles.text, styles.border)
          : 'border-border text-muted-foreground hover:bg-muted/30',
      )}
    >
      {label}
      <span
        className={cn(
          'mono-amount ml-0.5 rounded-full px-1.5 py-0.5 text-[10px]',
          isActive ? 'bg-white/60' : 'bg-muted',
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Skill Filter
// ---------------------------------------------------------------------------

function SkillFilter({
  skills,
  value,
  onChange,
}: {
  skills: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (skills.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <label htmlFor="skill-filter" className="sr-only">
        Filter by skill
      </label>
      <select
        id="skill-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'appearance-none rounded-[var(--radius-button)] border border-border bg-background',
          'py-1.5 pl-3 pr-8 text-xs font-medium',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
          'transition-colors hover:bg-muted/30',
        )}
      >
        <option value="">All Skills</option>
        {skills.map((skill) => (
          <option key={skill} value={skill}>
            {skill}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none -ml-6 h-3.5 w-3.5 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Correction Row
// ---------------------------------------------------------------------------

function CorrectionRow({
  correction,
  onCreateKnowledgeArticle,
}: {
  correction: TenantCorrection;
  onCreateKnowledgeArticle?: (prefill: CorrectionPrefill) => void;
}) {
  const handleCreateArticle = useCallback(() => {
    const title = correction.skillKey
      ? `AI Correction: ${correction.correctionType} — ${correction.skillKey}`
      : `AI Correction: ${correction.correctionType}`;

    const content = [
      `## Correction Pattern`,
      '',
      `**Type:** ${correction.correctionType}`,
      correction.skillKey ? `**Skill:** ${correction.skillKey}` : null,
      `**Occurrences:** ${correction.occurrenceCount.toLocaleString('en-GB')} across ${correction.tenantCount} tenant${correction.tenantCount === 1 ? '' : 's'}`,
      '',
      correction.commonCorrection
        ? `### Common Correction\n\n${correction.commonCorrection}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    onCreateKnowledgeArticle?.({
      title,
      content,
      category: 'BEST_PRACTICE',
    });
  }, [correction, onCreateKnowledgeArticle]);

  const categoryStyle = CATEGORY_STYLES[correction.correctionType as CorrectionCategory] ?? {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/30">
      {/* Category badge */}
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
          categoryStyle.bg,
          categoryStyle.text,
          categoryStyle.border,
        )}
        aria-label={`Category: ${correction.correctionType}`}
      >
        {correction.correctionType}
      </span>

      {/* Skill badge (if present) */}
      {correction.skillKey && (
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
          {correction.skillKey}
        </span>
      )}

      {/* Description */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          {correction.commonCorrection ?? 'No correction text available'}
        </p>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="mono-amount" title="Occurrence count">
          {correction.occurrenceCount.toLocaleString('en-GB')}×
        </span>
        <span className="mono-amount" title="Tenant count">
          {correction.tenantCount} {correction.tenantCount === 1 ? 'tenant' : 'tenants'}
        </span>
      </div>

      {/* Create Knowledge Article action */}
      {onCreateKnowledgeArticle && (
        <button
          onClick={handleCreateArticle}
          className={cn(
            'flex items-center gap-1 rounded-[var(--radius-button)] border border-border px-2 py-1 text-xs font-medium',
            'text-primary hover:bg-primary/5 hover:border-primary/30',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            'transition-colors',
          )}
          title="Create Knowledge Article from this correction pattern"
        >
          <BookPlus className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Create Article</span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CorrectionPatternsSection({
  onCreateKnowledgeArticle,
  externalSkillFilter,
}: CorrectionPatternsSectionProps) {
  const [activeCategory, setActiveCategory] = useState<CorrectionCategory>('TERMINOLOGY');
  const [skillFilter, setSkillFilter] = useState('');

  // Sync external skill filter (e.g. from Skill Effectiveness table click)
  useEffect(() => {
    if (externalSkillFilter !== undefined) {
      setSkillFilter(externalSkillFilter);
      setDisplayCount(ITEMS_PER_PAGE);
    }
  }, [externalSkillFilter]);

  // Fetch all corrections (no category filter) — single query serves both
  // the active tab display (filtered client-side) and tab counts
  const { data, isLoading, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useCorrections(skillFilter ? { skillKey: skillFilter } : {});

  // Flatten paginated pages
  const allFetchedCorrections = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  // Filter by active category for display
  const allCorrections = useMemo(
    () => allFetchedCorrections.filter((c) => c.correctionType === activeCategory),
    [allFetchedCorrections, activeCategory],
  );

  // Count per category from the same data set — no second query needed
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      TERMINOLOGY: 0,
      PROCESS: 0,
      DATA: 0,
      PREFERENCE: 0,
    };
    for (const c of allFetchedCorrections) {
      if (c.correctionType in counts) {
        counts[c.correctionType] = (counts[c.correctionType] ?? 0) + 1;
      }
    }
    return counts;
  }, [allFetchedCorrections]);

  // Extract unique skills for the filter dropdown
  const uniqueSkills = useMemo(() => {
    const skills = new Set<string>();
    for (const c of allFetchedCorrections) {
      if (c.skillKey) skills.add(c.skillKey);
    }
    return Array.from(skills).sort();
  }, [allFetchedCorrections]);

  // Paginate client-side within the active tab
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const displayCorrections = allCorrections.slice(0, displayCount);
  const hasMoreLocal = allCorrections.length > displayCount || hasNextPage;

  const handleShowMore = useCallback(() => {
    if (displayCount >= allCorrections.length && hasNextPage) {
      void fetchNextPage();
    }
    setDisplayCount((prev) => prev + ITEMS_PER_PAGE);
  }, [displayCount, allCorrections.length, hasNextPage, fetchNextPage]);

  const handleCategoryChange = useCallback((cat: CorrectionCategory) => {
    setActiveCategory(cat);
    setDisplayCount(ITEMS_PER_PAGE);
  }, []);

  // ----- Loading -----
  if (isLoading) {
    return (
      <section
        className="animate-fade-in-up rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]"
        aria-label="Correction Patterns"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Correction Patterns
          </h2>
          <p className="text-sm text-muted-foreground">Most common AI mistakes across tenants</p>
        </div>
        <CorrectionsSkeleton />
      </section>
    );
  }

  // ----- Error -----
  if (error) {
    return (
      <section
        className="animate-fade-in-up rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)]"
        aria-label="Correction Patterns"
      >
        <div className="mb-4">
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Correction Patterns
          </h2>
        </div>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm">Failed to load correction patterns</span>
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

  // ----- Data -----
  return (
    <section
      className="animate-fade-in-up rounded-[var(--radius-card)] bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
      aria-label="Correction Patterns"
    >
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="heading-section text-lg font-semibold text-foreground">
            Correction Patterns
          </h2>
          <p className="text-sm text-muted-foreground">Most common AI mistakes across tenants</p>
        </div>

        {/* Skill filter */}
        <SkillFilter skills={uniqueSkills} value={skillFilter} onChange={setSkillFilter} />
      </div>

      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Correction categories">
        {CORRECTION_CATEGORIES.map((cat) => (
          <CategoryTab
            key={cat.value}
            category={cat.value}
            label={cat.label}
            count={categoryCounts[cat.value] ?? 0}
            isActive={activeCategory === cat.value}
            onClick={() => handleCategoryChange(cat.value)}
          />
        ))}
      </div>

      {/* Active category panel */}
      <div role="tabpanel" id={`panel-${activeCategory}`} aria-labelledby={`tab-${activeCategory}`}>
        {/* Empty state */}
        {allCorrections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <ShieldAlert className="h-8 w-8" aria-hidden="true" />
            <p className="text-sm">
              No {activeCategory.toLowerCase()} corrections found
              {skillFilter ? ` for skill "${skillFilter}"` : ''} — run aggregation to collect
              intelligence
            </p>
          </div>
        ) : (
          <>
            {/* Correction list */}
            <div className="space-y-2" role="list" aria-label={`${activeCategory} corrections`}>
              {displayCorrections.map((correction) => (
                <div key={correction.id} role="listitem">
                  <CorrectionRow
                    correction={correction}
                    onCreateKnowledgeArticle={onCreateKnowledgeArticle}
                  />
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMoreLocal && (
              <div className="mt-4 flex items-center justify-center">
                <button
                  onClick={handleShowMore}
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
          </>
        )}
      </div>
    </section>
  );
}
