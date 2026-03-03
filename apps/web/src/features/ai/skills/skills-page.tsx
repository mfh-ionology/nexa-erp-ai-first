import { useMemo, useState, useDeferredValue, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@nexa/i18n';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Search, Wand2, Zap } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

import { getSkills, upsertSkillOverride, deleteSkillOverride } from '../api';
import type { SkillOverrideInput as ApiSkillOverrideInput } from '../api';

import { SkillCard } from './components/skill-card';
import { SkillDetailSheet, type SkillOverrideInput } from './components/skill-detail-sheet';
import type { Skill } from './types';

/**
 * Ordered list of module keys for display grouping.
 * Keys correspond to i18n `skills.modules.*` entries.
 */
const MODULE_ORDER = [
  'views',
  'finance',
  'ar',
  'ap',
  'sales',
  'purchasing',
  'inventory',
  'crm',
  'hr',
  'manufacturing',
  'reporting',
] as const;

export function AISkillsPage() {
  const { t } = useI18n('ai');
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userRole = useAuthStore((s) => s.permissions?.role);

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  // --- Local UI state ---
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDeferredValue(searchRaw);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [expandedModules, setExpandedModules] = useState<Set<string> | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  // --- Query ---
  const skillsQuery = useQuery({
    queryKey: queryKeys.ai.skills(),
    queryFn: () => getSkills(),
    enabled: isAuthenticated,
  });

  const skills = skillsQuery.data ?? [];

  // --- Filtering (subtask 9.2) ---
  const filteredSkills = useMemo(() => {
    let result = skills;

    // Module filter
    if (moduleFilter !== 'all') {
      result = result.filter((s) => s.moduleKey === moduleFilter);
    }

    // Search filter — matches name, description, triggerPhrases, negativeTriggers
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (sk) =>
          sk.name.toLowerCase().includes(s) ||
          (sk.displayName && sk.displayName.toLowerCase().includes(s)) ||
          (sk.description && sk.description.toLowerCase().includes(s)) ||
          sk.triggerPhrases.some((tp) => tp.toLowerCase().includes(s)) ||
          sk.negativeTriggers.some((nt) => nt.toLowerCase().includes(s)),
      );
    }

    return result;
  }, [skills, search, moduleFilter]);

  // --- Group by module ---
  const groupedSkills = useMemo(() => {
    const map = new Map<string, Skill[]>();
    for (const s of filteredSkills) {
      const list = map.get(s.moduleKey) ?? [];
      list.push(s);
      map.set(s.moduleKey, list);
    }
    return map;
  }, [filteredSkills]);

  // Available module keys (derived from loaded skills for the dropdown)
  const availableModules = useMemo(() => {
    const mods = new Set<string>();
    for (const s of skills) mods.add(s.moduleKey);
    // Return in MODULE_ORDER, falling back to alphabetical for unknown modules
    return [...mods].sort((a, b) => {
      const aIdx = MODULE_ORDER.indexOf(a as (typeof MODULE_ORDER)[number]);
      const bIdx = MODULE_ORDER.indexOf(b as (typeof MODULE_ORDER)[number]);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [skills]);

  // Expand the first module group by default on initial load
  const effectiveExpanded = useMemo(() => {
    if (expandedModules !== null) return expandedModules;
    // Auto-expand first module that has skills
    const orderedModules = MODULE_ORDER.filter((mod) => groupedSkills.has(mod));
    const firstMod = orderedModules[0] ?? [...groupedSkills.keys()][0];
    return firstMod ? new Set([firstMod]) : new Set<string>();
  }, [expandedModules, groupedSkills]);

  // --- Handlers ---
  const toggleModule = useCallback((mod: string) => {
    setExpandedModules((prev) => {
      const current = prev ?? new Set<string>();
      const next = new Set(current);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  }, []);

  const handleSelectSkill = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedSkill(null);
  }, []);

  // --- Admin mutations (subtask 9.3) ---
  const saveOverrideMutation = useMutation({
    mutationFn: ({ skillId, input }: { skillId: string; input: ApiSkillOverrideInput }) =>
      upsertSkillOverride(skillId, input),
    onSuccess: () => {
      toast.success(t('skills.overrideSaved'));
      setSelectedSkill(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.skills() });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });

  const resetOverrideMutation = useMutation({
    mutationFn: (skillId: string) => deleteSkillOverride(skillId),
    onSuccess: () => {
      toast.success(t('skills.overrideRemoved'));
      setSelectedSkill(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.skills() });
    },
    onError: () => {
      toast.error(t('errors:unexpected'));
    },
  });

  const handleSaveOverride = useCallback(
    (override: SkillOverrideInput) => {
      if (!selectedSkill) return;
      saveOverrideMutation.mutate({
        skillId: selectedSkill.id,
        input: {
          isActive: override.isActive,
          triggerPhrasesOverride: override.triggerPhrasesOverride,
          priorityOverride: override.priorityOverride,
        },
      });
    },
    [selectedSkill, saveOverrideMutation],
  );

  const handleResetDefault = useCallback(
    (skillId: string) => {
      resetOverrideMutation.mutate(skillId);
    },
    [resetOverrideMutation],
  );

  // Get module display name from i18n
  const getModuleDisplayName = useCallback(
    (moduleKey: string) => {
      const key = `skills.modules.${moduleKey}`;
      const translated = t(key);
      // If translation returns the key itself, fall back to the raw moduleKey
      return translated === key ? moduleKey : translated;
    },
    [t],
  );

  // --- Loading skeleton ---
  if (skillsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wand2 className="h-3.5 w-3.5 text-[#7c3aed]" />
          <span>{t('skills.title')}</span>
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  const hasActiveFilters = search.length > 0 || moduleFilter !== 'all';

  // --- Empty state (no skills at all) ---
  if (skills.length === 0 && !hasActiveFilters) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wand2 className="h-3.5 w-3.5 text-[#7c3aed]" />
          <span>{t('skills.title')}</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-8 py-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ede9fe]">
            <Zap className="h-8 w-8 text-[#7c3aed]" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-foreground">
            {t('skills.noSkills')}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('skills.description')}</p>
        </div>
      </div>
    );
  }

  // --- Main page render ---
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Wand2 className="h-3.5 w-3.5 text-[#7c3aed]" />
        <span>{t('skills.title')}</span>
      </div>

      {/* Search + Module filter (subtask 9.2) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('skills.search')}
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className="rounded-lg border-border pl-9 focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30"
            aria-label={t('skills.search')}
          />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-52 rounded-lg" aria-label={t('skills.filterByModule')}>
            <SelectValue placeholder={t('skills.filterByModule')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('skills.filterByModule')}</SelectItem>
            {availableModules.map((mod) => (
              <SelectItem key={mod} value={mod}>
                {getModuleDisplayName(mod)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Empty search state */}
      {filteredSkills.length === 0 && hasActiveFilters && (
        <div className="rounded-xl border border-border bg-card px-8 py-12 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t('skills.noSearchResults')}</p>
          <button
            type="button"
            onClick={() => {
              setSearchRaw('');
              setModuleFilter('all');
            }}
            className="mt-2 text-sm font-medium text-[#7c3aed] hover:text-[#5b21b6]"
          >
            {t('common:clear')}
          </button>
        </div>
      )}

      {/* Module-grouped skill cards (subtask 9.1) */}
      {MODULE_ORDER.filter((mod) => groupedSkills.has(mod)).map((mod) => {
        const items = groupedSkills.get(mod)!;
        const expanded = effectiveExpanded.has(mod);
        return (
          <section key={mod} aria-label={getModuleDisplayName(mod)}>
            <button
              type="button"
              onClick={() => toggleModule(mod)}
              className="mb-3 flex w-full items-center gap-2 text-left"
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-semibold text-foreground">
                {getModuleDisplayName(mod)}
              </span>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-muted-foreground">
                {items.length}
              </span>
            </button>
            {expanded && (
              <div className="space-y-3">
                {items.map((skill, i) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isAdmin={isAdmin}
                    onClick={handleSelectSkill}
                    index={i}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Render any modules not in MODULE_ORDER at the end */}
      {[...groupedSkills.keys()]
        .filter((mod) => !MODULE_ORDER.includes(mod as (typeof MODULE_ORDER)[number]))
        .map((mod) => {
          const items = groupedSkills.get(mod)!;
          const expanded = effectiveExpanded.has(mod);
          return (
            <section key={mod} aria-label={getModuleDisplayName(mod)}>
              <button
                type="button"
                onClick={() => toggleModule(mod)}
                className="mb-3 flex w-full items-center gap-2 text-left"
                aria-expanded={expanded}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold text-foreground">
                  {getModuleDisplayName(mod)}
                </span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-muted-foreground">
                  {items.length}
                </span>
              </button>
              {expanded && (
                <div className="space-y-3">
                  {items.map((skill, i) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      isAdmin={isAdmin}
                      onClick={handleSelectSkill}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

      {/* Skill Detail Sheet (subtask 9.3 — admin mutations wired) */}
      <SkillDetailSheet
        skill={selectedSkill}
        open={!!selectedSkill}
        isAdmin={isAdmin}
        onClose={handleCloseSheet}
        onSave={handleSaveOverride}
        onResetDefault={handleResetDefault}
      />
    </div>
  );
}
