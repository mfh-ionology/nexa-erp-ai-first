import { useState } from 'react';
import { AlertTriangle, ChevronDown, RotateCcw, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import { PageHeader } from './page-header';
import type { SettingsPageProps, SettingsGroup } from './types';

/**
 * T7: Settings Page template.
 *
 * Provides a grouped settings layout with collapsible sections,
 * save/reset controls, and unsaved changes indicator.
 *
 * Used for Company Settings, Module Settings, User Preferences,
 * and similar configuration screens (~12 screens in the ERP).
 *
 * Responsive behaviour:
 *  - Desktop (>=1024px): Two-column layout (label/description left, content right)
 *  - Tablet (768-1023px): Single-column form
 *  - Phone (<768px): Stacked sections, accordion collapse for all groups
 */
export function SettingsPage({
  // BaseTemplateProps
  title,
  subtitle,
  breadcrumbs,
  isLoading = false,
  children,
  // SettingsPage-specific props
  groups,
  isDirty = false,
  onSave,
  onReset,
  actionBarSlot,
}: SettingsPageProps) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();

  // Track which collapsible groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of groups) {
      // On phone, collapse all by default unless defaultOpen is true
      // On desktop/tablet, non-collapsible groups are always open
      initial[group.key] = group.defaultOpen ?? !group.isCollapsible;
    }
    return initial;
  });

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Default action bar (save + reset) ---
  const defaultActionBar = (
    <div className="flex items-center gap-3">
      {/* Unsaved changes indicator */}
      {isDirty && (
        <div
          className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400"
          role="status"
          aria-live="polite"
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
          <span>{t('unsavedChanges')}</span>
        </div>
      )}

      {/* Reset to Defaults — with confirmation dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" disabled={!onReset}>
            <RotateCcw className="size-4" />
            {t('resetDefaults')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.resetConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.resetConfirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('cancel')}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" onClick={onReset}>
                {t('resetDefaults')}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save button */}
      <Button onClick={onSave} disabled={!isDirty} size="sm">
        <Save className="size-4" />
        {t('saveSettings')}
      </Button>
    </div>
  );

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <main className="flex flex-col gap-6" aria-label={title} aria-busy="true">
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          isLoading
        />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-4 w-64" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // --- Phone layout: all groups as accordion ---
  if (breakpoint === 'phone') {
    return (
      <main className="flex flex-col gap-4" aria-label={title}>
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
        />

        {/* Action bar */}
        <div className="flex items-center justify-end">
          {actionBarSlot ?? defaultActionBar}
        </div>

        {/* Settings groups — all collapsible on phone */}
        <div className="space-y-2">
          {groups.map((group) => (
            <SettingsGroupAccordion
              key={group.key}
              group={group}
              isOpen={openGroups[group.key] ?? false}
              onToggle={() => toggleGroup(group.key)}
            />
          ))}
        </div>

        {children}

        {/* Sticky save bar at bottom on phone when dirty */}
        {isDirty && (
          <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 py-3">
            <Button onClick={onSave} className="w-full">
              <Save className="size-4" />
              {t('saveSettings')}
            </Button>
          </div>
        )}
      </main>
    );
  }

  // --- Tablet layout: single-column ---
  if (breakpoint === 'tablet') {
    return (
      <main className="flex flex-col gap-6" aria-label={title}>
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          actionBarSlot={actionBarSlot ?? defaultActionBar}
        />

        {/* Settings groups — single column */}
        <div className="space-y-6">
          {groups.map((group) => (
            <SettingsGroupSection
              key={group.key}
              group={group}
              isOpen={openGroups[group.key] ?? true}
              onToggle={() => toggleGroup(group.key)}
              layout="single-column"
            />
          ))}
        </div>

        {children}
      </main>
    );
  }

  // --- Desktop layout: two-column (label left, content right) ---
  return (
    <main className="flex flex-col gap-6" aria-label={title}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actionBarSlot={actionBarSlot ?? defaultActionBar}
      />

      {/* Settings groups — two-column layout */}
      <div className="space-y-8">
        {groups.map((group) => (
          <SettingsGroupSection
            key={group.key}
            group={group}
            isOpen={openGroups[group.key] ?? true}
            onToggle={() => toggleGroup(group.key)}
            layout="two-column"
          />
        ))}
      </div>

      {children}
    </main>
  );
}

// --- Internal: Settings Group as Accordion (phone) ---

interface SettingsGroupAccordionProps {
  group: SettingsGroup;
  isOpen: boolean;
  onToggle: () => void;
}

function SettingsGroupAccordion({
  group,
  isOpen,
  onToggle,
}: SettingsGroupAccordionProps) {
  const { t } = useI18n();

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div
        className="rounded-lg border"
        role="group"
        aria-label={t('settings.groupAriaLabel', { label: t(group.labelKey) })}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between rounded-b-none px-4 py-3 text-left font-medium"
          >
            <div className="flex items-center gap-2">
              {group.icon && (
                <span className="text-muted-foreground" aria-hidden="true">
                  {group.icon}
                </span>
              )}
              <span>{t(group.labelKey)}</span>
            </div>
            <ChevronDown
              className={cn(
                'size-4 transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 py-4">
            {group.descriptionKey && (
              <p className="mb-3 text-sm text-muted-foreground">
                {t(group.descriptionKey)}
              </p>
            )}
            {group.content}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// --- Internal: Settings Group Section (tablet/desktop) ---

interface SettingsGroupSectionProps {
  group: SettingsGroup;
  isOpen: boolean;
  onToggle: () => void;
  layout: 'single-column' | 'two-column';
}

function SettingsGroupSection({
  group,
  isOpen,
  onToggle,
  layout,
}: SettingsGroupSectionProps) {
  const { t } = useI18n();

  const headerContent = (
    <div className="flex items-center gap-2">
      {group.icon && (
        <span className="text-muted-foreground" aria-hidden="true">
          {group.icon}
        </span>
      )}
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {t(group.labelKey)}
        </h3>
        {group.descriptionKey && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t(group.descriptionKey)}
          </p>
        )}
      </div>
    </div>
  );

  const contentArea = (
    <div className={cn(layout === 'two-column' && 'flex-1')}>
      {group.content}
    </div>
  );

  // Non-collapsible group
  if (!group.isCollapsible) {
    return (
      <section
        className="rounded-lg border"
        role="group"
        aria-label={t('settings.groupAriaLabel', { label: t(group.labelKey) })}
      >
        <div
          className={cn(
            'p-6',
            layout === 'two-column' && 'flex gap-8',
          )}
        >
          <div className={cn(layout === 'two-column' && 'w-64 shrink-0')}>
            {headerContent}
          </div>
          {contentArea}
        </div>
      </section>
    );
  }

  // Collapsible group
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <section
        className="rounded-lg border"
        role="group"
        aria-label={t('settings.groupAriaLabel', { label: t(group.labelKey) })}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-muted/50',
              !isOpen && 'rounded-lg',
              isOpen && 'rounded-t-lg',
            )}
          >
            {headerContent}
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            className={cn(
              'border-t px-6 py-4',
              layout === 'two-column' && 'flex gap-8',
            )}
          >
            {layout === 'two-column' && (
              <div className="w-64 shrink-0" />
            )}
            {contentArea}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
