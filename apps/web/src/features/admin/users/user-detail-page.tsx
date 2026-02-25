/* eslint-disable i18next/no-literal-string */
/**
 * User Detail Page — v0 Concept D design.
 *
 * Hero profile card + two-column layout (Access Groups + Activity Timeline)
 * + full-width Permissions Summary table.
 * All real data from API hooks; visual design from v0 prototype.
 */

import { useI18n, useFormatDate } from '@nexa/i18n';
import { Check, X as XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useUser } from './api/use-user-detail';
import { AccessGroupAssignmentPanel } from './components/access-group-assignment-panel';
import { ROLE_BADGE_STYLES } from './user-badge-styles';

/* ── Avatar color ──────────────────────────────────────────── */

const AVATAR_COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

/* ── Timeline Item ─────────────────────────────────────────── */

function TimelineItem({
  label,
  date,
  by,
  color,
  isLast,
}: {
  label: string;
  date: string;
  by: string;
  color: string;
  isLast: boolean;
}) {
  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      {!isLast && <div className="absolute left-[9px] top-5 h-full w-px bg-[#ede9fe]" />}
      <div className="relative z-10 mt-1 flex shrink-0 items-center justify-center">
        <span
          className="block h-5 w-5 rounded-full border-[3px] bg-card"
          style={{ borderColor: color }}
        />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{date}</span>
        <span className="text-xs text-muted-foreground">{by}</span>
      </div>
    </div>
  );
}

/* ── Permission Icon ───────────────────────────────────────── */

function PermIcon({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Check className="mx-auto h-4 w-4 text-[#10b981]" />
  ) : (
    <XIcon className="mx-auto h-4 w-4 text-[#d1d5db]" />
  );
}

/* ── Component ─────────────────────────────────────────────── */

export interface UserDetailPageProps {
  id: string;
}

export function UserDetailPage({ id }: UserDetailPageProps) {
  const { t } = useI18n();
  const formatDate = useFormatDate();

  const { data: user, isLoading, isError } = useUser(id);

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="animate-fade-in-up rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (isError || !user) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          {t('users.error.loadFailed')}
        </div>
      </div>
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`;
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  const avatarColor = getAvatarColor(fullName);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* ── Profile Hero Card ─────────────────────────────── */}
      <div
        className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
        style={{ animationDelay: '50ms' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-3xl font-bold text-foreground">{fullName}</h1>
                <Badge variant="outline" className={ROLE_BADGE_STYLES[user.role]}>
                  {t(`users.role.${user.role}`)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      user.isActive ? 'bg-[#10b981]' : 'bg-[#d1d5db]',
                    )}
                  />
                  {user.isActive ? t('users.status.active') : t('users.status.inactive')}
                </span>
                <span>
                  {t('users.field.lastLogin')}:{' '}
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : t('users.lastLogin.never')}
                </span>
                <span>
                  {t('users.field.memberSince')}: {formatDate(user.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column: Access Groups + Activity Timeline ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Access Groups */}
        <AccessGroupAssignmentPanel userId={id} />

        {/* Activity Timeline */}
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
          style={{ animationDelay: '150ms' }}
        >
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
            {t('users.activityTimeline.title')}
          </h3>
          <div className="relative flex flex-col">
            {/* Account created */}
            <TimelineItem
              label={t('users.activityTimeline.accountCreated')}
              date={formatDate(user.createdAt)}
              by={t('users.activityTimeline.system')}
              color="#10b981"
              isLast={false}
            />
            {/* First login (if user has logged in) */}
            {user.lastLoginAt && (
              <TimelineItem
                label={t('users.activityTimeline.firstLogin')}
                date={formatDate(user.lastLoginAt)}
                by={fullName}
                color="#3b82f6"
                isLast={false}
              />
            )}
            {/* Role assignment */}
            <TimelineItem
              label={t('users.activityTimeline.roleChanged', {
                role: t(`users.role.${user.role}`),
              })}
              date={formatDate(user.updatedAt)}
              by={t('users.activityTimeline.system')}
              color="#7c3aed"
              isLast={true}
            />
          </div>
        </div>
      </div>

      {/* ── Permissions Summary Matrix ────────────────────── */}
      <div
        className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
        style={{ animationDelay: '200ms' }}
      >
        <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
          {t('users.permissions.title')}
        </h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]">
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('users.permissions.module')}
                </TableHead>
                <TableHead className="h-10 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('users.permissions.view')}
                </TableHead>
                <TableHead className="h-10 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('users.permissions.create')}
                </TableHead>
                <TableHead className="h-10 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('users.permissions.edit')}
                </TableHead>
                <TableHead className="h-10 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('users.permissions.delete')}
                </TableHead>
                <TableHead className="h-10 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('users.permissions.approve')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                [
                  'system',
                  'finance',
                  'ar',
                  'ap',
                  'sales',
                  'purchasing',
                  'inventory',
                  'crm',
                  'hr',
                  'manufacturing',
                  'reporting',
                ] as const
              ).map((mod) => {
                // PLACEHOLDER: Simplified role-based permissions for display.
                // Real permissions are driven by Access Groups (resolved in E2b).
                const isSuperAdmin = user.role === 'SUPER_ADMIN';
                const isAdmin = user.role === 'ADMIN';
                const isManager = user.role === 'MANAGER';
                const hasAll = isSuperAdmin;
                const hasView = hasAll || isAdmin || isManager;
                const hasCreate = hasAll || isAdmin || isManager;
                const hasEdit = hasAll || isAdmin || isManager;
                const hasDelete = hasAll || isAdmin;
                const hasApprove = hasAll || isAdmin;
                return (
                  <TableRow key={mod} className="border-b border-border/60 hover:bg-[#f5f3ff]/50">
                    <TableCell className="px-4 py-2.5 text-sm font-medium text-foreground">
                      {t(`navigation:${mod}`)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-center">
                      <PermIcon allowed={hasView} />
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-center">
                      <PermIcon allowed={hasCreate} />
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-center">
                      <PermIcon allowed={hasEdit} />
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-center">
                      <PermIcon allowed={hasDelete} />
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-center">
                      <PermIcon allowed={hasApprove} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
