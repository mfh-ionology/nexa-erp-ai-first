/* eslint-disable i18next/no-literal-string */
/**
 * SimulationList — T2 list page for simulations.
 *
 * Displays simulations with status filter tabs (Active, Transferred, Invalid).
 * Mirrors the JournalListPage pattern.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { EntityListPage } from '@/components/templates/entity-list-page';

import { useI18n, useFormatDate, useLocale } from '@nexa/i18n';

import { useSimulations } from './api';
import type { SimulationListItem, SimulationStatus } from './api';
import { SIMULATION_STATUSES } from './api';

// ---------------------------------------------------------------------------
// Status badge configuration
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

function StatusBadge({ status }: { status: SimulationStatus }) {
  const { t } = useI18n('finance');
  const style = STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={style.className}>
      {t(`simulations.status.${status.toLowerCase()}`)}
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
// Component
// ---------------------------------------------------------------------------

export function SimulationList() {
  const { t } = useI18n('finance');
  const formatDate = useFormatDate();
  const locale = useLocale();
  const navigate = useNavigate();

  // --- Filter state ---
  const [statusFilter, setStatusFilter] = useState<SimulationStatus | undefined>(undefined);
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
    useSimulations(queryParams);

  // --- Client-side text filter ---
  const filteredData = useMemo(() => {
    const simulations = data?.data ?? [];
    if (!debouncedSearch) return simulations;
    const q = debouncedSearch.toLowerCase();
    return simulations.filter(
      (s) =>
        s.entryNumber.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.reference?.toLowerCase().includes(q) ?? false),
    );
  }, [data?.data, debouncedSearch]);

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<SimulationListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'entryNumber',
        header: t('simulations.column.entryNumber'),
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm font-semibold text-[#7c3aed]">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'transactionDate',
        header: t('simulations.column.date'),
        enableSorting: true,
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        accessorKey: 'description',
        header: t('simulations.column.description'),
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="max-w-xs truncate text-sm">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'reference',
        header: t('simulations.column.reference'),
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">{getValue<string>() ?? '\u2014'}</span>
        ),
      },
      {
        accessorKey: 'totalDebit',
        header: t('simulations.column.debit'),
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(getValue<number>(), locale)}
          </span>
        ),
      },
      {
        accessorKey: 'totalCredit',
        header: t('simulations.column.credit'),
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(getValue<number>(), locale)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('simulations.column.status'),
        cell: ({ getValue }) => <StatusBadge status={getValue<SimulationStatus>()} />,
      },
    ],
    [t, formatDate, locale],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [{ label: t('navigation:finance'), path: '/finance' }, { label: t('simulations.title') }],
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
        {t('simulations.filter.all')}
      </button>
      {SIMULATION_STATUSES.map((status) => (
        <button
          key={status}
          onClick={() => setStatusFilter(status)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            statusFilter === status
              ? 'bg-[#7c3aed] text-white shadow-sm'
              : 'text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground'
          }`}
        >
          {t(`simulations.status.${status.toLowerCase()}`)}
        </button>
      ))}
    </div>
  );

  return (
    <EntityListPage<SimulationListItem>
      title={t('simulations.title')}
      breadcrumbs={breadcrumbs}
      entityType="simulation"
      columns={columns}
      data={filteredData}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('simulations.searchPlaceholder')}
      filterSlot={filterSlot}
      canCreate={true}
      onCreateNew={() => void navigate({ to: '/finance/simulations/new' as string })}
      onRowClick={(row) => void navigate({ to: `/finance/simulations/${row.id}` as string })}
      hasMore={hasNextPage}
      onLoadMore={fetchNextPage}
      isLoadingMore={isFetchingNextPage}
      getRowId={(row) => row.id}
      batchActions={[]}
    />
  );
}
