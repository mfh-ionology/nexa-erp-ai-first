/**
 * Resource Registry Page — T1 Entity List (read-only).
 *
 * Displays all system resources from GET /system/resources
 * with module/type filter dropdowns and text search.
 * No CRUD operations — resources are system-managed.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { EntityListPage } from '@/components/templates/entity-list-page';

import { useI18n } from '@nexa/i18n';

import type { Resource } from './api/use-resources';
import { useResourcesInfinite } from './api/use-resources';
import { ResourceFilters } from './components/resource-filters';

/** Map ResourceType enum to i18n key */
const TYPE_I18N: Record<Resource['type'], string> = {
  PAGE: 'resources.type.page',
  REPORT: 'resources.type.report',
  SETTING: 'resources.type.setting',
  MAINTENANCE: 'resources.type.maintenance',
};

export function ResourceRegistryPage() {
  const { t } = useI18n();

  // --- Filter / search state ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [module, setModule] = useState('');
  const [type, setType] = useState('');

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // --- Data fetching ---
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (module) params.module = module;
    if (type) params.type = type;
    return params;
  }, [debouncedSearch, module, type]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useResourcesInfinite(queryParams);

  const resources = data?.data ?? [];

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<Resource, unknown>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('resources.column.code'),
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: t('resources.column.name'),
        enableSorting: true,
      },
      {
        accessorKey: 'module',
        header: t('resources.column.module'),
        cell: ({ getValue }) => {
          const mod = getValue<string>();
          return <span className="capitalize">{t(`navigation:${mod}`)}</span>;
        },
      },
      {
        accessorKey: 'type',
        header: t('resources.column.type'),
        cell: ({ getValue }) => {
          const resourceType = getValue<Resource['type']>();
          return (
            <Badge variant="outline">{t(TYPE_I18N[resourceType])}</Badge>
          );
        },
      },
      {
        accessorKey: 'sortOrder',
        header: t('resources.column.sortOrder'),
        enableSorting: true,
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<number>()}</span>
        ),
      },
    ],
    [t],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system' },
      { label: t('resources.title') },
    ],
    [t],
  );

  return (
    <EntityListPage<Resource>
      title={t('resources.title')}
      breadcrumbs={breadcrumbs}
      entityType="resource"
      columns={columns}
      data={resources}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={setSearch}
      filterSlot={
        <ResourceFilters
          module={module}
          onModuleChange={setModule}
          type={type}
          onTypeChange={setType}
        />
      }
      canCreate={false}
      batchActions={[]}
      onRowClick={undefined}
      hasMore={hasNextPage}
      onLoadMore={fetchNextPage}
      isLoadingMore={isFetchingNextPage}
      getRowId={(row) => row.id}
    />
  );
}
