/**
 * User Detail Page — T2 Record Detail.
 *
 * Read-only user profile (name, email, role, status, last login)
 * plus an Access Groups assignment panel for managing group memberships.
 */

import { useMemo } from 'react';

import { useI18n, useFormatDate } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/templates/page-header';

import { useUser } from './api/use-user-detail';
import { AccessGroupAssignmentPanel } from './components/access-group-assignment-panel';
import { ROLE_BADGE_STYLES, STATUS_BADGE_STYLES } from './user-badge-styles';

// --- Component ---

export interface UserDetailPageProps {
  id: string;
}

export function UserDetailPage({ id }: UserDetailPageProps) {
  const { t } = useI18n();
  const formatDate = useFormatDate();

  // --- Data fetching ---
  const { data: user, isLoading, isError } = useUser(id);

  // --- Breadcrumbs ---
  const breadcrumbs = useMemo(
    () => [
      { label: t('navigation:system'), path: '/system' },
      { label: t('users.title'), path: '/system/users' },
      {
        label: user
          ? `${user.firstName} ${user.lastName}`
          : t('users.detail.title'),
      },
    ],
    [t, user],
  );

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('users.detail.title')}
          breadcrumbs={breadcrumbs}
          isLoading
        />
        <Card className="max-w-3xl">
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-64" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-5 w-40" />
          </CardContent>
        </Card>
        <Card className="max-w-3xl">
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error state ---
  if (isError || !user) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('users.detail.title')}
          breadcrumbs={breadcrumbs}
        />
        <Card className="max-w-3xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('users.error.loadFailed')}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Status badge ---
  const statusBadge = (
    <Badge
      variant="outline"
      className={user.isActive ? STATUS_BADGE_STYLES.active : STATUS_BADGE_STYLES.inactive}
    >
      {user.isActive ? t('users.status.active') : t('users.status.inactive')}
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* Page header with breadcrumbs, user name as title, and status badge */}
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        breadcrumbs={breadcrumbs}
        statusBadge={statusBadge}
      />

      {/* Read-only user profile card */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">
            {t('users.detail.profileTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {/* Email */}
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t('users.field.email')}
              </dt>
              <dd className="mt-1 text-sm">{user.email}</dd>
            </div>

            {/* Role */}
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t('users.field.role')}
              </dt>
              <dd className="mt-1">
                <Badge
                  variant="outline"
                  className={ROLE_BADGE_STYLES[user.role]}
                >
                  {t(`users.role.${user.role}`)}
                </Badge>
              </dd>
            </div>

            {/* Status */}
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t('users.field.status')}
              </dt>
              <dd className="mt-1">
                <Badge
                  variant="outline"
                  className={user.isActive ? STATUS_BADGE_STYLES.active : STATUS_BADGE_STYLES.inactive}
                >
                  {user.isActive
                    ? t('users.status.active')
                    : t('users.status.inactive')}
                </Badge>
              </dd>
            </div>

            {/* Last Login */}
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t('users.field.lastLogin')}
              </dt>
              <dd className="mt-1 text-sm">
                {user.lastLoginAt ? (
                  formatDate(user.lastLoginAt)
                ) : (
                  <span className="text-muted-foreground">
                    {t('users.lastLogin.never')}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Access Groups assignment panel */}
      <AccessGroupAssignmentPanel userId={id} />
    </div>
  );
}
