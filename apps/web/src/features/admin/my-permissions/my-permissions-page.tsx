/**
 * My Permissions Page — read-only display of the current user's
 * resolved permissions, access groups, enabled modules, and field overrides.
 *
 * Reads entirely from the Zustand auth store — no additional API calls.
 * The company name is obtained from the already-cached companies query.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Shield,
  ShieldAlert,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { queryKeys } from '@/lib/query-keys';
import { fetchCompanies } from '@/lib/system-api';
import type { ResolvedPermissions } from '@/stores/auth-store';
import { useAuthStore } from '@/stores/auth-store';

import { useI18n } from '@nexa/i18n';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Group resource codes by module prefix (e.g. 'sales.orders.list' → 'sales'). */
function groupByModule(
  modules: ResolvedPermissions['modules'],
): Record<string, Array<{ code: string; perms: ResolvedPermissions['modules'][string] }>> {
  const groups: Record<
    string,
    Array<{ code: string; perms: ResolvedPermissions['modules'][string] }>
  > = {};

  for (const [code, perms] of Object.entries(modules)) {
    const moduleKey = code.split('.')[0] ?? code;
    const list = groups[moduleKey];
    if (list) {
      list.push({ code, perms });
    } else {
      groups[moduleKey] = [{ code, perms }];
    }
  }

  // Sort entries within each group by code
  for (const entries of Object.values(groups)) {
    entries.sort((a, b) => a.code.localeCompare(b.code));
  }

  return groups;
}

// ── Component ────────────────────────────────────────────────────────────────

export function MyPermissionsPage() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);

  // Reuse the already-cached companies query for the company name
  const { data: companies } = useQuery({
    queryKey: queryKeys.system.companies(),
    queryFn: fetchCompanies,
  });
  const companyName = companies?.find((c) => c.id === activeCompanyId)?.name;

  const permissionGroups = useMemo(
    () => (permissions ? groupByModule(permissions.modules) : {}),
    [permissions],
  );

  const sortedModuleKeys = useMemo(
    () => Object.keys(permissionGroups).sort(),
    [permissionGroups],
  );

  const fieldOverrideEntries = useMemo(
    () =>
      permissions
        ? Object.entries(permissions.fieldOverrides).filter(
            ([, overrides]) => Object.keys(overrides).length > 0,
          )
        : [],
    [permissions],
  );

  if (!permissions || !user) {
    return null;
  }

  return (
    <section className="space-y-6 p-6" aria-labelledby="my-permissions-title">
      {/* Page header */}
      <div>
        <h1 id="my-permissions-title" className="text-2xl font-semibold tracking-tight">
          {t('myPermissions.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('myPermissions.description')}
        </p>
      </div>

      {/* Super Admin banner */}
      {permissions.isSuperAdmin && (
        <div
          className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
          role="status"
        >
          <ShieldAlert className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {t('myPermissions.superAdminBanner')}
          </p>
        </div>
      )}

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('myPermissions.userInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t('users.column.name')}
              </dt>
              <dd className="mt-1 text-sm">
                {user.firstName} {user.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t('email')}
              </dt>
              <dd className="mt-1 text-sm">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t('myPermissions.role')}
              </dt>
              <dd className="mt-1 flex items-center gap-2">
                <Badge
                  variant={permissions.isSuperAdmin ? 'default' : 'secondary'}
                >
                  {t(`users.role.${permissions.role}`)}
                </Badge>
                {permissions.isSuperAdmin && (
                  <Badge variant="outline" className="gap-1">
                    <Shield className="size-3" />
                    {t('myPermissions.superAdminBadge')}
                  </Badge>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t('myPermissions.company')}
              </dt>
              <dd className="mt-1 text-sm">
                {companyName ?? activeCompanyId}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Access Groups Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('myPermissions.accessGroups')}</CardTitle>
        </CardHeader>
        <CardContent>
          {permissions.accessGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('myPermissions.noAccessGroups')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {permissions.accessGroups.map((group) => (
                <Badge key={group.id} variant="secondary" className="gap-1.5">
                  <span className="font-mono text-xs">{group.code}</span>
                  <span className="text-muted-foreground">—</span>
                  <span>{group.name}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enabled Modules Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('myPermissions.enabledModules')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {permissions.enabledModules.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noData')}</p>
            ) : (
              permissions.enabledModules.map((mod) => (
                <Badge key={mod} variant="outline" className="capitalize">
                  {t(`navigation:${mod}`)}
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permission Matrix Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('myPermissions.permissionMatrix')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedModuleKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noData')}</p>
          ) : (
            sortedModuleKeys.map((moduleKey) => (
              <PermissionModuleGroup
                key={moduleKey}
                moduleKey={moduleKey}
                entries={permissionGroups[moduleKey] ?? []}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Field Overrides Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('myPermissions.fieldOverrides')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {fieldOverrideEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('myPermissions.noFieldOverrides')}
            </p>
          ) : (
            fieldOverrideEntries.map(([resourceCode, overrides]) => (
              <FieldOverrideGroup
                key={resourceCode}
                resourceCode={resourceCode}
                overrides={overrides}
              />
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PermissionModuleGroup({
  moduleKey,
  entries,
}: {
  moduleKey: string;
  entries: Array<{
    code: string;
    perms: ResolvedPermissions['modules'][string];
  }>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {open ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
        <span className="capitalize">{t(`navigation:${moduleKey}`)}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {entries.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('resources.column.code')}</TableHead>
                <TableHead className="text-center">
                  {t('permissions.canAccess')}
                </TableHead>
                <TableHead className="text-center">
                  {t('permissions.canNew')}
                </TableHead>
                <TableHead className="text-center">
                  {t('permissions.canView')}
                </TableHead>
                <TableHead className="text-center">
                  {t('permissions.canEdit')}
                </TableHead>
                <TableHead className="text-center">
                  {t('permissions.canDelete')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(({ code, perms }) => (
                <TableRow key={code}>
                  <TableCell className="font-mono text-xs">{code}</TableCell>
                  <TableCell className="text-center">
                    <PermissionIcon allowed={perms.canAccess} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PermissionIcon allowed={perms.canNew} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PermissionIcon allowed={perms.canView} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PermissionIcon allowed={perms.canEdit} />
                  </TableCell>
                  <TableCell className="text-center">
                    <PermissionIcon allowed={perms.canDelete} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FieldOverrideGroup({
  resourceCode,
  overrides,
}: {
  resourceCode: string;
  overrides: Record<string, 'VISIBLE' | 'READ_ONLY' | 'HIDDEN'>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const entries = Object.entries(overrides);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {open ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
        <span className="font-mono">{resourceCode}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {entries.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t('accessGroups.fieldOverrides.fieldPath')}
                </TableHead>
                <TableHead>
                  {t('accessGroups.fieldOverrides.visibility')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([field, visibility]) => (
                <TableRow key={field}>
                  <TableCell className="font-mono text-xs">{field}</TableCell>
                  <TableCell>
                    <VisibilityBadge visibility={visibility} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PermissionIcon({ allowed }: { allowed: boolean }) {
  const { t } = useI18n();
  return allowed ? (
    <Check
      className="inline-block size-4 text-emerald-600 dark:text-emerald-400"
      aria-label={t('permissions.granted')}
    />
  ) : (
    <X
      className="inline-block size-4 text-muted-foreground/50"
      aria-label={t('permissions.denied')}
    />
  );
}

function VisibilityBadge({
  visibility,
}: {
  visibility: 'VISIBLE' | 'READ_ONLY' | 'HIDDEN';
}) {
  const { t } = useI18n();
  const config = {
    VISIBLE: { variant: 'outline' as const, key: 'permissions.visible' },
    READ_ONLY: { variant: 'secondary' as const, key: 'permissions.readOnly' },
    HIDDEN: { variant: 'destructive' as const, key: 'permissions.hidden' },
  };
  const { variant, key } = config[visibility];
  return <Badge variant={variant}>{t(key)}</Badge>;
}
