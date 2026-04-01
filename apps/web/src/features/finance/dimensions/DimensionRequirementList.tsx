/* eslint-disable i18next/no-literal-string */
/**
 * DimensionRequirementList — T2 list page for dimension requirements.
 *
 * Shows rules defining which dimension types are required/optional
 * for specific account code ranges.
 */

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { EntityListPage } from '@/components/templates/entity-list-page';

import { useI18n } from '@nexa/i18n';

import { useDimensionRequirements } from './api';
import type { DimensionRequirement } from './api';
import { DimensionRequirementDialog } from './DimensionRequirementDialog';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionRequirementList() {
  const { t } = useI18n('finance');
  const { data: requirements, isLoading } = useDimensionRequirements();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<DimensionRequirement | null>(null);

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<DimensionRequirement, unknown>[]>(
    () => [
      {
        accessorFn: (row) => row.dimensionType?.name ?? row.dimensionTypeId,
        id: 'dimensionTypeName',
        header: t('dimensions.requirements.column.dimensionType'),
        cell: ({ getValue }) => <span className="text-sm font-medium">{getValue<string>()}</span>,
      },
      {
        id: 'accountRange',
        header: t('dimensions.requirements.column.accountRange'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.accountCodeFrom} &mdash; {row.original.accountCodeTo}
          </span>
        ),
      },
      {
        accessorKey: 'isRequired',
        header: t('dimensions.requirements.column.required'),
        cell: ({ getValue }) => (
          <Badge
            variant="outline"
            className={
              getValue<boolean>()
                ? 'border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                : 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }
          >
            {getValue<boolean>() ? 'Required' : 'Optional'}
          </Badge>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('dimensions.column.active'),
        cell: ({ getValue }) => (
          <Badge
            variant="outline"
            className={
              getValue<boolean>()
                ? 'border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300'
                : 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }
          >
            {getValue<boolean>() ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [t],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:finance'), path: '/finance' },
      { label: t('dimensions.title'), path: '/finance/dimensions' },
      { label: t('dimensions.requirements.title') },
    ],
    [t],
  );

  const handleCreateNew = () => {
    setEditingRequirement(null);
    setDialogOpen(true);
  };

  const handleEdit = (req: DimensionRequirement) => {
    setEditingRequirement(req);
    setDialogOpen(true);
  };

  return (
    <>
      <EntityListPage<DimensionRequirement>
        title={t('dimensions.requirements.title')}
        breadcrumbs={breadcrumbs}
        entityType="dimension-requirement"
        columns={columns}
        data={requirements ?? []}
        isLoading={isLoading}
        canCreate={true}
        onCreateNew={handleCreateNew}
        getRowId={(row) => row.id}
        batchActions={[]}
        onRowClick={(row) => handleEdit(row)}
        overflowActions={[]}
      />

      <DimensionRequirementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requirement={editingRequirement}
      />
    </>
  );
}
