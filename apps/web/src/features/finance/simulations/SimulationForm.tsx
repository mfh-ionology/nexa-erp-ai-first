/* eslint-disable i18next/no-literal-string */
/**
 * SimulationForm — T3 Header + Lines page for simulations.
 *
 * Mirrors the JournalFormPage pattern exactly.
 * Additional actions: Convert to Journal, Invalidate.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  Loader2,
  MoreHorizontal,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/lib/form-utils';
import { useZodForm } from '@/lib/form-utils';
import { PageHeader } from '@/components/templates/page-header';

import {
  useSimulation,
  useCreateSimulation,
  useUpdateSimulation,
  useDeleteSimulation,
  useConvertSimulation,
  useInvalidateSimulation,
} from './api';
import type { SimulationStatus } from './api';
import { usePeriods } from '../hooks/use-periods';
import type { Period } from '../api/periods-api';
import { JournalLineGrid, createEmptyLine, lineRowsFromApi } from '../components/JournalLineGrid';
import type { LineRow } from '../components/JournalLineGrid';

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<SimulationStatus, { className: string }> = {
  ACTIVE: {
    className:
      'border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  },
  TRANSFERRED: {
    className:
      'border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  INVALID: {
    className:
      'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300',
  },
};

// ---------------------------------------------------------------------------
// Form schema (header only)
// ---------------------------------------------------------------------------

const simulationHeaderSchema = z.object({
  transactionDate: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required').max(500),
  reference: z.string().max(100).optional(),
  periodId: z.string().min(1, 'Period is required'),
});

type SimulationHeaderValues = z.infer<typeof simulationHeaderSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SimulationFormProps {
  simulationId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SimulationForm({ simulationId }: SimulationFormProps) {
  const { t } = useI18n('finance');
  const navigate = useNavigate();
  const isNew = !simulationId;

  // --- Data fetching ---
  const { data: simulation, isLoading, isError } = useSimulation(simulationId);

  // --- Mutations ---
  const createMutation = useCreateSimulation();
  const updateMutation = useUpdateSimulation(simulationId ?? '');
  const deleteMutation = useDeleteSimulation();
  const convertMutation = useConvertSimulation(simulationId ?? '');
  const invalidateMutation = useInvalidateSimulation(simulationId ?? '');

  // --- Periods data ---
  const { fiscalYears: periodGroups } = usePeriods();
  const allPeriods = useMemo<Period[]>(
    () => periodGroups.flatMap((g) => g.periods),
    [periodGroups],
  );

  const [matchedPeriodName, setMatchedPeriodName] = useState<string>('');

  // --- Dialog state ---
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showInvalidateDialog, setShowInvalidateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // --- Lines state ---
  const [lines, setLines] = useState<LineRow[]>([createEmptyLine(), createEmptyLine()]);

  // Sync lines from API data on load
  useEffect(() => {
    if (simulation?.lines && simulation.lines.length > 0) {
      setLines(
        lineRowsFromApi(
          simulation.lines.map((l) => ({
            accountCode: l.accountCode,
            accountName: l.accountName,
            description: l.description,
            debit: l.debit,
            credit: l.credit,
            vatCode: l.vatCode,
          })),
        ),
      );
    }
  }, [simulation?.lines]);

  // --- Derived state ---
  const isActive = simulation?.status === 'ACTIVE';
  const isTransferred = simulation?.status === 'TRANSFERRED';
  const isInvalid = simulation?.status === 'INVALID';
  const readOnly = !isNew && !isActive;

  // --- Form setup ---
  const form = useZodForm<SimulationHeaderValues>({
    schema: simulationHeaderSchema,
    defaultValues: {
      transactionDate: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
      periodId: '',
    },
    values: simulation
      ? {
          transactionDate: simulation.transactionDate.split('T')[0] ?? simulation.transactionDate,
          description: simulation.description,
          reference: simulation.reference ?? '',
          periodId: simulation.periodId,
        }
      : undefined,
  });

  // --- Auto-match period from transaction date ---
  const transactionDateValue = form.watch('transactionDate');

  useEffect(() => {
    if (!transactionDateValue || allPeriods.length === 0) return;

    const txDate = new Date(transactionDateValue);
    if (isNaN(txDate.getTime())) return;

    const matched = allPeriods.find((p) => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      return txDate >= start && txDate <= end;
    });

    if (matched) {
      form.setValue('periodId', matched.id, { shouldValidate: true });
      setMatchedPeriodName(matched.name);
    } else {
      form.setValue('periodId', '', { shouldValidate: true });
      setMatchedPeriodName('');
    }
  }, [transactionDateValue, allPeriods, form]);

  useEffect(() => {
    if (simulation?.periodId && allPeriods.length > 0 && !matchedPeriodName) {
      const found = allPeriods.find((p) => p.id === simulation.periodId);
      if (found) {
        setMatchedPeriodName(found.name);
      }
    }
  }, [simulation?.periodId, allPeriods, matchedPeriodName]);

  // --- Balance check ---
  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += line.debit;
      totalCredit += line.credit;
    }
    return {
      totalDebit,
      totalCredit,
      difference: Math.round((totalDebit - totalCredit) * 100) / 100,
    };
  }, [lines]);

  const isBalanced = totals.difference === 0 && lines.length >= 2;

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:finance'), path: '/finance' },
      { label: t('simulations.title'), path: '/finance/simulations' },
      {
        label: isNew
          ? t('simulations.new.title')
          : (simulation?.entryNumber ?? t('simulations.detail.title')),
      },
    ],
    [t, isNew, simulation?.entryNumber],
  );

  // --- Prepare lines for API ---
  const prepareLines = useCallback(() => {
    return lines
      .filter((l) => l.accountCode && (l.debit > 0 || l.credit > 0))
      .map(({ _key, ...rest }) => ({
        accountCode: rest.accountCode,
        description: rest.description || undefined,
        debit: rest.debit,
        credit: rest.credit,
        vatCode: rest.vatCode || undefined,
      }));
  }, [lines]);

  // --- Save handler ---
  const onSubmit = useCallback(
    async (values: SimulationHeaderValues) => {
      const apiLines = prepareLines();
      if (apiLines.length < 2) return;

      if (isNew) {
        try {
          const created = await createMutation.mutateAsync({
            transactionDate: values.transactionDate,
            description: values.description,
            reference: values.reference || undefined,
            periodId: values.periodId,
            lines: apiLines,
          });
          void navigate({
            to: `/finance/simulations/${created.id}` as string,
          });
        } catch {
          // Error toast handled by mutation
        }
      } else if (simulationId) {
        try {
          await updateMutation.mutateAsync({
            transactionDate: values.transactionDate,
            description: values.description,
            reference: values.reference || undefined,
            periodId: values.periodId,
            lines: apiLines,
          });
        } catch {
          // Error toast handled by mutation
        }
      }
    },
    [isNew, simulationId, prepareLines, createMutation, updateMutation, navigate],
  );

  // --- Convert handler ---
  const handleConvert = useCallback(async () => {
    try {
      const result = await convertMutation.mutateAsync();
      setShowConvertDialog(false);
      void navigate({
        to: `/finance/journals/${result.journalId}` as string,
      });
    } catch {
      // Error toast handled by mutation
    }
  }, [convertMutation, navigate]);

  // --- Invalidate handler ---
  const handleInvalidate = useCallback(async () => {
    try {
      await invalidateMutation.mutateAsync();
      setShowInvalidateDialog(false);
    } catch {
      // Error toast handled by mutation
    }
  }, [invalidateMutation]);

  // --- Delete handler ---
  const handleDelete = useCallback(async () => {
    if (!simulationId) return;
    try {
      await deleteMutation.mutateAsync(simulationId);
      setShowDeleteDialog(false);
      void navigate({ to: '/finance/simulations' as string });
    } catch {
      // Error toast handled by mutation
    }
  }, [simulationId, deleteMutation, navigate]);

  // --- Loading state ---
  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('simulations.detail.title')} breadcrumbs={breadcrumbs} isLoading />
        <Card className="max-w-4xl">
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error state ---
  if (!isNew && (isError || !simulation)) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('simulations.detail.title')} breadcrumbs={breadcrumbs} />
        <Card className="max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('simulations.error.loadFailed')}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Action bar ---
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const actionBarSlot = (
    <div className="flex items-center gap-2">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigate({ to: '/finance/simulations' as string })}
      >
        <ArrowLeft className="size-4" />
        {t('common:back')}
      </Button>

      {/* Save button (new or active) */}
      {(isNew || isActive) && (
        <Button onClick={form.handleSubmit(onSubmit)} disabled={isSaving} size="sm">
          {isSaving ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
          {isNew ? t('common:create') : t('common:save')}
        </Button>
      )}

      {/* Convert to Journal button (active only) */}
      {isActive && !isNew && (
        <Button
          onClick={() => setShowConvertDialog(true)}
          disabled={!isBalanced || convertMutation.isPending}
          size="sm"
          className="bg-green-600 text-white hover:bg-green-700"
        >
          {convertMutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <ArrowRightLeft className="size-4" />
          )}
          {t('simulations.action.convert')}
        </Button>
      )}

      {/* Overflow menu */}
      {!isNew && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isActive && (
              <DropdownMenuItem onSelect={() => setShowInvalidateDialog(true)}>
                <XCircle className="size-4" />
                {t('simulations.action.invalidate')}
              </DropdownMenuItem>
            )}
            {isTransferred && simulation?.transferredToId && (
              <DropdownMenuItem
                onSelect={() =>
                  void navigate({
                    to: `/finance/journals/${simulation.transferredToId}` as string,
                  })
                }
              >
                <ArrowRightLeft className="size-4" />
                {t('simulations.action.viewJournal')}
              </DropdownMenuItem>
            )}
            {(isActive || isInvalid) && (
              <DropdownMenuItem variant="destructive" onSelect={() => setShowDeleteDialog(true)}>
                <Trash2 className="size-4" />
                {t('common:delete')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  // --- Status badge ---
  const statusBadge = simulation ? (
    <Badge variant="outline" className={STATUS_STYLES[simulation.status].className}>
      {t(`simulations.status.${simulation.status.toLowerCase()}`)}
    </Badge>
  ) : undefined;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title={
          isNew
            ? t('simulations.new.title')
            : (simulation?.entryNumber ?? t('simulations.detail.title'))
        }
        breadcrumbs={breadcrumbs}
        statusBadge={statusBadge}
        actionBarSlot={actionBarSlot}
      />

      {/* Transferred notice */}
      {isTransferred && simulation?.transferredToId && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
          <ArrowRightLeft className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{t('simulations.notice.transferred')}</p>
        </div>
      )}

      {/* Invalid notice */}
      {isInvalid && (
        <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{t('simulations.notice.invalidated')}</p>
        </div>
      )}

      {/* Header form */}
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {t('simulations.section.header')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('simulations.field.transactionDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} readOnly={readOnly} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodId"
                render={() => (
                  <FormItem>
                    <FormLabel>{t('simulations.field.period')}</FormLabel>
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                      {matchedPeriodName || (
                        <span className="text-muted-foreground">
                          {t('simulations.field.periodPlaceholder')}
                        </span>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('simulations.field.description')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('simulations.field.descriptionPlaceholder')}
                        {...field}
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('simulations.field.reference')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('simulations.field.referencePlaceholder')}
                        {...field}
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card className="max-w-6xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {t('simulations.section.lines')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <JournalLineGrid lines={lines} onChange={setLines} readOnly={readOnly} />
        </CardContent>
      </Card>

      {/* Bottom save/cancel */}
      {(isNew || isActive) && (
        <div className="flex justify-end gap-2 max-w-6xl">
          <Button
            variant="outline"
            onClick={() => void navigate({ to: '/finance/simulations' as string })}
          >
            {t('common:cancel')}
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save className="size-4 mr-2" />}
            {isNew ? t('common:create') : t('common:save')}
          </Button>
        </div>
      )}

      {/* Convert confirmation dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('simulations.dialog.convert.title')}</DialogTitle>
            <DialogDescription>{t('simulations.dialog.convert.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConvertDialog(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={handleConvert}
              disabled={convertMutation.isPending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {convertMutation.isPending && <Loader2 className="animate-spin" />}
              <Check className="size-4" />
              {t('simulations.action.confirmConvert')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invalidate confirmation dialog */}
      <Dialog open={showInvalidateDialog} onOpenChange={setShowInvalidateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('simulations.dialog.invalidate.title')}</DialogTitle>
            <DialogDescription>{t('simulations.dialog.invalidate.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowInvalidateDialog(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleInvalidate}
              disabled={invalidateMutation.isPending}
            >
              {invalidateMutation.isPending && <Loader2 className="animate-spin" />}
              <XCircle className="size-4" />
              {t('simulations.action.confirmInvalidate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('simulations.dialog.delete.title')}</DialogTitle>
            <DialogDescription>{t('simulations.dialog.delete.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="animate-spin" />}
              <Trash2 className="size-4" />
              {t('simulations.action.confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
