/* eslint-disable i18next/no-literal-string */
/**
 * DimensionTypeList — T2 list page for dimension types.
 *
 * Displays dimension types in a sortable table.
 * Row click navigates to the values page for that type.
 * Row actions: Edit (dialog), Activate/Deactivate toggle.
 */

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { EntityListPage } from '@/components/templates/entity-list-page';

import { useI18n } from '@nexa/i18n';

import { useDimensionTypes } from './api';
import type { DimensionType } from './api';
import { DimensionTypeDialog } from './DimensionTypeDialog';

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? 'border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300'
          : 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
      }
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        value
          ? 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
          : 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
      }
    >
      {value ? 'Yes' : 'No'}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionTypeList() {
  const { t } = useI18n('finance');
  const navigate = useNavigate();
  const { data: types, isLoading } = useDimensionTypes();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<DimensionType | null>(null);

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<DimensionType, unknown>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('dimensions.column.code'),
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm font-semibold text-[#7c3aed]">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: t('dimensions.column.name'),
        enableSorting: true,
      },
      {
        accessorKey: 'singleSelect',
        header: t('dimensions.column.singleSelect'),
        cell: ({ getValue }) => <YesNoBadge value={getValue<boolean>()} />,
      },
      {
        accessorKey: 'allowManualEntry',
        header: t('dimensions.column.allowManualEntry'),
        cell: ({ getValue }) => <YesNoBadge value={getValue<boolean>()} />,
      },
      {
        accessorKey: 'sortOrder',
        header: t('dimensions.column.sortOrder'),
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('dimensions.column.active'),
        cell: ({ getValue }) => <ActiveBadge active={getValue<boolean>()} />,
      },
      {
        accessorKey: 'valuesCount',
        header: t('dimensions.column.valuesCount'),
        cell: ({ getValue }) => (
          <span className="font-mono text-sm tabular-nums">{getValue<number>()}</span>
        ),
      },
    ],
    [t],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [{ label: t('navigation:finance'), path: '/finance' }, { label: t('dimensions.title') }],
    [t],
  );

  const handleCreateNew = () => {
    setEditingType(null);
    setDialogOpen(true);
  };

  return (
    <>
      <EntityListPage<DimensionType>
        title={t('dimensions.title')}
        breadcrumbs={breadcrumbs}
        entityType="dimension-type"
        columns={columns}
        data={types ?? []}
        isLoading={isLoading}
        canCreate={true}
        onCreateNew={handleCreateNew}
        onRowClick={(row) =>
          void navigate({
            to: `/finance/dimensions/${row.id}/values` as string,
          })
        }
        getRowId={(row) => row.id}
        batchActions={[]}
        overflowActions={[]}
      />

      <DimensionTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dimensionType={editingType}
      />
    </>
  );
}
