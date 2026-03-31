/* eslint-disable i18next/no-literal-string */
/**
 * Journal Entry List Page — T1 Entity List.
 *
 * Displays journal entries from GET /finance/journals
 * with status filter tabs, date range, text search, and cursor-based pagination.
 * Row click navigates to journal detail/edit page.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { EntityListPage } from '@/components/templates/entity-list-page';

import { useI18n, useFormatDate, useLocale } from '@nexa/i18n';

import { useJournals } from '../hooks/use-journals';
import type { JournalListItem, JournalStatus, JournalSource } from '../api/journals-types';
import { JOURNAL_STATUSES } from '../api/journals-types';

// ---------------------------------------------------------------------------
// Status badge configuration
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

function StatusBadge({ status }: { status: JournalStatus }) {
  const { t } = useI18n();
  const style = STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={style.className}>
      {t(`journals.status.${status.toLowerCase()}`)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Currency formatter
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// JournalListPage component
// ---------------------------------------------------------------------------

export function JournalListPage() {
  const { t } = useI18n();
  const formatDate = useFormatDate();
  const locale = useLocale();
  const navigate = useNavigate();

  // --- Filter state ---
  const [statusFilter, setStatusFilter] = useState<JournalStatus | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // --- Data fetching ---
  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (statusFilter) params.status = statusFilter;
    return params;
  }, [statusFilter]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useJournals(queryParams);

  // --- Client-side text filter (search applies to already-fetched data) ---
  const filteredData = useMemo(() => {
    const journals = data?.data ?? [];
    if (!debouncedSearch) return journals;
    const q = debouncedSearch.toLowerCase();
    return journals.filter(
      (j) =>
        j.entryNumber.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        (j.reference?.toLowerCase().includes(q) ?? false),
    );
  }, [data?.data, debouncedSearch]);

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<JournalListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'entryNumber',
        header: t('journals.column.entryNumber'),
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm font-semibold text-[#7c3aed]">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'transactionDate',
        header: t('journals.column.date'),
        enableSorting: true,
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        accessorKey: 'description',
        header: t('journals.column.description'),
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="max-w-xs truncate text-sm">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'source',
        header: t('journals.column.source'),
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'totalDebit',
        header: t('journals.column.debit'),
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(getValue<number>(), locale)}
          </span>
        ),
      },
      {
        accessorKey: 'totalCredit',
        header: t('journals.column.credit'),
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(getValue<number>(), locale)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('journals.column.status'),
        cell: ({ getValue }) => <StatusBadge status={getValue<JournalStatus>()} />,
      },
    ],
    [t, formatDate, locale],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [{ label: t('navigation:finance'), path: '/finance' }, { label: t('journals.title') }],
    [t],
  );

  // --- Filter slot: status tabs ---
  const filterSlot = (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      <button
        onClick={() => setStatusFilter(undefined)}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          !statusFilter
            ? 'bg-[#7c3aed] text-white shadow-sm'
            : 'text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground'
        }`}
      >
        {t('journals.filter.all')}
      </button>
      {JOURNAL_STATUSES.map((status) => (
        <button
          key={status}
          onClick={() => setStatusFilter(status)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            statusFilter === status
              ? 'bg-[#7c3aed] text-white shadow-sm'
              : 'text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground'
          }`}
        >
          {t(`journals.status.${status.toLowerCase()}`)}
        </button>
      ))}
    </div>
  );

  return (
    <EntityListPage<JournalListItem>
      title={t('journals.title')}
      breadcrumbs={breadcrumbs}
      entityType="journal-entry"
      columns={columns}
      data={filteredData}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('journals.searchPlaceholder')}
      filterSlot={filterSlot}
      canCreate={true}
      onCreateNew={() => void navigate({ to: '/finance/journals/new' as string })}
      onRowClick={(row) => void navigate({ to: `/finance/journals/${row.id}` as string })}
      hasMore={hasNextPage}
      onLoadMore={fetchNextPage}
      isLoadingMore={isFetchingNextPage}
      getRowId={(row) => row.id}
      batchActions={[]}
    />
  );
}
