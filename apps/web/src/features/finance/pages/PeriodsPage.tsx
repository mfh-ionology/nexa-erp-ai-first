/* eslint-disable i18next/no-literal-string */
/**
 * PeriodsPage — Financial period management page (T1 Entity List template).
 *
 * Displays periods grouped by fiscal year with expandable sections.
 * Actions: Create Year, Close, Reopen, Lock (with confirmation for Lock).
 * Status badges: OPEN (green), CLOSED (yellow), LOCKED (red).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, Lock, Plus, RotateCcw, XCircle } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import type { Period, PeriodStatus, FiscalYearGroup } from '../api/periods-api';
import {
  usePeriods,
  useCreateFiscalYear,
  useClosePeriod,
  useReopenPeriod,
  useLockPeriod,
} from '../hooks/use-periods';

// ---------------------------------------------------------------------------
// Status badge config (Concept D palette)
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<PeriodStatus, { label: string; className: string }> = {
  OPEN: {
    label: 'Open',
    className: 'border-transparent bg-[#dcfce7] text-[#166534] hover:bg-[#dcfce7]',
  },
  CLOSED: {
    label: 'Closed',
    className: 'border-transparent bg-[#fef9c3] text-[#854d0e] hover:bg-[#fef9c3]',
  },
  LOCKED: {
    label: 'Locked',
    className: 'border-transparent bg-[#fee2e2] text-[#991b1b] hover:bg-[#fee2e2]',
  },
};

// ---------------------------------------------------------------------------
// StatusBadge sub-component
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: PeriodStatus }) {
  const { t } = useI18n();
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={config.className}>
      {status === 'LOCKED' && <Lock className="mr-1 h-3 w-3" />}
      {t(`finance.periods.status.${status.toLowerCase()}`, config.label)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// FiscalYearSection sub-component
// ---------------------------------------------------------------------------

function FiscalYearSection({
  group,
  expanded,
  onToggle,
  onClose,
  onReopen,
  onRequestLock,
  closePending,
  reopenPending,
}: {
  group: FiscalYearGroup;
  expanded: boolean;
  onToggle: () => void;
  onClose: (id: string) => void;
  onReopen: (id: string) => void;
  onRequestLock: (period: Period) => void;
  closePending: boolean;
  reopenPending: boolean;
}) {
  const { t } = useI18n();
  const { summary } = group;

  return (
    <div className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Year Header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#f5f3ff]/50"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-serif text-lg font-semibold text-foreground">
          {t('finance.periods.fiscalYear', 'Fiscal Year')} {group.fiscalYear}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {summary.total} {t('finance.periods.periodsLabel', 'periods')}
          </span>
          <div className="flex items-center gap-1.5">
            {summary.open > 0 && (
              <span className="inline-flex items-center rounded-full bg-[#dcfce7] px-2 py-0.5 text-xs font-medium text-[#166534]">
                {summary.open} {t('finance.periods.status.open', 'Open')}
              </span>
            )}
            {summary.closed > 0 && (
              <span className="inline-flex items-center rounded-full bg-[#fef9c3] px-2 py-0.5 text-xs font-medium text-[#854d0e]">
                {summary.closed} {t('finance.periods.status.closed', 'Closed')}
              </span>
            )}
            {summary.locked > 0 && (
              <span className="inline-flex items-center rounded-full bg-[#fee2e2] px-2 py-0.5 text-xs font-medium text-[#991b1b]">
                {summary.locked} {t('finance.periods.status.locked', 'Locked')}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Periods Table */}
      {expanded && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[rgba(107,114,128,0.04)]">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('finance.periods.table.period', 'Period')}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('finance.periods.table.name', 'Name')}
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                    {t('finance.periods.table.startDate', 'Start Date')}
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                    {t('finance.periods.table.endDate', 'End Date')}
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('finance.periods.table.status', 'Status')}
                  </th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('finance.periods.table.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.periods.map((period) => (
                  <PeriodRow
                    key={period.id}
                    period={period}
                    onClose={onClose}
                    onReopen={onReopen}
                    onRequestLock={onRequestLock}
                    closePending={closePending}
                    reopenPending={reopenPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PeriodRow sub-component
// ---------------------------------------------------------------------------

function PeriodRow({
  period,
  onClose,
  onReopen,
  onRequestLock,
  closePending,
  reopenPending,
}: {
  period: Period;
  onClose: (id: string) => void;
  onReopen: (id: string) => void;
  onRequestLock: (period: Period) => void;
  closePending: boolean;
  reopenPending: boolean;
}) {
  const { t } = useI18n();

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <tr className="border-t border-border/50 transition-colors hover:bg-[#f5f3ff]/30 last:border-b-0">
      <td className="px-5 py-3">
        <span className="font-mono text-sm font-medium text-foreground">
          P{String(period.periodNumber).padStart(2, '0')}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-foreground">{period.name}</span>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <span className="text-sm text-muted-foreground">{formatDate(period.startDate)}</span>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <span className="text-sm text-muted-foreground">{formatDate(period.endDate)}</span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={period.status} />
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {period.status === 'OPEN' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onClose(period.id)}
              disabled={closePending}
              className="h-7 gap-1 text-xs border-[#854d0e]/30 text-[#854d0e] hover:bg-[#fef9c3]/50"
            >
              <XCircle className="h-3 w-3" />
              {t('finance.periods.actions.close', 'Close')}
            </Button>
          )}
          {period.status === 'CLOSED' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReopen(period.id)}
                disabled={reopenPending}
                className="h-7 gap-1 text-xs border-[#166534]/30 text-[#166534] hover:bg-[#dcfce7]/50"
              >
                <RotateCcw className="h-3 w-3" />
                {t('finance.periods.actions.reopen', 'Reopen')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRequestLock(period)}
                className="h-7 gap-1 text-xs border-[#991b1b]/30 text-[#991b1b] hover:bg-[#fee2e2]/50"
              >
                <Lock className="h-3 w-3" />
                {t('finance.periods.actions.lock', 'Lock')}
              </Button>
            </>
          )}
          {period.status === 'LOCKED' && (
            <span className="text-xs text-muted-foreground italic">
              {t('finance.periods.locked', 'Permanently locked')}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// CreateYearDialog sub-component
// ---------------------------------------------------------------------------

function CreateYearDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const createYear = useCreateFiscalYear();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [includeP13, setIncludeP13] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const fiscalYear = parseInt(year, 10);
      if (isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) return;

      createYear.mutate(
        { fiscalYear, includeP13 },
        {
          onSuccess: () => {
            onOpenChange(false);
            setYear(String(currentYear));
            setIncludeP13(false);
          },
        },
      );
    },
    [year, includeP13, createYear, onOpenChange, currentYear],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('finance.periods.createYear.title', 'Create Fiscal Year')}</DialogTitle>
            <DialogDescription>
              {t(
                'finance.periods.createYear.description',
                'Generate 12 monthly periods (plus optional Period 13 for year-end adjustments) for the selected fiscal year.',
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fiscal-year">
                {t('finance.periods.createYear.yearLabel', 'Fiscal Year')}
              </Label>
              <Input
                id="fiscal-year"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="focus-visible:ring-[#7c3aed]/30"
                placeholder="2026"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="include-p13"
                checked={includeP13}
                onCheckedChange={(checked) => setIncludeP13(checked === true)}
                className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
              />
              <Label htmlFor="include-p13" className="text-sm font-normal">
                {t(
                  'finance.periods.createYear.includeP13',
                  'Include Period 13 (year-end adjustments)',
                )}
              </Label>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createYear.isPending}
              className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            >
              {createYear.isPending
                ? t('common.creating', 'Creating...')
                : t('finance.periods.createYear.submit', 'Create Year')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// LockConfirmDialog sub-component
// ---------------------------------------------------------------------------

function LockConfirmDialog({
  period,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  period: Period | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const { t } = useI18n();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('finance.periods.lockConfirm.title', 'Lock Period?')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'finance.periods.lockConfirm.description',
              'Locking period {{name}} is irreversible. No transactions can be posted to a locked period. This action cannot be undone.',
              { name: period?.name ?? '' },
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-[#991b1b] text-white hover:bg-[#7f1d1d]"
          >
            <Lock className="mr-1.5 h-3.5 w-3.5" />
            {isPending
              ? t('common.locking', 'Locking...')
              : t('finance.periods.lockConfirm.confirm', 'Lock Period')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// PeriodsPage component
// ---------------------------------------------------------------------------

export function PeriodsPage() {
  const { t } = useI18n();

  // State
  const [createOpen, setCreateOpen] = useState(false);
  const [lockTarget, setLockTarget] = useState<Period | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Queries & Mutations
  const { fiscalYears, isLoading } = usePeriods();
  const closeMutation = useClosePeriod();
  const reopenMutation = useReopenPeriod();
  const lockMutation = useLockPeriod();

  // Auto-expand all years on first load
  const hasInitialised = useRef(false);
  useEffect(() => {
    if (!hasInitialised.current && fiscalYears.length > 0) {
      hasInitialised.current = true;
      setExpandedYears(new Set(fiscalYears.map((g) => g.fiscalYear)));
    }
  }, [fiscalYears]);

  // Toggle fiscal year expansion
  const toggleYear = useCallback((year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }, []);

  // Lock confirmation flow
  const handleRequestLock = useCallback((period: Period) => {
    setLockTarget(period);
  }, []);

  const handleConfirmLock = useCallback(() => {
    if (!lockTarget) return;
    lockMutation.mutate(lockTarget.id, {
      onSuccess: () => setLockTarget(null),
    });
  }, [lockTarget, lockMutation]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/finance">{t('modules.finance.title', 'Finance')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {t('finance.periods.title', 'Financial Periods')}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <h1 className="font-serif text-3xl font-bold text-foreground">
          {t('finance.periods.title', 'Financial Periods')}
        </h1>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
        >
          <Plus className="h-4 w-4" />
          {t('finance.periods.createYear.button', 'Create Year')}
        </Button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {isLoading ? (
          <SkeletonContent />
        ) : fiscalYears.length === 0 ? (
          <EmptyState onCreateYear={() => setCreateOpen(true)} />
        ) : (
          fiscalYears.map((group) => (
            <FiscalYearSection
              key={group.fiscalYear}
              group={group}
              expanded={expandedYears.has(group.fiscalYear)}
              onToggle={() => toggleYear(group.fiscalYear)}
              onClose={(id) => closeMutation.mutate(id)}
              onReopen={(id) => reopenMutation.mutate(id)}
              onRequestLock={handleRequestLock}
              closePending={closeMutation.isPending}
              reopenPending={reopenMutation.isPending}
            />
          ))
        )}
      </div>

      {/* Dialogs */}
      <CreateYearDialog open={createOpen} onOpenChange={setCreateOpen} />
      <LockConfirmDialog
        period={lockTarget}
        open={!!lockTarget}
        onOpenChange={(open) => {
          if (!open) setLockTarget(null);
        }}
        onConfirm={handleConfirmLock}
        isPending={lockMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ onCreateYear }: { onCreateYear: () => void }) {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border border-border bg-card p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
      <h3 className="mb-2 font-serif text-lg font-semibold text-foreground">
        {t('finance.periods.empty.title', 'No Financial Periods')}
      </h3>
      <p className="mb-6 text-sm text-muted-foreground">
        {t(
          'finance.periods.empty.description',
          'Create a fiscal year to generate monthly accounting periods.',
        )}
      </p>
      <Button onClick={onCreateYear} className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
        <Plus className="h-4 w-4" />
        {t('finance.periods.createYear.button', 'Create Year')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loading State
// ---------------------------------------------------------------------------

function SkeletonContent() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden"
        >
          <div className="flex items-center gap-3 px-5 py-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-6 w-40" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <div className="border-t border-border">
            <table className="w-full">
              <thead>
                <tr className="bg-[rgba(107,114,128,0.04)]">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <th key={j} className="px-4 py-2.5">
                      <Skeleton className="h-3 w-16" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, k) => (
                  <tr key={k} className="border-t border-border/50">
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-8" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-7 w-16 ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
