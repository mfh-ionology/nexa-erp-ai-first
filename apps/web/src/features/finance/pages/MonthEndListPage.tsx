/* eslint-disable i18next/no-literal-string */
/**
 * FE15: Month-End Periods List Page — /finance/month-end
 *
 * Uses T1 (EntityListPage) template. Lists month-end periods with status.
 */

import { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';

import { EntityListPage } from '@/components/templates/entity-list-page';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { useMonthEndPeriods } from '../hooks/use-month-end';
import type { MonthEndPeriod } from '../types';

const STATUS_COLORS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  OPEN: { label: 'Open', variant: 'secondary' },
  CLOSING: { label: 'Closing', variant: 'outline' },
  CLOSED: { label: 'Closed', variant: 'default' },
};

export function MonthEndListPage() {
  const navigate = useNavigate();
  const { periods, isLoading } = useMonthEndPeriods();

  const handleRowClick = useCallback(
    (row: MonthEndPeriod) => {
      void navigate({
        to: '/finance/month-end/$periodId' as string,
        params: { periodId: row.id } as Record<string, string>,
      });
    },
    [navigate],
  );

  const columns = useMemo<ColumnDef<MonthEndPeriod>[]>(
    () => [
      {
        accessorKey: 'periodLabel',
        header: 'Period',
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'fiscalYear',
        header: 'Fiscal Year',
      },
      {
        accessorKey: 'period',
        header: 'Period #',
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
        accessorKey: 'progress',
        header: 'Progress',
        cell: ({ getValue }) => {
          const progress = getValue<number>();
          return (
            <div className="flex items-center gap-2 min-w-[120px]">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'closedAt',
        header: 'Closed',
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return val
            ? new Date(val).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '—';
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage<MonthEndPeriod>
      title="Month-End Close"
      subtitle="Manage monthly closing checklist"
      breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'Month-End' }]}
      entityType="month-end"
      columns={columns}
      data={periods}
      isLoading={isLoading}
      onRowClick={handleRowClick}
      getRowId={(row) => row.id}
    />
  );
}
