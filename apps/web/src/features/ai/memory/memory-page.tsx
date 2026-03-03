import { useMemo, useState, useDeferredValue, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@nexa/i18n';
import { toast } from 'sonner';
import { Brain, ChevronDown, ChevronRight, Lightbulb, Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import {
  getMemories,
  getMemorySettings,
  updateMemory as apiUpdateMemory,
  deleteMemory as apiDeleteMemory,
  forgetAllMemories as apiForgetAll,
  updateMemorySettings as apiUpdateSettings,
} from '../api';

import { ForgetAllDialog } from './components/forget-all-dialog';
import { MemoryCard } from './components/memory-card';
import { MemoryDeleteDialog } from './components/memory-delete-dialog';
import { MemoryEditDialog } from './components/memory-edit-dialog';
import { MemorySettingsPanel } from './components/memory-settings-panel';
import { MemoryStatsPanel } from './components/memory-stats-panel';
import { CATEGORY_I18N_KEYS } from './constants';
import type { Memory, MemoryCategory, MemorySettings } from './types';

/** Display order for category groups and filter pills. */
const CATEGORY_ORDER: MemoryCategory[] = [
  'PREFERENCE',
  'INSTRUCTION',
  'WORKFLOW',
  'DECISION',
  'ENTITY_CONTEXT',
];

export function AIMemoryPage() {
  const { t } = useI18n('ai');
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // --- Local UI state ---
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDeferredValue(searchRaw);
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<MemoryCategory>>(new Set());

  // Dialog state
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deletingMemory, setDeletingMemory] = useState<Memory | null>(null);
  const [forgetAllOpen, setForgetAllOpen] = useState(false);

  // --- Queries ---
  const memoriesQuery = useQuery({
    queryKey: queryKeys.ai.memories(),
    queryFn: getMemories,
    enabled: isAuthenticated,
    select: (data) => data.memories,
  });

  const settingsQuery = useQuery({
    queryKey: queryKeys.ai.memorySettings(),
    queryFn: getMemorySettings,
    enabled: isAuthenticated,
  });

  const memories = memoriesQuery.data ?? [];
  const settings = settingsQuery.data;

  // --- Mutations ---
  const updateSettingsMutation = useMutation({
    mutationFn: (patch: Partial<MemorySettings>) => apiUpdateSettings(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.ai.memorySettings() });
      const previous = queryClient.getQueryData<MemorySettings>(queryKeys.ai.memorySettings());
      if (previous) {
        queryClient.setQueryData(queryKeys.ai.memorySettings(), { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.ai.memorySettings(), context.previous);
      }
      toast.error(t('errors:unexpected'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.memorySettings() });
    },
  });

  const updateMemoryMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => apiUpdateMemory(id, content),
    onMutate: async ({ id, content }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.ai.memories() });
      const previous = queryClient.getQueryData(queryKeys.ai.memories());
      queryClient.setQueryData(queryKeys.ai.memories(), (old: unknown) => {
        if (!old || typeof old !== 'object' || !('memories' in old)) return old;
        const data = old as { memories: Memory[]; cursor: string | null; total: number };
        return {
          ...data,
          memories: data.memories.map((m) => (m.id === id ? { ...m, content } : m)),
        };
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('memory.updated'));
      setEditingMemory(null);
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.ai.memories(), context.previous);
      }
      toast.error(t('errors:unexpected'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.memories() });
    },
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: (id: string) => apiDeleteMemory(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.ai.memories() });
      const previous = queryClient.getQueryData(queryKeys.ai.memories());
      queryClient.setQueryData(queryKeys.ai.memories(), (old: unknown) => {
        if (!old || typeof old !== 'object' || !('memories' in old)) return old;
        const data = old as { memories: Memory[]; cursor: string | null; total: number };
        return {
          ...data,
          memories: data.memories.filter((m) => m.id !== id),
          total: data.total - 1,
        };
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('memory.deleted'));
      setDeletingMemory(null);
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.ai.memories(), context.previous);
      }
      toast.error(t('errors:unexpected'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.memories() });
    },
  });

  const forgetAllMutation = useMutation({
    mutationFn: () => apiForgetAll(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.ai.memories() });
      const previous = queryClient.getQueryData(queryKeys.ai.memories());
      queryClient.setQueryData(queryKeys.ai.memories(), { memories: [], cursor: null, total: 0 });
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('memory.allDeleted'));
      setForgetAllOpen(false);
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.ai.memories(), context.previous);
      }
      toast.error(t('errors:unexpected'));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.memories() });
    },
  });

  // --- Filtering ---
  const filteredMemories = useMemo(() => {
    let result = memories;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((m) => m.content.toLowerCase().includes(s));
    }
    if (categoryFilter.length > 0) {
      result = result.filter((m) => categoryFilter.includes(m.category));
    }
    return result;
  }, [memories, search, categoryFilter]);

  // --- Grouping by category ---
  const groupedMemories = useMemo(() => {
    const map = new Map<MemoryCategory, Memory[]>();
    for (const m of filteredMemories) {
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    return map;
  }, [filteredMemories]);

  // --- Handlers ---
  const toggleCategoryFilter = useCallback((cat: MemoryCategory) => {
    setCategoryFilter((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  const toggleSection = useCallback((cat: MemoryCategory) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleEditOpen = useCallback(
    (id: string) => {
      const mem = memories.find((m) => m.id === id);
      if (mem) setEditingMemory(mem);
    },
    [memories],
  );

  const handleDeleteOpen = useCallback(
    (id: string) => {
      const mem = memories.find((m) => m.id === id);
      if (mem) setDeletingMemory(mem);
    },
    [memories],
  );

  const handleSaveEdit = useCallback(
    (id: string, content: string) => {
      updateMemoryMutation.mutate({ id, content });
    },
    [updateMemoryMutation],
  );

  const handleConfirmDelete = useCallback(
    (id: string) => {
      deleteMemoryMutation.mutate(id);
    },
    [deleteMemoryMutation],
  );

  const handleForgetAll = useCallback(() => {
    forgetAllMutation.mutate();
  }, [forgetAllMutation]);

  const handleUpdateSettings = useCallback(
    (patch: Partial<MemorySettings>) => {
      updateSettingsMutation.mutate(patch);
    },
    [updateSettingsMutation],
  );

  // --- Loading skeleton ---
  if (memoriesQuery.isLoading || settingsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Brain className="h-3.5 w-3.5 text-[#7c3aed]" />
          <span>{t('memory.title')}</span>
        </div>
        {/* Settings skeleton */}
        <div className="rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-6 w-40" />
          <div className="mt-4 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
          <div className="mt-5 flex gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-24" />
            ))}
          </div>
        </div>
        {/* Memory list skeleton */}
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // --- Empty state (no memories at all) ---
  const hasNoMemories = memories.length === 0;
  const hasActiveFilters = search.length > 0 || categoryFilter.length > 0;

  if (hasNoMemories && !hasActiveFilters) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Brain className="h-3.5 w-3.5 text-[#7c3aed]" />
          <span>{t('memory.title')}</span>
        </div>

        {/* Settings panel — always visible */}
        {settings && (
          <MemorySettingsPanel
            settings={settings}
            onUpdate={handleUpdateSettings}
            onForgetAll={() => setForgetAllOpen(true)}
          />
        )}

        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-8 py-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ede9fe]">
            <Lightbulb className="h-8 w-8 text-[#7c3aed]" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-foreground">
            {t('memory.noMemories')}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {t('memory.noMemoriesDesc')}
          </p>
        </div>

        <ForgetAllDialog
          open={forgetAllOpen}
          onConfirm={handleForgetAll}
          onClose={() => setForgetAllOpen(false)}
        />
      </div>
    );
  }

  // --- Main page render ---
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Brain className="h-3.5 w-3.5 text-[#7c3aed]" />
        <span>{t('memory.title')}</span>
      </div>

      {/* Settings + Stats panels */}
      {settings && (
        <MemorySettingsPanel
          settings={settings}
          onUpdate={handleUpdateSettings}
          onForgetAll={() => setForgetAllOpen(true)}
        />
      )}

      <MemoryStatsPanel memories={memories} />

      {/* Search + category filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('memory.search')}
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="rounded-lg border-border pl-9 focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30"
            aria-label={t('memory.search')}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategoryFilter(cat)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter.includes(cat)
                  ? 'bg-[#7c3aed] text-white'
                  : 'bg-secondary text-muted-foreground hover:bg-[#f5f3ff] hover:text-[#7c3aed]'
              }`}
              aria-pressed={categoryFilter.includes(cat)}
              aria-label={t(CATEGORY_I18N_KEYS[cat])}
            >
              {t(CATEGORY_I18N_KEYS[cat])}
            </button>
          ))}
          {categoryFilter.length > 0 && (
            <button
              type="button"
              onClick={() => setCategoryFilter([])}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              aria-label={t('common:clear')}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Empty search state */}
      {filteredMemories.length === 0 && hasActiveFilters && (
        <div className="rounded-xl border border-border bg-card px-8 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t('memory.noSearchResults')}</p>
          <button
            type="button"
            onClick={() => {
              setSearchRaw('');
              setCategoryFilter([]);
            }}
            className="mt-2 text-sm font-medium text-[#7c3aed] hover:text-[#5b21b6]"
          >
            {t('common:clear')}
          </button>
        </div>
      )}

      {/* Grouped memory cards */}
      {CATEGORY_ORDER.filter((cat) => groupedMemories.has(cat)).map((category) => {
        const items = groupedMemories.get(category)!;
        const collapsed = collapsedSections.has(category);
        return (
          <section key={category} aria-label={t(CATEGORY_I18N_KEYS[category])}>
            <button
              type="button"
              onClick={() => toggleSection(category)}
              className="mb-3 flex w-full items-center gap-2 text-left"
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t(CATEGORY_I18N_KEYS[category])}
              </span>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-muted-foreground">
                {items.length}
              </span>
            </button>
            {!collapsed && (
              <div className="space-y-3">
                {items.map((m, i) => (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    onEdit={handleEditOpen}
                    onDelete={handleDeleteOpen}
                    index={i}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Dialogs */}
      <MemoryEditDialog
        open={!!editingMemory}
        memory={editingMemory}
        onSave={handleSaveEdit}
        onClose={() => setEditingMemory(null)}
      />

      <MemoryDeleteDialog
        open={!!deletingMemory}
        memory={deletingMemory}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingMemory(null)}
      />

      <ForgetAllDialog
        open={forgetAllOpen}
        onConfirm={handleForgetAll}
        onClose={() => setForgetAllOpen(false)}
      />
    </div>
  );
}
