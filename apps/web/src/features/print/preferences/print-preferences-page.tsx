/**
 * PrintPreferencesPage — T7 Settings layout for managing
 * per-document-type print action preferences.
 *
 * Uses hooks from Task 4 (usePrintPreferences, useUpdatePrintPreferences,
 * useResetPrintPreferences, usePrintCompanyDefaults, useUpdatePrintCompanyDefaults)
 * and renders the preference table via <PrintPreferenceTable>.
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
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/templates/page-header';

import { useAuthStore } from '@/stores/auth-store';

import { usePrintPreferences } from '../api/use-print-preferences';
import type { DocumentType, PrintAction, PrintPreferenceItem } from '../api/use-print-preferences';
import { useUpdatePrintPreferences } from '../api/use-update-print-preferences';
import { useResetPrintPreferences } from '../api/use-reset-print-preferences';
import { usePrintCompanyDefaults } from '../api/use-print-company-defaults';
import type { CompanyDefaultItem } from '../api/use-print-company-defaults';
import { useUpdatePrintCompanyDefaults } from '../api/use-print-company-defaults';
import { PrintPreferenceTable } from './print-preference-table';

// ── Types ────────────────────────────────────────────────────────────────────

type LocalPreferences = Record<string, PrintAction>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildLocalState(preferences: PrintPreferenceItem[]): LocalPreferences {
  const state: LocalPreferences = {};
  for (const pref of preferences) {
    state[pref.documentType] = pref.action;
  }
  return state;
}

function buildCompanyDefaultsState(defaults: CompanyDefaultItem[]): LocalPreferences {
  const state: LocalPreferences = {};
  for (const d of defaults) {
    state[d.documentType] = d.action;
  }
  return state;
}

function getDirtyPreferences(
  original: PrintPreferenceItem[],
  local: LocalPreferences,
): Array<{ documentType: DocumentType; action: PrintAction }> {
  const changes: Array<{ documentType: DocumentType; action: PrintAction }> = [];
  for (const pref of original) {
    const localAction = local[pref.documentType];
    if (localAction !== undefined && localAction !== pref.action) {
      changes.push({ documentType: pref.documentType, action: localAction });
    }
  }
  return changes;
}

function getDirtyCompanyDefaults(
  original: CompanyDefaultItem[],
  local: LocalPreferences,
): Array<{ documentType: DocumentType; action: PrintAction }> {
  const changes: Array<{ documentType: DocumentType; action: PrintAction }> = [];
  for (const d of original) {
    const localAction = local[d.documentType];
    if (localAction !== undefined && localAction !== d.action) {
      changes.push({ documentType: d.documentType, action: localAction });
    }
  }
  return changes;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PrintPreferencesPage() {
  const { t } = useI18n('print');
  const tCommon = useI18n().t;
  const permissions = useAuthStore((s) => s.permissions);
  const isAdmin =
    permissions?.role === 'ADMIN' ||
    permissions?.role === 'SUPER_ADMIN' ||
    permissions?.isSuperAdmin;

  // ── Data hooks ──────────────────────────────────────────────────────────────

  const { data: preferencesData, isLoading, isError, refetch } = usePrintPreferences();
  const updateMutation = useUpdatePrintPreferences();
  const resetMutation = useResetPrintPreferences();

  const { data: companyDefaultsData, isLoading: isLoadingDefaults } = usePrintCompanyDefaults();
  const updateDefaultsMutation = useUpdatePrintCompanyDefaults();

  const preferences = preferencesData ?? [];
  const companyDefaults = companyDefaultsData ?? [];

  // ── User preferences local state ───────────────────────────────────────────

  const [localState, setLocalState] = useState<LocalPreferences>({});
  const [initialState, setInitialState] = useState<LocalPreferences>({});
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (preferences.length > 0 && !isDirtyRef.current) {
      const state = buildLocalState(preferences);
      setLocalState(state);
      setInitialState(state);
    }
  }, [preferences]);

  // ── Company defaults local state ──────────────────────────────────────────

  const [defaultsLocalState, setDefaultsLocalState] = useState<LocalPreferences>({});
  const [initialDefaults, setInitialDefaults] = useState<LocalPreferences>({});
  const isDefaultsDirtyRef = useRef(false);

  useEffect(() => {
    if (companyDefaults.length > 0 && !isDefaultsDirtyRef.current) {
      const state = buildCompanyDefaultsState(companyDefaults);
      setDefaultsLocalState(state);
      setInitialDefaults(state);
    }
  }, [companyDefaults]);

  // ── Dirty tracking ─────────────────────────────────────────────────────────

  const isDirty = useMemo(() => {
    for (const [docType, action] of Object.entries(localState)) {
      if (initialState[docType] !== action) return true;
    }
    return false;
  }, [localState, initialState]);

  const isDefaultsDirty = useMemo(() => {
    for (const [docType, action] of Object.entries(defaultsLocalState)) {
      if (initialDefaults[docType] !== action) return true;
    }
    return false;
  }, [defaultsLocalState, initialDefaults]);

  // Keep refs in sync for useEffect guards
  isDirtyRef.current = isDirty;
  isDefaultsDirtyRef.current = isDefaultsDirty;

  const anyDirty = isDirty || isDefaultsDirty;

  // ── Navigation blocking ────────────────────────────────────────────────────

  const blocker = useBlocker({
    shouldBlockFn: () => anyDirty,
    withResolver: true,
  });

  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

  // ── Handlers: user preferences ─────────────────────────────────────────────

  const handleChange = useCallback((documentType: DocumentType, action: PrintAction) => {
    setLocalState((prev) => ({ ...prev, [documentType]: action }));
  }, []);

  const handleSave = useCallback(() => {
    const changes = getDirtyPreferences(preferences, localState);
    if (changes.length === 0) return;
    updateMutation.mutate(
      { preferences: changes },
      {
        onSuccess: () => {
          // Clear dirty state after successful save
          setInitialState({ ...localState });
        },
      },
    );
  }, [preferences, localState, updateMutation]);

  const handleReset = useCallback(() => {
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        // Clear dirty + local state so refetch can sync fresh defaults
        setLocalState({});
        setInitialState({});
      },
    });
  }, [resetMutation]);

  // ── Handlers: company defaults ─────────────────────────────────────────────

  const handleDefaultChange = useCallback((documentType: DocumentType, action: PrintAction) => {
    setDefaultsLocalState((prev) => ({ ...prev, [documentType]: action }));
  }, []);

  const handleSaveDefaults = useCallback(() => {
    const changes = getDirtyCompanyDefaults(companyDefaults, defaultsLocalState);
    if (changes.length === 0) return;
    updateDefaultsMutation.mutate(
      { defaults: changes },
      {
        onSuccess: () => {
          // Clear dirty state after successful save
          setInitialDefaults({ ...defaultsLocalState });
        },
      },
    );
  }, [companyDefaults, defaultsLocalState, updateDefaultsMutation]);

  // ── Breadcrumbs ────────────────────────────────────────────────────────────

  const breadcrumbs = useMemo(
    () => [
      { label: tCommon('navigation:system'), path: '/system' },
      { label: t('preferences.title') },
    ],
    [t, tCommon],
  );

  // ── Action bar ─────────────────────────────────────────────────────────────

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

  // ── Error state ────────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

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

      {/* User preferences table */}
      <PrintPreferenceTable
        preferences={preferences}
        localState={localState}
        onChange={handleChange}
        isLoading={isLoading}
        companyDefaults={companyDefaults}
      />

      {/* Admin-only: Company defaults section */}
      {isAdmin && (
        <>
          <Separator className="my-2" />

          <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">
                  {t('preferences.companyDefaults.title')}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('preferences.companyDefaults.description')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isDefaultsDirty && (
                  <div
                    className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400"
                    role="status"
                    aria-live="polite"
                  >
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    <span>{t('preferences.unsavedChanges')}</span>
                  </div>
                )}
                <Button
                  onClick={handleSaveDefaults}
                  disabled={!isDefaultsDirty || updateDefaultsMutation.isPending}
                  size="sm"
                  className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
                >
                  <Save className="size-4" />
                  {t('preferences.companyDefaults.saveButton')}
                </Button>
              </div>
            </div>

            <PrintPreferenceTable
              preferences={companyDefaults}
              localState={defaultsLocalState}
              onChange={handleDefaultChange}
              isLoading={isLoadingDefaults}
              hideSourceLabels
            />
          </div>
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
              <AlertDialogDescription>
                {t('preferences.unsavedChangesDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset()}>
                {tCommon('cancel', 'Cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => blocker.proceed()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {tCommon('discardAndLeave', 'Discard & Leave')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </main>
  );
}
