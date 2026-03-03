/**
 * PreferenceMatrix — displays notification templates as a matrix grid.
 *
 * Rows: one per NotificationTemplate, grouped by category (event name prefix).
 * Columns: In-App, Email, Push — each with a Switch toggle.
 * Shows "(default)" label when the preference is inherited from template defaults.
 */

import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import type { NotificationPreferenceItem } from '../api/use-notification-preferences';

// ── Types ────────────────────────────────────────────────────────────────────

type Channel = 'enableInApp' | 'enableEmail' | 'enablePush';

interface PreferenceGroup {
  category: string;
  items: NotificationPreferenceItem[];
}

export interface PreferenceMatrixProps {
  preferences: NotificationPreferenceItem[];
  localState: Record<string, Record<Channel, boolean>>;
  onToggle: (templateId: string, channel: Channel) => void;
  isLoading?: boolean;
}

// ── Channel column config ────────────────────────────────────────────────────

const CHANNELS: { key: Channel; labelKey: string }[] = [
  { key: 'enableInApp', labelKey: 'preferences.channel.inApp' },
  { key: 'enableEmail', labelKey: 'preferences.channel.email' },
  { key: 'enablePush', labelKey: 'preferences.channel.push' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a raw category string into a human-readable label.
 * Handles underscores, hyphens, and common acronyms (CRM, HR, AP, AR, AI).
 */
function formatCategory(raw: string): string {
  const ACRONYMS = new Set(['crm', 'hr', 'ap', 'ar', 'ai', 'erp', 'api']);
  return raw
    .split(/[_-]/)
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

function groupByCategory(preferences: NotificationPreferenceItem[]): PreferenceGroup[] {
  const groups = new Map<string, NotificationPreferenceItem[]>();

  for (const pref of preferences) {
    // Derive category from eventName prefix (e.g., "invoice.approved" → "Invoice")
    const dotIndex = pref.eventName.indexOf('.');
    const rawCategory = dotIndex > 0 ? pref.eventName.slice(0, dotIndex) : 'general';
    const category = formatCategory(rawCategory);

    const existing = groups.get(category);
    if (existing) {
      existing.push(pref);
    } else {
      groups.set(category, [pref]);
    }
  }

  return Array.from(groups.entries()).map(([category, items]) => ({
    category,
    items,
  }));
}

/**
 * Returns the source label to display under a toggle, or null if the value
 * is user-customised. Uses the `source` field from the backend cascade
 * (USER → ROLE_DEFAULT → TEMPLATE_DEFAULT) to show the correct origin.
 */
function getSourceLabel(
  pref: NotificationPreferenceItem,
  t: (key: string) => string,
): string | null {
  if (pref.source === 'USER') return null;
  if (pref.source === 'ROLE_DEFAULT') return t('preferences.source.roleDefault');
  return t('preferences.usingDefault');
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function MatrixSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, gi) => (
        <div key={gi} className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, ri) => (
              <div key={ri} className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
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

// ── Category Section ─────────────────────────────────────────────────────────

interface CategorySectionProps {
  group: PreferenceGroup;
  localState: Record<string, Record<Channel, boolean>>;
  onToggle: (templateId: string, channel: Channel) => void;
  index: number;
}

function CategorySection({ group, localState, onToggle, index }: CategorySectionProps) {
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
            className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-[#f5f3ff] rounded-t-lg [&[data-state=closed]]:rounded-b-lg"
          >
            <h3 className="font-heading text-sm font-semibold text-foreground">{group.category}</h3>
            <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-6 pb-4">
            {/* Column headers */}
            <div className="flex items-center border-b border-border/50 py-3">
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
            {group.items.map((pref) => {
              const state = localState[pref.templateId] ?? {
                enableInApp: pref.enableInApp,
                enableEmail: pref.enableEmail,
                enablePush: pref.enablePush,
              };

              const sourceLabel = getSourceLabel(pref, t);

              return (
                <div
                  key={pref.templateId}
                  className="flex items-center border-b border-border/30 py-3 last:border-b-0"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm text-foreground truncate">{pref.templateName}</p>
                    {sourceLabel && (
                      <span className="text-[10px] text-muted-foreground">{sourceLabel}</span>
                    )}
                  </div>

                  {CHANNELS.map((ch) => {
                    const checked = state[ch.key];

                    return (
                      <div key={ch.key} className="w-20 flex flex-col items-center gap-0.5">
                        <Switch
                          checked={checked}
                          onCheckedChange={() => onToggle(pref.templateId, ch.key)}
                          className="data-[state=checked]:bg-[#7c3aed]"
                          aria-label={`${pref.templateName} ${t(ch.labelKey)}`}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function PreferenceMatrix({
  preferences,
  localState,
  onToggle,
  isLoading,
}: PreferenceMatrixProps) {
  const { t } = useI18n('notifications');

  const groups = useMemo(() => groupByCategory(preferences), [preferences]);

  if (isLoading) {
    return <MatrixSkeleton />;
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center animate-fade-in-up">
        <p className="text-sm text-muted-foreground">{t('preferences.noTemplates')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group, index) => (
        <CategorySection
          key={group.category}
          group={group}
          localState={localState}
          onToggle={onToggle}
          index={index}
        />
      ))}
    </div>
  );
}
