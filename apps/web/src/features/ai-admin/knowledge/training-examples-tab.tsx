/* eslint-disable i18next/no-literal-string */
/**
 * Training Examples Tab — Q&A pair cards with filter bar.
 *
 * AC-5: Training examples displayed as cards with input/output pairs,
 * skill key badges, category badges, source badges, active toggle,
 * disabled Test button, overflow menu (Edit, Delete).
 * Concept D: 12px radius, custom shadow, purple-tinted hover shadow.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Edit,
  Filter,
  FlaskConical,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { KnowledgeCategory, TrainingExample } from '../api/types';
import { useTrainingExamples, useUpdateTrainingExample } from '../api/use-training-examples';

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<KnowledgeCategory, { label: string }> = {
  BUSINESS_PROCESS: { label: 'Business Processes' },
  TERMINOLOGY: { label: 'Terminology' },
  INDUSTRY_RULES: { label: 'Industry Rules' },
  CUSTOM_FIELDS: { label: 'Custom Fields' },
  HISTORICAL_PATTERN: { label: 'Historical Patterns' },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as KnowledgeCategory[];

const SOURCE_CONFIG: Record<TrainingExample['source'], { label: string; className: string }> = {
  ADMIN_CURATED: {
    label: 'Admin Curated',
    className: 'bg-[#7c3aed]/10 text-[#7c3aed]',
  },
  CORRECTION_DERIVED: {
    label: 'From Corrections',
    className: 'bg-amber-50 text-amber-700',
  },
};

type ActiveFilter = 'all' | 'active' | 'inactive';

interface ExampleFilters {
  categories: KnowledgeCategory[];
  skillKey: string;
  active: ActiveFilter;
  search: string;
}

const DEFAULT_FILTERS: ExampleFilters = {
  categories: [],
  skillKey: '',
  active: 'all',
  search: '',
};

// ─── Filter Bar ────────────────────────────────────────────────────────────

function ExampleFilterBar({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
}: {
  filters: ExampleFilters;
  onChange: (filters: ExampleFilters) => void;
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

  const categoryLabel =
    filters.categories.length === 0
      ? 'All Categories'
      : filters.categories.length === 1
        ? CATEGORY_CONFIG[filters.categories[0]!].label
        : `${filters.categories.length} categories`;

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
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="h-8 w-48 pl-8 text-xs"
          aria-label="Search training examples"
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

// ─── Training Example Card ──────────────────────────────────────────────────

function TrainingExampleCard({
  example,
  onToggleActive,
  isToggling,
  onEdit,
  onDelete,
  animationIndex,
}: {
  example: TrainingExample;
  onToggleActive: (example: TrainingExample) => void;
  isToggling: boolean;
  onEdit: (example: TrainingExample) => void;
  onDelete: (example: TrainingExample) => void;
  animationIndex: number;
}) {
  const sourceConf = SOURCE_CONFIG[example.source];

  return (
    <Card
      className="rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] animate-fade-in-up"
      style={animationIndex <= 8 ? { animationDelay: `${animationIndex * 50}ms` } : undefined}
    >
      <CardContent className="space-y-3 p-4">
        {/* Row 1: Input → Output pair */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          {/* Input */}
          <div className="flex-1 min-w-0">
            <p className="mb-1 text-xs font-medium text-muted-foreground">When user asks:</p>
            <p className="line-clamp-2 text-sm leading-snug">{example.inputText}</p>
          </div>

          {/* Arrow */}
          <div className="hidden sm:flex shrink-0 items-center pt-5">
            <ArrowRight className="size-4 text-[#7c3aed]" aria-hidden="true" />
          </div>

          {/* Output */}
          <div className="flex-1 min-w-0">
            <p className="mb-1 text-xs font-medium text-muted-foreground">AI should answer:</p>
            <p className="line-clamp-2 text-sm leading-snug">{example.outputText}</p>
          </div>
        </div>

        {/* Row 2: Badges + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Skill key badge */}
            {example.skillKey && (
              <Badge
                variant="secondary"
                className="border-0 bg-[#7c3aed]/10 font-mono text-xs text-[#7c3aed]"
              >
                {example.skillKey}
              </Badge>
            )}

            {/* Category badge */}
            <Badge
              variant="secondary"
              className="border border-[#6d28d9]/20 bg-[#ede9fe] text-xs text-[#6d28d9]"
            >
              {CATEGORY_CONFIG[example.category].label}
            </Badge>

            {/* Source badge */}
            <Badge variant="secondary" className={cn('border-0 text-xs', sourceConf.className)}>
              {sourceConf.label}
            </Badge>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {/* Test button — disabled for MVP */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0"
                      disabled
                      aria-label="Test training example (coming soon)"
                    >
                      <FlaskConical className="size-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Coming soon</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Active toggle */}
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
              }}
            >
              <Switch
                checked={example.isActive}
                onCheckedChange={() => onToggleActive(example)}
                disabled={isToggling}
                aria-label={`Toggle active status for training example`}
              />
            </div>

            {/* Overflow menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 hover:bg-[#f5f3ff]"
                  aria-label="Training example actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(example)}>
                  <Edit className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[#dc2626] focus:text-[#dc2626]"
                  onClick={() => onDelete(example)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Example List View ──────────────────────────────────────────────────────

function ExampleListView({
  examples,
  isLoading,
  onToggleActive,
  togglingId,
  onEdit,
  onDelete,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: {
  examples: TrainingExample[];
  isLoading: boolean;
  onToggleActive: (example: TrainingExample) => void;
  togglingId: string | null;
  onEdit: (example: TrainingExample) => void;
  onDelete: (example: TrainingExample) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (examples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No training examples yet. Add examples to teach the AI how to respond to specific
          questions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {examples.map((example, idx) => (
          <TrainingExampleCard
            key={example.id}
            example={example}
            onToggleActive={onToggleActive}
            isToggling={togglingId === example.id}
            onEdit={onEdit}
            onDelete={onDelete}
            animationIndex={idx + 1}
          />
        ))}
      </div>

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

export interface TrainingExamplesTabProps {
  onAddExample: () => void;
  onEditExample: (example: TrainingExample) => void;
  onDeleteExample: (example: TrainingExample) => void;
}

export function TrainingExamplesTab({
  onAddExample,
  onEditExample,
  onDeleteExample,
}: TrainingExamplesTabProps) {
  // ── Filters ──
  const [filters, setFilters] = useState<ExampleFilters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.skillKey !== '' ||
    filters.active !== 'all' ||
    filters.search !== '';

  const handleClearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  // ── Query params (server-side filtering) ──
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = {};
    if (filters.categories.length > 0) params.category = filters.categories;
    if (filters.skillKey) params.skillKey = filters.skillKey;
    if (filters.active === 'active') params.isActive = true;
    if (filters.active === 'inactive') params.isActive = false;
    return params;
  }, [filters.categories, filters.skillKey, filters.active]);

  // ── Data query ──
  const {
    data: examplesData,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useTrainingExamples(queryParams);

  const allExamples = examplesData?.data ?? [];

  // ── Client-side filtering (search) ──
  const filteredExamples = useMemo(() => {
    if (!debouncedSearch) return allExamples;
    const query = debouncedSearch.toLowerCase();
    return allExamples.filter(
      (e) =>
        e.inputText.toLowerCase().includes(query) || e.outputText.toLowerCase().includes(query),
    );
  }, [allExamples, debouncedSearch]);

  // ── Toggle active mutation ──
  const updateExample = useUpdateTrainingExample();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleActive = useCallback(
    (example: TrainingExample) => {
      setTogglingId(example.id);
      updateExample.mutate(
        { id: example.id, data: { isActive: !example.isActive } },
        {
          onSuccess: () => {
            toast.success(`Training example ${example.isActive ? 'deactivated' : 'activated'}`);
            setTogglingId(null);
          },
          onError: (error: Error) => {
            toast.error(error.message || 'Failed to update training example');
            setTogglingId(null);
          },
        },
      );
    },
    [updateExample],
  );

  return (
    <div className="space-y-4">
      {/* Action bar + Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ExampleFilterBar
          filters={filters}
          onChange={setFilters}
          onClear={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
            onClick={onAddExample}
          >
            <Plus className="size-4" />
            Add Example
          </Button>
        </div>
      </div>

      {/* Example list */}
      <ExampleListView
        examples={filteredExamples}
        isLoading={isLoading}
        onToggleActive={handleToggleActive}
        togglingId={togglingId}
        onEdit={onEditExample}
        onDelete={onDeleteExample}
        hasMore={hasNextPage}
        onLoadMore={() => void fetchNextPage()}
        isLoadingMore={isFetchingNextPage}
      />
    </div>
  );
}
