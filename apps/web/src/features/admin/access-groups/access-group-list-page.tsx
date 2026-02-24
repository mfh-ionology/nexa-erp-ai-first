/**
 * Access Group List Page — T1 Entity List.
 *
 * Displays all access groups from GET /system/access-groups
 * with text search, cursor-based pagination, and row click → detail.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { EntityListPage } from '@/components/templates/entity-list-page';

import { useI18n, useFormatDate } from '@nexa/i18n';

import type { AccessGroup } from './api/types';
import { useAccessGroups } from './api/use-access-groups';

export function AccessGroupListPage() {
  const { t } = useI18n();
  const formatDate = useFormatDate();
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
    const params: Record<string, string | boolean> = { isActive: true };
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [debouncedSearch]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useAccessGroups(queryParams);

  const accessGroups = data?.data ?? [];

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<AccessGroup, unknown>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('accessGroups.column.code'),
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: t('accessGroups.column.name'),
        enableSorting: true,
      },
      {
        accessorKey: 'isSystem',
        header: t('accessGroups.column.system'),
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <Badge variant="secondary">{t('accessGroups.systemBadge')}</Badge>
          ) : null,
      },
      {
        accessorKey: 'userCount',
        header: t('accessGroups.column.userCount'),
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('accessGroups.column.created'),
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
    ],
    [t, formatDate],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system' },
      { label: t('accessGroups.title') },
    ],
    [t],
  );

  return (
    <EntityListPage<AccessGroup>
      title={t('accessGroups.title')}
      breadcrumbs={breadcrumbs}
      entityType="access-group"
      columns={columns}
      data={accessGroups}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={setSearch}
      canCreate={true}
      onCreateNew={() => void navigate({ to: '/system/access-groups/new' as string })}
      onRowClick={(row) => void navigate({ to: `/system/access-groups/${row.id}` as string })}
      hasMore={hasNextPage}
      onLoadMore={fetchNextPage}
      isLoadingMore={isFetchingNextPage}
      getRowId={(row) => row.id}
      batchActions={[]}
    />
  );
}
