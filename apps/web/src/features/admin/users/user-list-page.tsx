/* eslint-disable i18next/no-literal-string */
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
import { cn } from '@/lib/utils';

import { useI18n, useFormatDate } from '@nexa/i18n';

import type { UserListItem, UserRole } from './api/types';
import { useUsers } from './api/use-users';
import { ROLE_BADGE_STYLES } from './user-badge-styles';

// ── Avatar helper ──────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'] as const;

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

// ── Component ──────────────────────────────────────────────────────────────

export function UserListPage() {
  const { t } = useI18n();
  const formatDate = useFormatDate();
  const navigate = useNavigate();

  // --- Search state with 300ms debounce ---
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  // --- Data fetching ---
  const queryParams = useMemo(() => {
    const params: Record<string, string | boolean> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    return params;
  }, [debouncedSearch]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useUsers(queryParams);

  const users = data?.data ?? [];

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<UserListItem>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        header: t('users.column.name'),
        enableSorting: true,
        cell: ({ row }) => {
          const user = row.original;
          const fullName = `${user.firstName} ${user.lastName}`;
          const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
          const colorClass = getAvatarColor(fullName);

          return (
            <div className="flex items-center gap-3">
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: colorClass }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'role',
        header: t('users.column.role'),
        cell: ({ getValue }) => {
          const role = getValue<UserRole>();
          return (
            <Badge variant="outline" className={ROLE_BADGE_STYLES[role]}>
              {t(`users.role.${role}`)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'accessGroupCount',
        header: t('users.column.accessGroups'),
        cell: ({ getValue }) => {
          const count = getValue<number>();
          return (
            <span
              className={cn(
                'inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                count > 0 ? 'bg-[#ede9fe] text-[#7c3aed]' : 'bg-secondary text-muted-foreground',
              )}
            >
              {count}
            </span>
          );
        },
      },
      {
        accessorKey: 'isActive',
        header: t('users.column.status'),
        cell: ({ getValue }) => {
          const isActive = getValue<boolean>();
          return (
            <div className="flex items-center gap-2">
              <span
                className={cn('size-2 rounded-full', isActive ? 'bg-[#10b981]' : 'bg-[#d1d5db]')}
              />
              <span
                className={cn('text-sm', isActive ? 'text-foreground' : 'text-muted-foreground')}
              >
                {isActive ? t('users.status.active') : t('users.status.inactive')}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'lastLoginAt',
        header: t('users.column.lastLogin'),
        cell: ({ getValue }) => {
          const value = getValue<string | null>();
          return value ? (
            <span className="text-sm text-foreground">{formatDate(value)}</span>
          ) : (
            <span className="text-sm text-muted-foreground/60">{t('users.lastLogin.never')}</span>
          );
        },
      },
    ],
    [t, formatDate],
  );

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [{ label: t('navigation:system'), path: '/system' }, { label: t('users.title') }],
    [t],
  );

  return (
    <EntityListPage<UserListItem>
      title={t('users.title')}
      breadcrumbs={breadcrumbs}
      entityType="user"
      viewKey="USERS"
      columns={columns}
      data={users}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('users.searchPlaceholder')}
      canCreate={false}
      onRowClick={(row) =>
        void navigate({ to: '/system/users/$id' as string, params: { id: row.id } })
      }
      hasMore={hasNextPage}
      onLoadMore={() => void fetchNextPage()}
      isLoadingMore={isFetchingNextPage}
      getRowId={(row) => row.id}
      batchActions={[]}
    />
  );
}
