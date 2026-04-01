/* eslint-disable i18next/no-literal-string */
/**
 * FE7: Bank Account List Page — /finance/bank-accounts
 *
 * Uses T1 (EntityListPage) template with search and cursor-based pagination.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { EntityListPage } from '@/components/templates/entity-list-page';

import { useBankAccounts } from '../hooks/use-bank-accounts';
import { ExportButtons } from '../components/ExportButtons';
import type { BankAccount } from '../types';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(value);
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  CLOSED: 'destructive',
};

export function BankAccountListPage() {
  const navigate = useNavigate();

  // --- Search state with debounce ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // --- Data fetching ---
  const queryParams = useMemo(() => {
    const params: Record<string, string | boolean> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [debouncedSearch]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useBankAccounts(queryParams);

  const bankAccounts = data?.data ?? [];

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<BankAccount>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Account Name',
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'bankName',
        header: 'Bank',
      },
      {
        accessorKey: 'accountNumber',
        header: 'Account Number',
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'sortCode',
        header: 'Sort Code',
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'currencyCode',
        header: 'Currency',
        cell: ({ getValue }) => <span className="text-xs">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'currentBalance',
        header: 'Balance',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums font-medium">
            {formatCurrency(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<string>();
          return <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>{status}</Badge>;
        },
      },
      {
        accessorKey: 'glAccountCode',
        header: 'GL Account',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.glAccountCode} — {row.original.glAccountName}
          </span>
        ),
      },
    ],
    [],
  );

  const filterSlot = (
    <div className="flex items-center justify-end">
      <ExportButtons
        exportPath="/finance/bank-accounts/export"
        variant="icon"
        label="Export bank accounts"
      />
    </div>
  );

  return (
    <EntityListPage<BankAccount>
      title="Bank Accounts"
      subtitle="Manage company bank accounts and their GL mappings"
      breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'Bank Accounts' }]}
      entityType="bankAccount"
      columns={columns}
      data={bankAccounts}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search bank accounts..."
      filterSlot={filterSlot}
      hasMore={hasNextPage ?? false}
      onLoadMore={() => void fetchNextPage()}
      isLoadingMore={isFetchingNextPage}
      canCreate
      onCreateNew={() => void navigate({ to: '/finance/bank-accounts/new' })}
      onRowClick={(row) =>
        void navigate({ to: '/finance/bank-accounts/$id', params: { id: row.id } })
      }
      getRowId={(row) => row.id}
    />
  );
}
