/* eslint-disable i18next/no-literal-string */
/**
 * FE10: Budget List Page — /finance/budgets
 *
 * Uses T1 (EntityListPage) template. Lists budgets with fiscal year/status filter.
 */

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';

import { EntityListPage } from '@/components/templates/entity-list-page';
import { Badge } from '@/components/ui/badge';

import { useBudgets, useCreateBudget } from '../hooks/use-budgets';
import { ExportButtons } from '../components/ExportButtons';
import type { Budget, BudgetListParams } from '../types';

const STATUS_COLORS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  APPROVED: { label: 'Approved', variant: 'default' },
  CLOSED: { label: 'Closed', variant: 'outline' },
};

export function BudgetListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [params] = useState<BudgetListParams>({});
  const { budgets, isLoading } = useBudgets({ ...params, search: search || undefined });
  const createMutation = useCreateBudget();

  const handleCreateNew = useCallback(() => {
    const currentYear = new Date().getFullYear();
    createMutation.mutate(
      { name: `Budget ${currentYear}`, fiscalYear: currentYear },
      {
        onSuccess: (data) => {
          void navigate({ to: '/finance/budgets/$id', params: { id: data.id } });
        },
      },
    );
  }, [createMutation, navigate]);

  const handleRowClick = useCallback(
    (row: Budget) => {
      void navigate({ to: '/finance/budgets/$id', params: { id: row.id } });
    },
    [navigate],
  );

  const columns = useMemo<ColumnDef<Budget>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Budget Name',
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'fiscalYear',
        header: 'Fiscal Year',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<string>();
          const config = STATUS_COLORS[status] ?? { label: status, variant: 'secondary' as const };
          return <Badge variant={config.variant}>{config.label}</Badge>;
        },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return <span className="text-muted-foreground">{val ?? '—'}</span>;
        },
      },
      {
        id: 'lineCount',
        header: 'Accounts',
        cell: ({ row }) => row.original.lines?.length ?? 0,
      },
    ],
    [],
  );

  const filterSlot = (
    <div className="flex items-center justify-end">
      <ExportButtons exportPath="/finance/budgets/export" variant="icon" label="Export budgets" />
    </div>
  );

  return (
    <EntityListPage<Budget>
      title="Budgets"
      subtitle="Create and manage financial budgets"
      breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'Budgets' }]}
      entityType="budget"
      columns={columns}
      data={budgets}
      isLoading={isLoading}
      canCreate
      onCreateNew={handleCreateNew}
      onRowClick={handleRowClick}
      getRowId={(row) => row.id}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search budgets..."
      filterSlot={filterSlot}
    />
  );
}
