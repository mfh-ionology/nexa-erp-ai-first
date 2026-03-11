/* eslint-disable i18next/no-literal-string */
/**
 * Knowledge Articles Tab — category-grouped article cards with filter bar.
 *
 * AC-2: Articles displayed as cards grouped by category sections.
 * AC-3: Upload Document + Create Article action buttons.
 * AC-4: Edit, Confirm, Delete via overflow menu.
 * Concept D: 12px radius, custom shadow, purple-tinted hover shadow.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Edit,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import type { KnowledgeArticle, KnowledgeCategory, KnowledgeSource } from '../api/types';
import { useKnowledgeArticles, useUpdateKnowledgeArticle } from '../api/use-knowledge-articles';

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<KnowledgeCategory, { label: string; order: number }> = {
  BUSINESS_PROCESS: { label: 'Business Processes', order: 0 },
  TERMINOLOGY: { label: 'Terminology', order: 1 },
  INDUSTRY_RULES: { label: 'Industry Rules', order: 2 },
  CUSTOM_FIELDS: { label: 'Custom Fields', order: 3 },
  HISTORICAL_PATTERN: { label: 'Historical Patterns', order: 4 },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as KnowledgeCategory[];

const SOURCE_CONFIG: Record<KnowledgeSource, { label: string; className: string }> = {
  ADMIN_UPLOADED: {
    label: 'Admin',
    className: 'bg-[#7c3aed]/10 text-[#7c3aed]',
  },
  AI_GENERATED: {
    label: 'AI Generated',
    className: 'bg-blue-50 text-blue-700',
  },
  PLATFORM_SUGGESTED: {
    label: 'Platform',
    className: 'bg-green-50 text-green-700',
  },
  CORRECTION_DERIVED: {
    label: 'From Corrections',
    className: 'bg-amber-50 text-amber-700',
  },
};

const ALL_SOURCES = Object.keys(SOURCE_CONFIG) as KnowledgeSource[];

type ActiveFilter = 'all' | 'active' | 'inactive';

interface ArticleFilters {
  categories: KnowledgeCategory[];
  sources: KnowledgeSource[];
  active: ActiveFilter;
  search: string;
}

const DEFAULT_FILTERS: ArticleFilters = {
  categories: [],
  sources: [],
  active: 'all',
  search: '',
};

// ─── Filter Bar ────────────────────────────────────────────────────────────

function ArticleFilterBar({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
}: {
  filters: ArticleFilters;
  onChange: (filters: ArticleFilters) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}) {
  const handleCategoryToggle = useCallback(
    (cat: KnowledgeCategory, checked: boolean) => {
      const next = checked
        ? [...filters.categories, cat]
        : filters.categories.filter((c) => c !== cat);
      onChange({ ...filters, categories: next });
    },
    [filters, onChange],
  );

  const handleSourceToggle = useCallback(
    (src: KnowledgeSource, checked: boolean) => {
      const next = checked ? [...filters.sources, src] : filters.sources.filter((s) => s !== src);
      onChange({ ...filters, sources: next });
    },
    [filters, onChange],
  );

  const categoryLabel =
    filters.categories.length === 0
      ? 'All Categories'
      : filters.categories.length === 1
        ? CATEGORY_CONFIG[filters.categories[0]!].label
        : `${filters.categories.length} categories`;

  const sourceLabel =
    filters.sources.length === 0
      ? 'All Sources'
      : filters.sources.length === 1
        ? SOURCE_CONFIG[filters.sources[0]!].label
        : `${filters.sources.length} sources`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Category multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-xs',
              filters.categories.length > 0 && 'border-[#7c3aed]/40 bg-[#f5f3ff]',
            )}
          >
            <Filter className="size-3.5" />
            {categoryLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <div className="flex flex-col gap-1">
            {ALL_CATEGORIES.map((cat) => (
              <label
                key={cat}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={filters.categories.includes(cat)}
                  onCheckedChange={(checked) => handleCategoryToggle(cat, !!checked)}
                />
                {CATEGORY_CONFIG[cat].label}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Source multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-xs',
              filters.sources.length > 0 && 'border-[#7c3aed]/40 bg-[#f5f3ff]',
            )}
          >
            <Filter className="size-3.5" />
            {sourceLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <div className="flex flex-col gap-1">
            {ALL_SOURCES.map((src) => (
              <label
                key={src}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={filters.sources.includes(src)}
                  onCheckedChange={(checked) => handleSourceToggle(src, !!checked)}
                />
                <span
                  className={cn(
                    'inline-flex rounded-full px-1.5 py-0.5 text-xs',
                    SOURCE_CONFIG[src].className,
                  )}
                >
                  {SOURCE_CONFIG[src].label}
                </span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active/Inactive toggle */}
      <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
        {(['all', 'active', 'inactive'] as const).map((val) => (
          <Button
            key={val}
            variant={filters.active === val ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 rounded-md px-2.5 text-xs capitalize',
              filters.active === val && 'bg-background shadow-sm',
            )}
            onClick={() => onChange({ ...filters, active: val })}
          >
            {val}
          </Button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-8 w-48 pl-8 text-xs"
          aria-label="Search articles by title"
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

// ─── Confidence indicator ──────────────────────────────────────────────────

function ConfidenceIndicator({ score }: { score: number }) {
  const color = score >= 0.9 ? 'bg-green-500' : score >= 0.7 ? 'bg-amber-500' : 'bg-red-500';
  const label = score >= 0.9 ? 'High' : score >= 0.7 ? 'Medium' : 'Low';

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', color)} aria-hidden="true" />
      <span className="font-mono text-xs">{(score * 100).toFixed(0)}%</span>
      <span className="sr-only">Confidence: {label}</span>
    </div>
  );
}

// ─── Article Card ──────────────────────────────────────────────────────────

function ArticleCard({
  article,
  onToggleActive,
  isToggling,
  onEdit,
  onConfirm,
  onDelete,
  animationIndex,
}: {
  article: KnowledgeArticle;
  onToggleActive: (article: KnowledgeArticle) => void;
  isToggling: boolean;
  onEdit: (article: KnowledgeArticle) => void;
  onConfirm: (article: KnowledgeArticle) => void;
  onDelete: (article: KnowledgeArticle) => void;
  animationIndex: number;
}) {
  const sourceConf = SOURCE_CONFIG[article.source];

  return (
    <Card
      className="rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] animate-fade-in-up"
      style={animationIndex <= 6 ? { animationDelay: `${animationIndex * 50}ms` } : undefined}
    >
      <CardContent className="space-y-3 p-4">
        {/* Row 1: Title + overflow + toggle */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold font-serif leading-snug">
            {article.title}
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            {/* Active toggle */}
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
              }}
            >
              <Switch
                checked={article.isActive}
                onCheckedChange={() => onToggleActive(article)}
                disabled={isToggling}
                aria-label={`Toggle active status for ${article.title}`}
              />
            </div>

            {/* Overflow menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 hover:bg-[#f5f3ff]"
                  aria-label="Article actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(article)}>
                  <Edit className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                {!article.isConfirmed && (
                  <DropdownMenuItem onClick={() => onConfirm(article)}>
                    <ShieldCheck className="mr-2 size-4" />
                    Confirm
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[#dc2626] focus:text-[#dc2626]"
                  onClick={() => onDelete(article)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2: Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Source badge */}
          <Badge variant="secondary" className={cn('border-0 text-xs', sourceConf.className)}>
            {sourceConf.label}
          </Badge>

          {/* Unconfirmed badge */}
          {!article.isConfirmed && (
            <Badge
              variant="secondary"
              className="border border-amber-200 bg-amber-50 text-xs text-amber-700"
            >
              Needs Review
            </Badge>
          )}

          {/* Confidence */}
          <ConfidenceIndicator score={article.confidenceScore} />
        </div>

        {/* Row 3: Metadata */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{article.chunkCount} chunks</span>
          <span>
            Used <span className="font-mono">{article.usageCount}</span>{' '}
            {article.usageCount === 1 ? 'time' : 'times'}
          </span>
          {article.lastUsedAt && (
            <span>
              Last used {formatDistanceToNow(new Date(article.lastUsedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Grouped accordion view ────────────────────────────────────────────────

interface CategoryGroup {
  category: KnowledgeCategory;
  label: string;
  articles: KnowledgeArticle[];
}

function GroupedArticleView({
  groups,
  isLoading,
  onToggleActive,
  togglingId,
  onEdit,
  onConfirm,
  onDelete,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: {
  groups: CategoryGroup[];
  isLoading: boolean;
  onToggleActive: (article: KnowledgeArticle) => void;
  togglingId: string | null;
  onEdit: (article: KnowledgeArticle) => void;
  onConfirm: (article: KnowledgeArticle) => void;
  onDelete: (article: KnowledgeArticle) => void;
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((__, j) => (
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
          No knowledge articles yet. Upload a document or create an article to help the AI
          understand your business.
        </p>
      </div>
    );
  }

  const defaultExpanded = groups.slice(0, 3).map((g) => g.category);

  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={defaultExpanded}>
        {groups.map((group) => (
          <AccordionItem key={group.category} value={group.category}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="border border-[#6d28d9]/20 bg-[#ede9fe] text-xs text-[#6d28d9]"
                >
                  {group.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ({group.articles.length} {group.articles.length === 1 ? 'article' : 'articles'})
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.articles.map((article, idx) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onToggleActive={onToggleActive}
                    isToggling={togglingId === article.id}
                    onEdit={onEdit}
                    onConfirm={onConfirm}
                    onDelete={onDelete}
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

export interface KnowledgeArticlesTabProps {
  onUploadDocument: () => void;
  onCreateArticle: () => void;
  onEditArticle: (article: KnowledgeArticle) => void;
  onDeleteArticle: (article: KnowledgeArticle) => void;
  /** When true, filter to show only unconfirmed articles (from stats panel click). */
  filterPendingReviews?: boolean;
  /** Callback to clear the pending reviews filter. */
  onClearPendingReviewsFilter?: () => void;
}

export function KnowledgeArticlesTab({
  onUploadDocument,
  onCreateArticle,
  onEditArticle,
  onDeleteArticle,
  filterPendingReviews,
  onClearPendingReviewsFilter,
}: KnowledgeArticlesTabProps) {
  // ── Filters ──
  const [filters, setFilters] = useState<ArticleFilters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.sources.length > 0 ||
    filters.active !== 'all' ||
    filters.search !== '';

  const handleClearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  // ── Query params (server-side filtering) ──
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = {};
    if (filters.categories.length > 0) params.category = filters.categories;
    if (filters.sources.length === 1) params.source = filters.sources[0];
    if (filters.active === 'active') params.isActive = true;
    if (filters.active === 'inactive') params.isActive = false;
    return params;
  }, [filters.categories, filters.sources, filters.active]);

  // ── Data query ──
  const {
    data: articlesData,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useKnowledgeArticles(queryParams);

  const allArticles = articlesData?.data ?? [];

  // ── Client-side filtering (search + multi-source + pending reviews) ──
  const filteredArticles = useMemo(() => {
    let result = allArticles;

    // Pending reviews filter from stats panel
    if (filterPendingReviews) {
      result = result.filter((a) => !a.isConfirmed);
    }

    // Multi-source filter (server only supports single source, so filter rest client-side)
    if (filters.sources.length > 1) {
      result = result.filter((a) => filters.sources.includes(a.source));
    }

    // Search by title (client-side)
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter((a) => a.title.toLowerCase().includes(query));
    }

    return result;
  }, [allArticles, filters.sources, debouncedSearch, filterPendingReviews]);

  // ── Group by category ──
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const map = new Map<KnowledgeCategory, KnowledgeArticle[]>();

    for (const article of filteredArticles) {
      const existing = map.get(article.category) ?? [];
      existing.push(article);
      map.set(article.category, existing);
    }

    return ALL_CATEGORIES.filter((cat) => map.has(cat))
      .sort((a, b) => CATEGORY_CONFIG[a].order - CATEGORY_CONFIG[b].order)
      .map((cat) => ({
        category: cat,
        label: CATEGORY_CONFIG[cat].label,
        articles: map.get(cat)!,
      }));
  }, [filteredArticles]);

  // ── Toggle active mutation ──
  const updateArticle = useUpdateKnowledgeArticle();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleActive = useCallback(
    (article: KnowledgeArticle) => {
      setTogglingId(article.id);
      updateArticle.mutate(
        { id: article.id, data: { isActive: !article.isActive } },
        {
          onSuccess: () => {
            toast.success(
              `Article "${article.title}" ${article.isActive ? 'deactivated' : 'activated'}`,
            );
            setTogglingId(null);
          },
          onError: (error: Error) => {
            toast.error(error.message || 'Failed to update article status');
            setTogglingId(null);
          },
        },
      );
    },
    [updateArticle],
  );

  // ── Confirm article ──
  const handleConfirm = useCallback(
    (article: KnowledgeArticle) => {
      updateArticle.mutate(
        { id: article.id, data: { isConfirmed: true } },
        {
          onSuccess: () => {
            toast.success('Article confirmed — confidence upgraded to 0.8');
          },
          onError: (error: Error) => {
            toast.error(error.message || 'Failed to confirm article');
          },
        },
      );
    },
    [updateArticle],
  );

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up">
        <p className="text-sm text-muted-foreground mb-4">Failed to load knowledge articles.</p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending reviews banner */}
      {filterPendingReviews && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
          <span className="text-sm text-amber-700">Showing only articles pending review</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearPendingReviewsFilter}
            className="h-7 gap-1 text-xs text-amber-700 hover:text-amber-900"
          >
            <X className="size-3.5" />
            Clear filter
          </Button>
        </div>
      )}

      {/* Action bar + Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ArticleFilterBar
          filters={filters}
          onChange={setFilters}
          onClear={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCreateArticle} className="gap-1.5">
            <Plus className="size-4" />
            Create Article
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
            onClick={onUploadDocument}
          >
            <Upload className="size-4" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Grouped article list */}
      <GroupedArticleView
        groups={categoryGroups}
        isLoading={isLoading}
        onToggleActive={handleToggleActive}
        togglingId={togglingId}
        onEdit={onEditArticle}
        onConfirm={handleConfirm}
        onDelete={onDeleteArticle}
        hasMore={hasNextPage}
        onLoadMore={() => void fetchNextPage()}
        isLoadingMore={isFetchingNextPage}
      />
    </div>
  );
}
