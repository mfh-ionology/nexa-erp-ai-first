/* eslint-disable i18next/no-literal-string */
/**
 * DimensionDefaultList — T2 list page for dimension defaults.
 *
 * Allows setting default dimension values for entities
 * (accounts, customers, suppliers, items, company-wide).
 */

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EntityListPage } from '@/components/templates/entity-list-page';

import { useI18n } from '@nexa/i18n';

import { useDimensionTypes, useDimensionDefaults } from './api';
import type { DimensionDefault, DimensionDefaultEntityType } from './api';
import { DimensionDefaultDialog } from './DimensionDefaultDialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_TYPES: DimensionDefaultEntityType[] = [
  'ACCOUNT',
  'CUSTOMER',
  'SUPPLIER',
  'ITEM',
  'COMPANY',
];

const ENTITY_TYPE_COLORS: Record<DimensionDefaultEntityType, string> = {
  ACCOUNT:
    'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  CUSTOMER:
    'border-green-300 bg-green-100 text-green-800 dark:border-green-700 dark:bg-green-900/50 dark:text-green-300',
  SUPPLIER:
    'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  ITEM: 'border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  COMPANY:
    'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionDefaultList() {
  const { t } = useI18n('finance');
  const { data: dimensionTypes } = useDimensionTypes({ isActive: true });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [dimensionTypeFilter, setDimensionTypeFilter] = useState<string>('');

  const filterParams = useMemo(() => {
    const params: { entityType?: string; dimensionTypeId?: string } = {};
    if (entityTypeFilter) params.entityType = entityTypeFilter;
    if (dimensionTypeFilter) params.dimensionTypeId = dimensionTypeFilter;
    return params;
  }, [entityTypeFilter, dimensionTypeFilter]);

  const { data: defaults, isLoading } = useDimensionDefaults(filterParams);

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<DimensionDefault, unknown>[]>(
    () => [
      {
        accessorFn: (row) => row.dimensionType?.name ?? row.dimensionTypeId,
        id: 'dimensionTypeName',
        header: t('dimensions.defaults.column.dimensionType'),
        cell: ({ getValue }) => <span className="text-sm font-medium">{getValue<string>()}</span>,
      },
      {
        id: 'dimensionValue',
        header: t('dimensions.defaults.column.dimensionValue'),
        cell: ({ row }) => {
          const val = row.original.dimensionValue;
          return val ? (
            <span className="text-sm">
              <span className="font-mono text-xs text-muted-foreground">{val.code}</span>
              <span className="ml-1.5">{val.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{'\u2014'}</span>
          );
        },
      },
      {
        accessorKey: 'entityType',
        header: t('dimensions.defaults.column.entityType'),
        cell: ({ getValue }) => {
          const entityType = getValue<DimensionDefaultEntityType>();
          return (
            <Badge variant="outline" className={ENTITY_TYPE_COLORS[entityType]}>
              {entityType}
            </Badge>
          );
        },
      },
      {
        id: 'entity',
        header: t('dimensions.defaults.column.entity'),
        cell: ({ row }) => {
          if (row.original.entityType === 'COMPANY' && !row.original.entityId) {
            return (
              <span className="text-sm italic text-muted-foreground">
                {t('dimensions.defaults.companyWideDefault')}
              </span>
            );
          }
          return (
            <span className="text-sm text-muted-foreground">
              {row.original.entityId ?? '\u2014'}
            </span>
          );
        },
      },
    ],
    [t],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:finance'), path: '/finance' },
      { label: t('dimensions.title'), path: '/finance/dimensions' },
      { label: t('dimensions.defaults.title') },
    ],
    [t],
  );

  // --- Filter slot ---
  const filterSlot = (
    <div className="flex items-center gap-3">
      <Select
        value={entityTypeFilter || '_all_'}
        onValueChange={(val) => setEntityTypeFilter(val === '_all_' ? '' : val)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t('dimensions.defaults.filter.entityType')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all_">{t('dimensions.defaults.filter.allEntityTypes')}</SelectItem>
          {ENTITY_TYPES.map((et) => (
            <SelectItem key={et} value={et}>
              {et}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={dimensionTypeFilter || '_all_'}
        onValueChange={(val) => setDimensionTypeFilter(val === '_all_' ? '' : val)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder={t('dimensions.defaults.filter.dimensionType')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all_">{t('dimensions.defaults.filter.allDimensionTypes')}</SelectItem>
          {(dimensionTypes ?? []).map((dt) => (
            <SelectItem key={dt.id} value={dt.id}>
              {dt.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <EntityListPage<DimensionDefault>
        title={t('dimensions.defaults.title')}
        breadcrumbs={breadcrumbs}
        entityType="dimension-default"
        columns={columns}
        data={defaults ?? []}
        isLoading={isLoading}
        canCreate={true}
        onCreateNew={() => setDialogOpen(true)}
        getRowId={(row) => row.id}
        filterSlot={filterSlot}
        batchActions={[]}
        overflowActions={[]}
      />

      <DimensionDefaultDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
