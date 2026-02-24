/**
 * User List Page — T1 Entity List.
 *
 * Displays all users from GET /system/users
 * with text search, cursor-based pagination, and row click → detail.
 * Users are created via auth registration so canCreate is false.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { EntityListPage } from '@/components/templates/entity-list-page';

import { useI18n, useFormatDate } from '@nexa/i18n';

import type { UserListItem, UserRole } from './api/types';
import { useUsers } from './api/use-users';
import { ROLE_BADGE_STYLES, STATUS_BADGE_STYLES } from './user-badge-styles';

export function UserListPage() {
  const { t } = useI18n();
  const formatDate = useFormatDate();
  const navigate = useNavigate();

  // --- Search state with 300ms debounce ---
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

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useUsers(queryParams);

  const users = data?.data ?? [];

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<UserListItem, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        header: t('users.column.name'),
        enableSorting: true,
      },
      {
        accessorKey: 'email',
        header: t('users.column.email'),
        enableSorting: true,
      },
      {
        accessorKey: 'role',
        header: t('users.column.role'),
        cell: ({ getValue }) => {
          const role = getValue<UserRole>();
          return (
            <Badge
              variant="outline"
              className={ROLE_BADGE_STYLES[role]}
            >
              {t(`users.role.${role}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'accessGroupCount',
        header: t('users.column.accessGroups'),
        meta: { align: 'right' },
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('users.column.status'),
        cell: ({ getValue }) => {
          const isActive = getValue<boolean>();
          return (
            <Badge
              variant="outline"
              className={isActive ? STATUS_BADGE_STYLES.active : STATUS_BADGE_STYLES.inactive}
            >
              {isActive ? t('users.status.active') : t('users.status.inactive')}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'lastLoginAt',
        header: t('users.column.lastLogin'),
        cell: ({ getValue }) => {
          const value = getValue<string | null>();
          return value ? formatDate(value) : (
            <span className="text-muted-foreground">{t('users.lastLogin.never')}</span>
          );
        },
      },
    ],
    [t, formatDate],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system' },
      { label: t('users.title') },
    ],
    [t],
  );

  return (
    <EntityListPage<UserListItem>
      title={t('users.title')}
      breadcrumbs={breadcrumbs}
      entityType="user"
      columns={columns}
      data={users}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={setSearch}
      canCreate={false}
      onRowClick={(row) => void navigate({ to: '/system/users/$id' as string, params: { id: row.id } })}
      hasMore={hasNextPage}
      onLoadMore={fetchNextPage}
      isLoadingMore={isFetchingNextPage}
      getRowId={(row) => row.id}
      batchActions={[]}
    />
  );
}
