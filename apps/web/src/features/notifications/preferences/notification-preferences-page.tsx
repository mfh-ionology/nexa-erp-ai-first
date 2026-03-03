/**
 * NotificationPreferencesPage — T7 Settings layout for managing
 * per-channel, per-event-type notification preferences.
 *
 * Uses the existing hooks from Task 1 (useNotificationPreferences,
 * useUpdateNotificationPreferences, useResetNotificationPreferences)
 * and renders a matrix grid via <PreferenceMatrix>.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from '@tanstack/react-router';
import { AlertTriangle, RotateCcw, Save } from 'lucide-react';

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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/templates/page-header';

import { useAuthStore } from '@/stores/auth-store';
import { Separator } from '@/components/ui/separator';

import { useNotificationPreferences } from '../api/use-notification-preferences';
import type { NotificationPreferenceItem } from '../api/use-notification-preferences';
import { useUpdateNotificationPreferences } from '../api/use-update-notification-preferences';
import { useResetNotificationPreferences } from '../api/use-reset-notification-preferences';
import { PreferenceMatrix } from './preference-matrix';
import { RoleDefaultsSection } from './role-defaults-section';

// ── Types ────────────────────────────────────────────────────────────────────

type Channel = 'enableInApp' | 'enableEmail' | 'enablePush';
type LocalState = Record<string, Record<Channel, boolean>>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildLocalState(preferences: NotificationPreferenceItem[]): LocalState {
  const state: LocalState = {};
  for (const pref of preferences) {
    state[pref.templateId] = {
      enableInApp: pref.enableInApp,
      enableEmail: pref.enableEmail,
      enablePush: pref.enablePush,
    };
  }
  return state;
}

function getDirtyPreferences(
  original: NotificationPreferenceItem[],
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

  for (const pref of original) {
    const localPref = local[pref.templateId];
    if (!localPref) continue;

    if (
      localPref.enableInApp !== pref.enableInApp ||
      localPref.enableEmail !== pref.enableEmail ||
      localPref.enablePush !== pref.enablePush
    ) {
      changes.push({
        notificationTemplateId: pref.templateId,
        enableInApp: localPref.enableInApp,
        enableEmail: localPref.enableEmail,
        enablePush: localPref.enablePush,
      });
    }
  }

  return changes;
}

// ── Component ────────────────────────────────────────────────────────────────

export function NotificationPreferencesPage() {
  const { t } = useI18n('notifications');
  const tCommon = useI18n().t;
  const permissions = useAuthStore((s) => s.permissions);
  const isAdmin =
    permissions?.role === 'ADMIN' ||
    permissions?.role === 'SUPER_ADMIN' ||
    permissions?.isSuperAdmin;

  // Data hooks
  const { data: preferencesData, isLoading, isError, refetch } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();
  const resetMutation = useResetNotificationPreferences();

  const preferences = preferencesData?.items ?? [];

  // Local state for dirty tracking
  const [localState, setLocalState] = useState<LocalState>({});
  const initialStateRef = useRef<LocalState>({});

  // Sync local state when server data loads/refreshes.
  // Guard: do NOT overwrite local state if the user has unsaved changes
  // (e.g., from a background query refetch on window focus).
  const isDirtyRef = useRef(false);
  useEffect(() => {
    if (preferences.length > 0 && !isDirtyRef.current) {
      const state = buildLocalState(preferences);
      setLocalState(state);
      initialStateRef.current = state;
    }
  }, [preferences]);

  // Dirty tracking
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

  // Block in-app navigation when dirty — show confirmation dialog
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
  });

  // Browser beforeunload warning
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Toggle handler
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

  // Save handler — sends only dirty preferences
  const handleSave = useCallback(() => {
    const changes = getDirtyPreferences(preferences, localState);
    if (changes.length === 0) return;
    updateMutation.mutate({ preferences: changes });
  }, [preferences, localState, updateMutation]);

  // Reset handler — deletes all user preferences, falling back to defaults
  const handleReset = useCallback(() => {
    resetMutation.mutate(undefined);
  }, [resetMutation]);

  // Breadcrumbs
  const breadcrumbs = useMemo(
    () => [
      { label: tCommon('navigation:system'), path: '/system' },
      { label: t('preferences.title') },
    ],
    [t, tCommon],
  );

  // Action bar
  const actionBar = (
    <div className="flex items-center gap-3">
      {isDirty && (
        <div
          className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400"
          role="status"
          aria-live="polite"
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
          <span>{t('preferences.unsavedChanges')}</span>
        </div>
      )}

      {/* Reset to Defaults — with confirmation dialog */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground hover:bg-[#f5f3ff]"
          >
            <RotateCcw className="size-4" />
            {t('preferences.resetButton')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('preferences.resetButton')}</AlertDialogTitle>
            <AlertDialogDescription>{t('preferences.resetConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('preferences.resetButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={!isDirty || updateMutation.isPending}
        size="sm"
        className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
      >
        <Save className="size-4" />
        {t('preferences.saveButton')}
      </Button>
    </div>
  );

  // Error state
  if (isError) {
    return (
      <main className="flex flex-col gap-6" aria-label={t('preferences.title')}>
        <PageHeader title={t('preferences.title')} breadcrumbs={breadcrumbs} />
        <div className="rounded-xl border bg-card p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)] animate-fade-in-up">
          <p className="text-sm text-muted-foreground mb-4">{t('preferences.loadError')}</p>
          <Button variant="outline" onClick={() => refetch()}>
            {tCommon('retry', 'Retry')}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6" aria-label={t('preferences.title')}>
      <PageHeader
        title={t('preferences.title')}
        breadcrumbs={breadcrumbs}
        actionBarSlot={actionBar}
        isLoading={isLoading}
      />

      {/* Description */}
      <p className="text-sm text-muted-foreground animate-fade-in-up delay-2">
        {t('preferences.description')}
      </p>

      {/* Preference matrix grid */}
      <PreferenceMatrix
        preferences={preferences}
        localState={localState}
        onToggle={handleToggle}
        isLoading={isLoading}
      />

      {/* Admin-only: Role defaults management */}
      {isAdmin && (
        <>
          <Separator className="my-2" />
          <RoleDefaultsSection />
        </>
      )}

      {/* Navigation blocker confirmation dialog */}
      {blocker.status === 'blocked' && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) blocker.reset();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('preferences.unsavedChanges')}</AlertDialogTitle>
              <AlertDialogDescription>{t('preferences.unsavedChanges')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset()}>
                {tCommon('cancel', 'Cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => blocker.proceed()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('preferences.discardAndLeave', 'Discard & Leave')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </main>
  );
}
