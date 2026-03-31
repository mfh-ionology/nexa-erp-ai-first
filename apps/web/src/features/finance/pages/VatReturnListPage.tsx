/* eslint-disable i18next/no-literal-string */
/**
 * FE9: VAT Returns List Page — /finance/vat-returns
 *
 * Uses T1 (EntityListPage) template. Lists VAT returns with status badge.
 */

import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';

import { EntityListPage } from '@/components/templates/entity-list-page';
import { Badge } from '@/components/ui/badge';

import { useVatReturns, useCreateVatReturn } from '../hooks/use-vat-returns';
import type { VatReturn, VatReturnListParams, VAT_RETURN_STATUS_CONFIG } from '../types';

const STATUS_COLORS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  CALCULATED: { label: 'Calculated', variant: 'outline' },
  SUBMITTED: { label: 'Submitted', variant: 'default' },
  ACCEPTED: { label: 'Accepted', variant: 'default' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(num);
}

export function VatReturnListPage() {
  const navigate = useNavigate();
  const [params] = useState<VatReturnListParams>({});
  const { vatReturns, isLoading } = useVatReturns(params);
  const createMutation = useCreateVatReturn();

  const handleCreateNew = useCallback(() => {
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
    createMutation.mutate(
      {
        periodStart: quarterStart.toISOString().split('T')[0],
        periodEnd: quarterEnd.toISOString().split('T')[0],
      },
      {
        onSuccess: (data) => {
          void navigate({ to: '/finance/vat-returns/$id', params: { id: data.id } });
        },
      },
    );
  }, [createMutation, navigate]);

  const handleRowClick = useCallback(
    (row: VatReturn) => {
      void navigate({ to: '/finance/vat-returns/$id', params: { id: row.id } });
    },
    [navigate],
  );

  const columns = useMemo<ColumnDef<VatReturn>[]>(
    () => [
      {
        accessorKey: 'periodStart',
        header: 'Period Start',
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        accessorKey: 'periodEnd',
        header: 'Period End',
        cell: ({ getValue }) => formatDate(getValue<string>()),
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
        accessorKey: 'box5',
        header: 'Net VAT',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatCurrency(getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: 'submittedAt',
        header: 'Submitted',
        cell: ({ getValue }) => {
          const val = getValue<string | null>();
          return val ? formatDate(val) : '—';
        },
      },
    ],
    [],
  );

  return (
    <EntityListPage<VatReturn>
      title="VAT Returns"
      subtitle="HMRC MTD VAT return submissions"
      breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'VAT Returns' }]}
      entityType="vat-return"
      columns={columns}
      data={vatReturns}
      isLoading={isLoading}
      canCreate
      onCreateNew={handleCreateNew}
      onRowClick={handleRowClick}
      getRowId={(row) => row.id}
    />
  );
}
