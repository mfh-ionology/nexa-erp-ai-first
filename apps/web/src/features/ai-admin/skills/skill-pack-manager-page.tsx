/* eslint-disable i18next/no-literal-string */
/**
 * Skill Pack Manager Page — grouped accordion + flat list views for AI skills.
 *
 * AC-3: Lists all skills grouped by moduleKey (accordion default) or flat table.
 * AC-6: Inline isActive toggle with optimistic update.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { LayoutGrid, List, Plus, Wand2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/templates/page-header';
import { DataTable } from '@/components/templates/data-table';
import { cn } from '@/lib/utils';

import { queryKeys } from '@/lib/query-keys';

import type { AiSkillListItem, SkillGroup, SkillsGroupedResponse } from '../api/types';
import { useAiSkills, useAiSkillsGrouped, useUpdateAiSkill } from '../api/use-ai-skills';
import { TestTriggerPanel } from './test-trigger-panel';

// ─── View mode ──────────────────────────────────────────────────────────────

type ViewMode = 'cards' | 'list';

// ─── Module key label helper ────────────────────────────────────────────────

function moduleLabel(key: string | null): string {
  if (!key) return 'Unassigned';
  return key.toUpperCase();
}

// ─── Trigger pill tags ──────────────────────────────────────────────────────

function TriggerPills({
  phrases,
  maxVisible,
  variant,
}: {
  phrases: string[];
  maxVisible: number;
  variant: 'blue' | 'red';
}) {
  if (!phrases || phrases.length === 0) return null;

  const visible = phrases.slice(0, maxVisible);
  const overflow = phrases.length - maxVisible;

  const pillBase =
    variant === 'blue'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-red-50 text-red-700 border-red-200';

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((phrase) => (
        <span
          key={phrase}
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
            pillBase,
          )}
        >
          {phrase}
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center rounded-full border border-muted px-2 py-0.5 text-xs text-muted-foreground">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

// ─── Skill card (subtask 9.2) ───────────────────────────────────────────────

function SkillCard({
  skill,
  onToggleActive,
  isToggling,
  animationIndex,
}: {
  skill: AiSkillListItem;
  onToggleActive: (skill: AiSkillListItem) => void;
  isToggling: boolean;
  animationIndex: number;
}) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] animate-fade-in-up"
      style={animationIndex <= 6 ? { animationDelay: `${animationIndex * 50}ms` } : undefined}
      tabIndex={0}
      role="button"
      aria-label={`View skill ${skill.displayName}`}
      onClick={() => void navigate({ to: `/ai/admin/skills/${skill.id}` as string })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void navigate({ to: `/ai/admin/skills/${skill.id}` as string });
        }
      }}
    >
      <CardContent className="space-y-3 p-4">
        {/* Top row: name + active toggle */}
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-sm font-bold">{skill.name}</span>
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
            }}
          >
            <Switch
              checked={skill.isActive}
              onCheckedChange={() => onToggleActive(skill)}
              disabled={isToggling}
              aria-label={`Toggle active status for skill ${skill.name}`}
            />
          </div>
        </div>

        {/* Display name + description */}
        <div>
          <p className="text-sm font-medium">{skill.displayName}</p>
          {skill.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
          )}
        </div>

        {/* Trigger phrases */}
        <TriggerPills phrases={skill.triggerPhrases} maxVisible={5} variant="blue" />

        {/* Negative triggers */}
        <TriggerPills phrases={skill.negativeTriggers} maxVisible={3} variant="red" />

        {/* Bottom row: orchestration pattern, priority, version */}
        <div className="flex items-center gap-2">
          {skill.orchestrationPattern && (
            <Badge
              variant="secondary"
              className="border border-[#7c3aed]/20 bg-[#f5f3ff] text-xs text-[#7c3aed]"
            >
              {skill.orchestrationPattern}
            </Badge>
          )}
          <span className="font-mono text-xs text-muted-foreground">pri:{skill.priority}</span>
          <span className="font-mono text-xs text-muted-foreground">v{skill.version}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Accordion view (subtask 9.2) ───────────────────────────────────────────

function AccordionView({
  groups,
  isLoading,
  onToggleActive,
  togglingId,
}: {
  groups: SkillGroup[];
  isLoading: boolean;
  onToggleActive: (skill: AiSkillListItem) => void;
  togglingId: string | null;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">No skills found</p>
      </div>
    );
  }

  // Sort groups: named modules first (alpha), unassigned last
  const sorted = [...groups].sort((a, b) => {
    if (a.moduleKey === null) return 1;
    if (b.moduleKey === null) return -1;
    return (a.moduleKey ?? '').localeCompare(b.moduleKey ?? '');
  });

  // Default first 3 modules expanded
  const defaultExpanded = sorted.slice(0, 3).map((g) => g.moduleKey ?? 'unassigned');

  return (
    <Accordion type="multiple" defaultValue={defaultExpanded}>
      {sorted.map((group) => {
        const key = group.moduleKey ?? 'unassigned';
        return (
          <AccordionItem key={key} value={key}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="border border-[#6d28d9]/20 bg-[#ede9fe] font-mono text-xs uppercase text-[#6d28d9]"
                >
                  {moduleLabel(group.moduleKey)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  ({group.skills.length} {group.skills.length === 1 ? 'skill' : 'skills'})
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.skills.map((skill, idx) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onToggleActive={onToggleActive}
                    isToggling={togglingId === skill.id}
                    animationIndex={idx + 1}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

// ─── Flat list view (subtask 9.3) ───────────────────────────────────────────

function FlatListView({
  skills,
  isLoading,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: {
  skills: AiSkillListItem[];
  isLoading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}) {
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<AiSkillListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm font-bold">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'displayName',
        header: 'Display Name',
        enableSorting: true,
        cell: ({ getValue }) => <span className="text-sm">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'moduleKey',
        header: 'Module',
        cell: ({ getValue }) => {
          const key = getValue<string | null>();
          if (!key) return <span className="text-xs italic text-muted-foreground">—</span>;
          return (
            <Badge
              variant="secondary"
              className="border border-[#6d28d9]/20 bg-[#ede9fe] font-mono text-xs uppercase text-[#6d28d9]"
            >
              {key}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => (
          <Badge variant="outline" className="text-xs capitalize">
            {getValue<string>()}
          </Badge>
        ),
      },
      {
        accessorKey: 'triggerPhrases',
        header: 'Triggers',
        cell: ({ getValue }) => {
          const phrases = getValue<string[]>();
          return <TriggerPills phrases={phrases} maxVisible={3} variant="blue" />;
        },
      },
      {
        accessorKey: 'orchestrationPattern',
        header: 'Pattern',
        cell: ({ getValue }) => {
          const pattern = getValue<string | null>();
          if (!pattern) return null;
          return (
            <Badge
              variant="secondary"
              className="border border-[#7c3aed]/20 bg-[#f5f3ff] text-xs text-[#7c3aed]"
            >
              {pattern}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<number>()}</span>,
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ getValue }) => {
          const isActive = getValue<boolean>();
          return (
            <div className="flex items-center gap-2">
              <span
                className={cn('size-2 rounded-full', isActive ? 'bg-[#10b981]' : 'bg-[#d1d5db]')}
                aria-hidden="true"
              />
              <span
                className={cn('text-sm', isActive ? 'text-foreground' : 'text-muted-foreground')}
              >
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          );
        },
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <DataTable<AiSkillListItem>
        columns={columns}
        data={skills}
        getRowId={(row) => row.id}
        onRowClick={(row) => void navigate({ to: `/ai/admin/skills/${row.id}` as string })}
      />
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main page component (subtask 9.1) ──────────────────────────────────────

export function SkillPackManagerPage() {
  const navigate = useNavigate();

  // --- View mode ---
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  // --- Test Trigger panel ---
  const [testTriggerOpen, setTestTriggerOpen] = useState(false);

  // --- Search with 300ms debounce ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // --- Query params ---
  const queryParams = useMemo(() => {
    const params: Record<string, string | boolean> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [debouncedSearch]);

  // --- Data queries ---
  const groupedQuery = useAiSkillsGrouped(viewMode === 'cards' ? queryParams : {});
  const flatQuery = useAiSkills(viewMode === 'list' ? queryParams : {});

  // --- Inline toggle mutation with optimistic update (AC-6) ---
  const queryClient = useQueryClient();
  const updateSkill = useUpdateAiSkill();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleActive = useCallback(
    (skill: AiSkillListItem) => {
      const newIsActive = !skill.isActive;
      setTogglingId(skill.id);

      // Snapshot grouped query cache for rollback
      const groupedCacheKey = queryKeys.aiAdmin.skillsGrouped(
        queryParams as Record<string, unknown>,
      );
      const previousGrouped = queryClient.getQueryData<SkillsGroupedResponse>(groupedCacheKey);

      // Optimistic update: immediately toggle in cache
      if (previousGrouped) {
        queryClient.setQueryData<SkillsGroupedResponse>(groupedCacheKey, {
          ...previousGrouped,
          groups: previousGrouped.groups.map((group) => ({
            ...group,
            skills: group.skills.map((s) =>
              s.id === skill.id ? { ...s, isActive: newIsActive } : s,
            ),
          })),
        });
      }

      updateSkill.mutate(
        { id: skill.id, data: { isActive: newIsActive } },
        {
          onSuccess: () => {
            toast.success(
              `Skill ${skill.displayName} ${skill.isActive ? 'deactivated' : 'activated'}`,
            );
            setTogglingId(null);
          },
          onError: (error: Error) => {
            // Rollback optimistic update
            if (previousGrouped) {
              queryClient.setQueryData(groupedCacheKey, previousGrouped);
            }
            toast.error(error.message || 'Failed to update skill status');
            setTogglingId(null);
          },
        },
      );
    },
    [updateSkill, queryClient, queryParams],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [{ label: 'AI Administration', path: '/ai/admin' }, { label: 'Skill Packs' }],
    [],
  );

  // --- Action bar ---
  const actionBar = (
    <div className="flex items-center gap-2">
      {/* View mode toggle */}
      <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
        <Button
          variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
          size="icon-sm"
          className={cn('size-8 rounded-md', viewMode === 'cards' && 'bg-background shadow-sm')}
          onClick={() => setViewMode('cards')}
          aria-label="Card view"
        >
          <LayoutGrid className="size-4" />
        </Button>
        <Button
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          size="icon-sm"
          className={cn('size-8 rounded-md', viewMode === 'list' && 'bg-background shadow-sm')}
          onClick={() => setViewMode('list')}
          aria-label="List view"
        >
          <List className="size-4" />
        </Button>
      </div>

      {/* Test Trigger button */}
      <Button variant="outline" size="sm" onClick={() => setTestTriggerOpen(true)}>
        <Wand2 className="mr-2 size-4" />
        Test Trigger
      </Button>

      {/* Add Skill button */}
      <Button
        size="sm"
        className="bg-[#7c3aed] hover:bg-[#5b21b6]"
        onClick={() => void navigate({ to: '/ai/admin/skills/new' as string })}
      >
        <Plus className="mr-2 size-4" />
        Add Skill
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 p-6 animate-fade-in-up">
      <PageHeader title="Skill Pack Manager" breadcrumbs={breadcrumbs} actionBarSlot={actionBar} />

      {/* Search bar */}
      <div className="relative max-w-md">
        <Input
          placeholder="Search skills by name, display name, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg pl-3"
        />
      </div>

      {/* View content */}
      {viewMode === 'cards' ? (
        <AccordionView
          groups={(groupedQuery.data as { groups: SkillGroup[] })?.groups ?? []}
          isLoading={groupedQuery.isLoading}
          onToggleActive={handleToggleActive}
          togglingId={togglingId}
        />
      ) : (
        <FlatListView
          skills={flatQuery.data?.data ?? []}
          isLoading={flatQuery.isLoading}
          hasMore={flatQuery.hasNextPage}
          onLoadMore={() => void flatQuery.fetchNextPage()}
          isLoadingMore={flatQuery.isFetchingNextPage}
        />
      )}

      {/* Test Trigger Panel (AC-5) */}
      <TestTriggerPanel open={testTriggerOpen} onOpenChange={setTestTriggerOpen} />
    </div>
  );
}
