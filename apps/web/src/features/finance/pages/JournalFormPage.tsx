/* eslint-disable i18next/no-literal-string */
/**
 * Journal Entry Form Page — T3 Header + Lines Page.
 *
 * Used for both creating new journals (/finance/journals/new)
 * and viewing/editing existing ones (/finance/journals/:id).
 *
 * Features:
 * - Header fields: date, description, reference, period
 * - JournalLineGrid for editable lines
 * - Post button (DRAFT only, with balance validation)
 * - Reverse button (POSTED only, with confirmation dialog)
 * - Status badge in header
 * - Read-only mode for POSTED and REVERSED entries
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { ArrowLeft, Check, Loader2, MoreHorizontal, RotateCcw, Save, Send } from 'lucide-react';

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
  useJournal,
  useCreateJournal,
  useUpdateJournal,
  usePostJournal,
  useReverseJournal,
} from '../hooks/use-journals';
import type { JournalStatus } from '../api/journals-types';
import { JournalLineGrid, createEmptyLine, lineRowsFromApi } from '../components/JournalLineGrid';
import type { LineRow } from '../components/JournalLineGrid';

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<JournalStatus, { className: string }> = {
  DRAFT: {
    className:
      'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300',
  },
  POSTED: {
    className:
      'border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  REVERSED: {
    className:
      'border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
};

// ---------------------------------------------------------------------------
// Form schema (header only — lines managed separately)
// ---------------------------------------------------------------------------

const journalHeaderSchema = z.object({
  transactionDate: z.string().min(1, 'journals.validation.dateRequired'),
  description: z
    .string()
    .min(1, 'journals.validation.descriptionRequired')
    .max(500, 'journals.validation.descriptionMaxLength'),
  reference: z.string().max(100).optional(),
  periodId: z.string().min(1, 'journals.validation.periodRequired'),
});

type JournalHeaderValues = z.infer<typeof journalHeaderSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface JournalFormPageProps {
  /** Journal ID for edit mode. Undefined for new journal. */
  id?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JournalFormPage({ id }: JournalFormPageProps) {
  const { t } = useI18n('finance');
  const navigate = useNavigate();
  const isNew = !id;

  // --- Data fetching (edit mode) ---
  const { data: journal, isLoading, isError } = useJournal(id);

  // --- Mutations ---
  const createMutation = useCreateJournal();
  const updateMutation = useUpdateJournal(id ?? '');
  const postMutation = usePostJournal(id ?? '');
  const reverseMutation = useReverseJournal(id ?? '');

  // --- Dialog state ---
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [showPostDialog, setShowPostDialog] = useState(false);

  // --- Lines state (managed outside react-hook-form) ---
  const [lines, setLines] = useState<LineRow[]>([createEmptyLine(), createEmptyLine()]);

  // Sync lines from API data on load
  useEffect(() => {
    if (journal?.lines && journal.lines.length > 0) {
      setLines(lineRowsFromApi(journal.lines));
    }
  }, [journal?.lines]);

  // --- Derived state ---
  const isDraft = journal?.status === 'DRAFT';
  const isPosted = journal?.status === 'POSTED';
  const isReversed = journal?.status === 'REVERSED';
  const readOnly = !isNew && !isDraft;

  // --- Form setup ---
  const form = useZodForm<JournalHeaderValues>({
    schema: journalHeaderSchema,
    defaultValues: {
      transactionDate: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
      periodId: '',
    },
    values: journal
      ? {
          transactionDate: journal.transactionDate.split('T')[0] ?? journal.transactionDate,
          description: journal.description,
          reference: journal.reference ?? '',
          periodId: journal.periodId,
        }
      : undefined,
  });

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
  const hasValidLines = lines.every((l) => l.accountCode && (l.debit > 0 || l.credit > 0));

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:finance'), path: '/finance' },
      { label: t('journals.title'), path: '/finance/journals' },
      {
        label: isNew
          ? t('journals.new.title')
          : (journal?.entryNumber ?? t('journals.detail.title')),
      },
    ],
    [t, isNew, journal?.entryNumber],
  );

  // --- Prepare lines for API submission ---
  const prepareLines = useCallback(() => {
    return lines
      .filter((l) => l.accountCode && (l.debit > 0 || l.credit > 0))
      .map(({ _key, ...rest }) => ({
        ...rest,
        description: rest.description || undefined,
        vatCode: rest.vatCode || undefined,
      }));
  }, [lines]);

  // --- Save handler (create or update) ---
  const onSubmit = useCallback(
    async (values: JournalHeaderValues) => {
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
            to: `/finance/journals/${created.id}` as string,
          });
        } catch {
          // Error toast handled by mutation
        }
      } else if (id) {
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
    [isNew, id, prepareLines, createMutation, updateMutation, navigate],
  );

  // --- Post handler ---
  const handlePost = useCallback(async () => {
    try {
      await postMutation.mutateAsync();
      setShowPostDialog(false);
    } catch {
      // Error toast handled by mutation
    }
  }, [postMutation]);

  // --- Reverse handler ---
  const handleReverse = useCallback(async () => {
    try {
      await reverseMutation.mutateAsync();
      setShowReverseDialog(false);
    } catch {
      // Error toast handled by mutation
    }
  }, [reverseMutation]);

  // --- Loading state ---
  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('journals.detail.title')} breadcrumbs={breadcrumbs} isLoading />
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
  if (!isNew && (isError || !journal)) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('journals.detail.title')} breadcrumbs={breadcrumbs} />
        <Card className="max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('journals.error.loadFailed')}
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
        onClick={() => void navigate({ to: '/finance/journals' as string })}
      >
        <ArrowLeft className="size-4" />
        {t('common:back')}
      </Button>

      {/* Save button (new or draft) */}
      {(isNew || isDraft) && (
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={isSaving || !isBalanced || !hasValidLines}
          size="sm"
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
          {isNew ? t('common:create') : t('common:save')}
        </Button>
      )}

      {/* Post button (draft only) */}
      {isDraft && !isNew && (
        <Button
          onClick={() => setShowPostDialog(true)}
          disabled={!isBalanced || postMutation.isPending}
          size="sm"
          className="bg-green-600 text-white hover:bg-green-700"
        >
          {postMutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {t('journals.action.post')}
        </Button>
      )}

      {/* Overflow menu for posted entries */}
      {isPosted && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('actionBar.moreActions')}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => setShowReverseDialog(true)}>
              <RotateCcw className="size-4" />
              {t('journals.action.reverse')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  // --- Status badge ---
  const statusBadge = journal ? (
    <Badge variant="outline" className={STATUS_STYLES[journal.status].className}>
      {t(`journals.status.${journal.status.toLowerCase()}`)}
    </Badge>
  ) : undefined;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title={
          isNew ? t('journals.new.title') : (journal?.entryNumber ?? t('journals.detail.title'))
        }
        breadcrumbs={breadcrumbs}
        statusBadge={statusBadge}
        actionBarSlot={actionBarSlot}
      />

      {/* Reversal notice */}
      {isReversed && journal?.reversalOfId && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          <RotateCcw className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{t('journals.notice.reversed')}</p>
        </div>
      )}

      {/* Header form */}
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t('journals.section.header')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {/* Transaction Date */}
              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('journals.field.transactionDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} readOnly={readOnly} disabled={readOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Period */}
              <FormField
                control={form.control}
                name="periodId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('journals.field.period')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('journals.field.periodPlaceholder')}
                        {...field}
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('journals.field.description')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('journals.field.descriptionPlaceholder')}
                        {...field}
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reference */}
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('journals.field.reference')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('journals.field.referencePlaceholder')}
                        {...field}
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Screen reader error announcements */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {form.formState.errors.transactionDate?.message}
                {form.formState.errors.description?.message}
                {form.formState.errors.periodId?.message}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Journal Lines */}
      <Card className="max-w-6xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t('journals.section.lines')}</CardTitle>
        </CardHeader>
        <CardContent>
          <JournalLineGrid lines={lines} onChange={setLines} readOnly={readOnly} />
        </CardContent>
      </Card>

      {/* Post confirmation dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('journals.dialog.post.title')}</DialogTitle>
            <DialogDescription>{t('journals.dialog.post.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPostDialog(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={handlePost}
              disabled={postMutation.isPending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {postMutation.isPending && <Loader2 className="animate-spin" />}
              <Check className="size-4" />
              {t('journals.action.confirmPost')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse confirmation dialog */}
      <Dialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('journals.dialog.reverse.title')}</DialogTitle>
            <DialogDescription>
              {t('journals.dialog.reverse.description', {
                entryNumber: journal?.entryNumber ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReverseDialog(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReverse}
              disabled={reverseMutation.isPending}
            >
              {reverseMutation.isPending && <Loader2 className="animate-spin" />}
              <RotateCcw className="size-4" />
              {t('journals.action.confirmReverse')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
