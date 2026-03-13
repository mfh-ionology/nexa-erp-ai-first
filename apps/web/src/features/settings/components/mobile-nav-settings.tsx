/**
 * MobileNavSettings — lets the user choose their preferred mobile navigation
 * style (Classic Tabs, Minimal, or My Shortcuts).
 *
 * Reads current value from the Zustand auth store, PATCHes the API on change,
 * and updates the store optimistically.
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';
import { cn } from '@/lib/utils';
import { apiPatch } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { MobileNavStyle } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Option definitions
// ---------------------------------------------------------------------------

const MOBILE_NAV_OPTIONS: ReadonlyArray<{
  value: MobileNavStyle;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: 'CLASSIC_TABS',
    labelKey: 'navigation:mobileNavStyle.classicTabs.label',
    descriptionKey: 'navigation:mobileNavStyle.classicTabs.description',
  },
  {
    value: 'MINIMAL',
    labelKey: 'navigation:mobileNavStyle.minimal.label',
    descriptionKey: 'navigation:mobileNavStyle.minimal.description',
  },
  {
    value: 'MY_SHORTCUTS',
    labelKey: 'navigation:mobileNavStyle.myShortcuts.label',
    descriptionKey: 'navigation:mobileNavStyle.myShortcuts.description',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobileNavSettings() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const currentStyle: MobileNavStyle = user?.mobileNavStyle ?? 'CLASSIC_TABS';
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = useCallback(
    async (value: MobileNavStyle) => {
      if (!user || value === currentStyle || isSaving) return;

      setIsSaving(true);

      // Optimistically update the store
      const previousStyle = currentStyle;
      useAuthStore.setState({
        user: { ...user, mobileNavStyle: value },
      });

      try {
        await apiPatch(`/system/users/${user.id}`, { mobileNavStyle: value });
        toast.success(t('navigation:mobileNavStyle.saveSuccess'));
      } catch {
        // Revert optimistic update
        useAuthStore.setState({
          user: { ...user, mobileNavStyle: previousStyle },
        });
        toast.error(t('navigation:mobileNavStyle.saveError'));
      } finally {
        setIsSaving(false);
      }
    },
    [user, currentStyle, isSaving, t],
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('navigation:mobileNavStyle.title')}
      </h3>
      <p className="text-xs text-muted-foreground">{t('navigation:mobileNavStyle.description')}</p>
      <div className="space-y-2">
        {MOBILE_NAV_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={isSaving}
            onClick={() => void handleChange(option.value)}
            className={cn(
              'w-full rounded-lg border p-3 text-left transition-colors',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              currentStyle === option.value
                ? 'border-[#7c3aed]/30 bg-[#f5f3ff] ring-1 ring-[#7c3aed]/20'
                : 'border-border hover:border-border/80 hover:bg-[#f5f3ff]/50',
            )}
            aria-pressed={currentStyle === option.value}
          >
            <div className="text-sm font-medium text-foreground">{t(option.labelKey)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t(option.descriptionKey)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
