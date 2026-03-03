/**
 * RoleDefaultsSection — Admin-only section for managing role-based
 * notification preference defaults.
 *
 * Renders a role selector dropdown + the same matrix grid pattern
 * used for personal preferences, but editing role-level defaults.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Save, Shield } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

import { useRoleDefaults, useUpdateRoleDefaults } from '../api/use-role-defaults';
import type { RoleDefaultItem } from '../api/use-role-defaults';

// ── Types ────────────────────────────────────────────────────────────────────

type Channel = 'enableInApp' | 'enableEmail' | 'enablePush';
type LocalState = Record<string, Record<Channel, boolean>>;

/** Exposed so the parent page can check if role defaults have unsaved changes. */
export interface RoleDefaultsDirtyState {
  isDirty: boolean;
}

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER'] as const;
const CHANNELS: { key: Channel; labelKey: string }[] = [
  { key: 'enableInApp', labelKey: 'preferences.channel.inApp' },
  { key: 'enableEmail', labelKey: 'preferences.channel.email' },
  { key: 'enablePush', labelKey: 'preferences.channel.push' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACRONYMS = new Set(['crm', 'hr', 'ap', 'ar', 'ai', 'erp', 'api']);

function formatCategory(raw: string): string {
  return raw
    .split(/[_-]/)
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

function buildLocalState(items: RoleDefaultItem[]): LocalState {
  const state: LocalState = {};
  for (const item of items) {
    state[item.templateId] = {
      enableInApp: item.enableInApp,
      enableEmail: item.enableEmail,
      enablePush: item.enablePush,
    };
  }
  return state;
}

interface RoleDefaultGroup {
  category: string;
  items: RoleDefaultItem[];
}

function groupByCategory(items: RoleDefaultItem[]): RoleDefaultGroup[] {
  const groups = new Map<string, RoleDefaultItem[]>();
  for (const item of items) {
    const dotIndex = item.eventName.indexOf('.');
    const rawCategory = dotIndex > 0 ? item.eventName.slice(0, dotIndex) : 'general';
    const category = formatCategory(rawCategory);
    const existing = groups.get(category);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(category, [item]);
    }
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
}

function getDirtyPreferences(
  items: RoleDefaultItem[],
  local: LocalState,
): Array<{
  notificationTemplateId: string;
  enableInApp: boolean;
  enableEmail: boolean;
  enablePush: boolean;
}> {
  const changes: Array<{
    notificationTemplateId: string;
    enableInApp: boolean;
    enableEmail: boolean;
    enablePush: boolean;
  }> = [];

  for (const item of items) {
    const localItem = local[item.templateId];
    if (!localItem) continue;
    if (
      localItem.enableInApp !== item.enableInApp ||
      localItem.enableEmail !== item.enableEmail ||
      localItem.enablePush !== item.enablePush
    ) {
      changes.push({
        notificationTemplateId: item.templateId,
        enableInApp: localItem.enableInApp,
        enableEmail: localItem.enableEmail,
        enablePush: localItem.enablePush,
      });
    }
  }

  return changes;
}

// ── Component ────────────────────────────────────────────────────────────────

export function RoleDefaultsSection() {
  const { t } = useI18n('notifications');
  const [selectedRole, setSelectedRole] = useState<string>('STAFF');
  const [localState, setLocalState] = useState<LocalState>({});
  const initialStateRef = useRef<LocalState>({});

  // Role switch confirmation dialog state
  const [pendingRole, setPendingRole] = useState<string | null>(null);

  const { data, isLoading } = useRoleDefaults(selectedRole);
  const updateMutation = useUpdateRoleDefaults();

  const items = data?.items ?? [];

  // Guard: do NOT overwrite local state if the user has unsaved changes
  // (e.g., from a background query refetch on window focus).
  const isDirtyRef = useRef(false);

  // Sync local state when data loads or role changes
  useEffect(() => {
    if (items.length > 0 && !isDirtyRef.current) {
      const state = buildLocalState(items);
      setLocalState(state);
      initialStateRef.current = state;
    }
  }, [items]);

  const isDirty = useMemo(() => {
    const original = initialStateRef.current;
    for (const [templateId, channels] of Object.entries(localState)) {
      const orig = original[templateId];
      if (!orig) continue;
      if (
        channels.enableInApp !== orig.enableInApp ||
        channels.enableEmail !== orig.enableEmail ||
        channels.enablePush !== orig.enablePush
      ) {
        return true;
      }
    }
    return false;
  }, [localState]);

  // Keep ref in sync for the useEffect guard
  isDirtyRef.current = isDirty;

  const handleToggle = useCallback((templateId: string, channel: Channel) => {
    setLocalState((prev) => {
      const existing = prev[templateId];
      if (!existing) return prev;
      return {
        ...prev,
        [templateId]: {
          ...existing,
          [channel]: !existing[channel],
        },
      };
    });
  }, []);

  const handleSave = useCallback(() => {
    const changes = getDirtyPreferences(items, localState);
    if (changes.length === 0) return;
    updateMutation.mutate({
      role: selectedRole,
      preferences: changes,
    });
  }, [items, localState, selectedRole, updateMutation]);

  // Role change with unsaved-changes guard (Issue #10)
  const handleRoleChange = useCallback(
    (role: string) => {
      if (isDirty) {
        setPendingRole(role);
      } else {
        setSelectedRole(role);
      }
    },
    [isDirty],
  );

  const confirmRoleSwitch = useCallback(() => {
    if (pendingRole) {
      setSelectedRole(pendingRole);
      setPendingRole(null);
    }
  }, [pendingRole]);

  const cancelRoleSwitch = useCallback(() => {
    setPendingRole(null);
  }, []);

  const groups = useMemo(() => groupByCategory(items), [items]);

  return (
    <section
      className="animate-fade-in-up"
      style={{ animationDelay: '200ms' }}
      aria-labelledby="role-defaults-heading"
    >
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center size-8 rounded-lg bg-[#7c3aed]/10">
          <Shield className="size-4 text-[#7c3aed]" aria-hidden="true" />
        </div>
        <div>
          <h2
            id="role-defaults-heading"
            className="font-heading text-base font-semibold text-foreground"
          >
            {t('preferences.roleDefaults.title')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('preferences.roleDefaults.description')}
          </p>
        </div>
      </div>

      {/* Role selector + save bar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <Select value={selectedRole} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('preferences.roleDefaults.selectRole')} />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isDirty && (
            <div
              className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400"
              role="status"
              aria-live="polite"
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
            </div>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          size="sm"
          className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
        >
          <Save className="size-4" />
          {t('preferences.roleDefaults.saveButton')}
        </Button>
      </div>

      {/* Matrix grid */}
      {isLoading ? (
        <RoleDefaultsSkeleton />
      ) : groups.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('preferences.noTemplates')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, index) => (
            <RoleDefaultCategorySection
              key={group.category}
              group={group}
              localState={localState}
              onToggle={handleToggle}
              index={index}
            />
          ))}
        </div>
      )}

      {/* Confirmation dialog for switching roles with unsaved changes (Issue #10) */}
      <AlertDialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) cancelRoleSwitch();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('preferences.roleDefaults.selectRole')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('preferences.roleDefaults.unsavedRoleSwitch')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelRoleSwitch}>
              {t('preferences.roleDefaults.cancelSwitch', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRoleSwitch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('preferences.roleDefaults.confirmSwitch', 'Discard & Switch')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ── Category Section ─────────────────────────────────────────────────────────

interface RoleDefaultCategorySectionProps {
  group: RoleDefaultGroup;
  localState: LocalState;
  onToggle: (templateId: string, channel: Channel) => void;
  index: number;
}

function RoleDefaultCategorySection({
  group,
  localState,
  onToggle,
  index,
}: RoleDefaultCategorySectionProps) {
  const { t } = useI18n('notifications');

  return (
    <Collapsible defaultOpen>
      <div
        className="animate-step-in rounded-lg border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.1)]"
        style={{ animationDelay: `${100 + index * 80}ms` }}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-6 py-3 text-left transition-colors hover:bg-[#f5f3ff] rounded-t-lg [&[data-state=closed]]:rounded-b-lg"
          >
            <h3 className="font-heading text-sm font-semibold text-foreground">{group.category}</h3>
            <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-6 pb-3">
            {/* Column headers */}
            <div className="flex items-center border-b border-border/50 py-2.5">
              <div className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('preferences.channel.event', 'Event')}
              </div>
              {CHANNELS.map((ch) => (
                <div
                  key={ch.key}
                  className="w-20 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {t(ch.labelKey)}
                </div>
              ))}
            </div>

            {/* Preference rows */}
            {group.items.map((item) => {
              const state = localState[item.templateId] ?? {
                enableInApp: item.enableInApp,
                enableEmail: item.enableEmail,
                enablePush: item.enablePush,
              };

              return (
                <div
                  key={item.templateId}
                  className="flex items-center border-b border-border/30 py-2.5 last:border-b-0"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm text-foreground truncate">{item.templateName}</p>
                  </div>

                  {CHANNELS.map((ch) => (
                    <div key={ch.key} className="w-20 flex justify-center">
                      <Switch
                        checked={state[ch.key]}
                        onCheckedChange={() => onToggle(item.templateId, ch.key)}
                        className="data-[state=checked]:bg-[#7c3aed]"
                        aria-label={`${item.templateName} ${t(ch.labelKey)}`}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function RoleDefaultsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, gi) => (
        <div key={gi} className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, ri) => (
              <div key={ri} className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <div className="flex gap-8">
                  <Skeleton className="h-5 w-8 rounded-full" />
                  <Skeleton className="h-5 w-8 rounded-full" />
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
