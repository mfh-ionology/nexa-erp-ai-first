/**
 * Permission Matrix component for the Access Group detail page.
 *
 * Displays a checkbox grid of resources grouped by module with
 * per-resource permission flags (canAccess, canNew, canView, canEdit, canDelete).
 * Supports module-level "Select All" toggling and responsive mobile layout.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import {
  useResources,
  type Resource,
} from '@/features/admin/resources/api/use-resources';
import { useSetPermissions } from '../api/use-access-group-mutations';
import type { AccessGroupPermission } from '../api/types';

// --- Types ---

interface PermissionFlags {
  canAccess: boolean;
  canNew: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const PERMISSION_KEYS: (keyof PermissionFlags)[] = [
  'canAccess',
  'canNew',
  'canView',
  'canEdit',
  'canDelete',
];

export interface PermissionMatrixProps {
  accessGroupId: string;
  permissions: AccessGroupPermission[];
  isLoading?: boolean;
  readOnly?: boolean;
}

// --- Helpers ---

/** Build the initial permission state from all resources overlaid with existing permissions. */
function buildInitialState(
  resources: Resource[],
  permissions: AccessGroupPermission[],
): Record<string, PermissionFlags> {
  const permMap = new Map(permissions.map((p) => [p.resourceCode, p]));
  const state: Record<string, PermissionFlags> = {};

  for (const resource of resources) {
    const existing = permMap.get(resource.code);
    state[resource.code] = {
      canAccess: existing?.canAccess ?? false,
      canNew: existing?.canNew ?? false,
      canView: existing?.canView ?? false,
      canEdit: existing?.canEdit ?? false,
      canDelete: existing?.canDelete ?? false,
    };
  }

  return state;
}

/** Group resources by their module field, sorted by sortOrder within each group. */
function groupByModule(resources: Resource[]): Record<string, Resource[]> {
  const groups: Record<string, Resource[]> = {};
  for (const resource of resources) {
    const mod = resource.module;
    if (!groups[mod]) {
      groups[mod] = [];
    }
    groups[mod].push(resource);
  }
  for (const key of Object.keys(groups)) {
    groups[key]!.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return groups;
}

/** Compare current state to initial state to determine if changes exist. */
function isStateDirty(
  current: Record<string, PermissionFlags>,
  initial: Record<string, PermissionFlags>,
): boolean {
  for (const code of Object.keys(current)) {
    const c = current[code]!;
    const i = initial[code];
    if (!i) return true;
    for (const key of PERMISSION_KEYS) {
      if (c[key] !== i[key]) return true;
    }
  }
  return false;
}

// --- Component ---

export function PermissionMatrix({
  accessGroupId,
  permissions,
  isLoading: externalLoading,
  readOnly = false,
}: PermissionMatrixProps) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();
  const isPhone = breakpoint === 'phone';

  // Fetch all resources for the grid
  const { data: resourcesData, isLoading: resourcesLoading } = useResources({
    limit: 500,
  });
  const resources = resourcesData?.data ?? [];

  // Set permissions mutation
  const setPermissionsMutation = useSetPermissions(accessGroupId);

  // Group resources by module
  const moduleGroups = useMemo(() => groupByModule(resources), [resources]);
  const moduleNames = useMemo(
    () => Object.keys(moduleGroups).sort(),
    [moduleGroups],
  );

  // Build initial permission state from resources + existing permissions
  const initialState = useMemo(
    () => buildInitialState(resources, permissions),
    [resources, permissions],
  );

  // Local permission state
  const [permState, setPermState] = useState<Record<string, PermissionFlags>>(
    {},
  );

  // Re-sync local state when initialState changes (data loaded / permissions updated)
  useEffect(() => {
    if (Object.keys(initialState).length > 0) {
      setPermState(initialState);
    }
  }, [initialState]);

  // Track which modules are expanded (default: all expanded)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(),
  );

  // Initialize expanded modules when module names are available
  useEffect(() => {
    if (moduleNames.length > 0) {
      setExpandedModules(new Set(moduleNames));
    }
  }, [moduleNames]);

  // Dirty tracking
  const isDirty = useMemo(
    () => isStateDirty(permState, initialState),
    [permState, initialState],
  );

  // --- Handlers ---

  const togglePermission = useCallback(
    (resourceCode: string, key: keyof PermissionFlags) => {
      setPermState((prev) => {
        const existing = prev[resourceCode] ?? {
          canAccess: false,
          canNew: false,
          canView: false,
          canEdit: false,
          canDelete: false,
        };
        return {
          ...prev,
          [resourceCode]: {
            ...existing,
            [key]: !existing[key],
          },
        };
      });
    },
    [],
  );

  const toggleModule = useCallback((moduleName: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleName)) {
        next.delete(moduleName);
      } else {
        next.add(moduleName);
      }
      return next;
    });
  }, []);

  const toggleModuleColumn = useCallback(
    (moduleName: string, key: keyof PermissionFlags) => {
      const moduleResources = moduleGroups[moduleName] ?? [];
      const allSet = moduleResources.every(
        (r) => permState[r.code]?.[key] === true,
      );
      const newValue = !allSet;
      setPermState((prev) => {
        const next = { ...prev };
        for (const resource of moduleResources) {
          const existing = next[resource.code] ?? {
            canAccess: false,
            canNew: false,
            canView: false,
            canEdit: false,
            canDelete: false,
          };
          next[resource.code] = {
            ...existing,
            [key]: newValue,
          };
        }
        return next;
      });
    },
    [moduleGroups, permState],
  );

  const handleSave = useCallback(async () => {
    // Build payload — only include resources that have at least one true flag
    const permissionsPayload = Object.entries(permState)
      .filter(([, flags]) => PERMISSION_KEYS.some((k) => flags[k]))
      .map(([resourceCode, flags]) => ({
        resourceCode,
        canAccess: flags.canAccess,
        canNew: flags.canNew,
        canView: flags.canView,
        canEdit: flags.canEdit,
        canDelete: flags.canDelete,
      }));

    try {
      await setPermissionsMutation.mutateAsync(permissionsPayload);
    } catch {
      // Error handling is in the mutation's onError callback (toast)
    }
  }, [permState, setPermissionsMutation]);

  // --- Loading state ---

  const isLoading = externalLoading || resourcesLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (resources.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('accessGroups.permission.noResources')}
        </CardContent>
      </Card>
    );
  }

  // --- Permission column definitions ---

  const permissionColumns: { key: keyof PermissionFlags; label: string }[] = [
    { key: 'canAccess', label: t('accessGroups.permission.access') },
    { key: 'canNew', label: t('accessGroups.permission.new') },
    { key: 'canView', label: t('accessGroups.permission.view') },
    { key: 'canEdit', label: t('accessGroups.permission.edit') },
    { key: 'canDelete', label: t('accessGroups.permission.delete') },
  ];

  // --- Phone layout: cards with switch toggles ---

  if (isPhone) {
    return (
      <div className="space-y-4">
        {moduleNames.map((moduleName) => (
          <Collapsible
            key={moduleName}
            open={expandedModules.has(moduleName)}
            onOpenChange={() => toggleModule(moduleName)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    {expandedModules.has(moduleName) ? (
                      <ChevronDown className="size-4" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="size-4" aria-hidden="true" />
                    )}
                    {moduleName}
                    <span className="font-normal text-muted-foreground">
                      ({moduleGroups[moduleName]!.length})
                    </span>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  {moduleGroups[moduleName]!.map((resource) => (
                    <div
                      key={resource.code}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <p className="text-sm font-medium">{resource.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {permissionColumns.map((col) => (
                          <label
                            key={col.key}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="text-muted-foreground">
                              {col.label}
                            </span>
                            <Switch
                              checked={
                                permState[resource.code]?.[col.key] ?? false
                              }
                              onCheckedChange={() =>
                                togglePermission(resource.code, col.key)
                              }
                              disabled={readOnly}
                              size="sm"
                              aria-label={`${resource.name} ${col.label}`}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}

        {/* Save button — full width on phone */}
        {!readOnly && (
          <Button
            onClick={handleSave}
            disabled={!isDirty || setPermissionsMutation.isPending}
            className="w-full"
          >
            {setPermissionsMutation.isPending && (
              <Loader2 className="animate-spin" />
            )}
            {t('accessGroups.permission.savePermissions')}
          </Button>
        )}
      </div>
    );
  }

  // --- Desktop layout: grid with checkboxes ---

  return (
    <div className="space-y-4">
      {moduleNames.map((moduleName) => {
        const moduleResources = moduleGroups[moduleName]!;
        const isExpanded = expandedModules.has(moduleName);

        return (
          <Collapsible
            key={moduleName}
            open={isExpanded}
            onOpenChange={() => toggleModule(moduleName)}
          >
            <Card>
              {/* Module header with Select All toggles per column */}
              <CollapsibleTrigger asChild>
                <div className="flex cursor-pointer select-none items-center border-b px-4 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronRight
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-sm font-semibold">{moduleName}</span>
                    <span className="text-xs text-muted-foreground">
                      ({moduleResources.length})
                    </span>
                  </div>

                  {/* Select All checkboxes per column */}
                  {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                  <div
                    className="flex items-center gap-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {permissionColumns.map((col) => {
                      const allChecked = moduleResources.every(
                        (r) => permState[r.code]?.[col.key] === true,
                      );
                      const someChecked =
                        !allChecked &&
                        moduleResources.some(
                          (r) => permState[r.code]?.[col.key] === true,
                        );
                      return (
                        <div
                          key={col.key}
                          className="flex w-20 items-center justify-center"
                        >
                          <Checkbox
                            checked={
                              allChecked
                                ? true
                                : someChecked
                                  ? 'indeterminate'
                                  : false
                            }
                            onCheckedChange={() =>
                              toggleModuleColumn(moduleName, col.key)
                            }
                            disabled={readOnly}
                            aria-label={`${t('accessGroups.permission.selectAll')} ${col.label} - ${moduleName}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                {/* Column headers */}
                <div className="sticky top-0 z-10 flex items-center border-b bg-muted/50 px-4 py-2">
                  <div className="min-w-0 flex-1 pl-6 text-xs font-medium text-muted-foreground">
                    {t('accessGroups.column.name')}
                  </div>
                  {permissionColumns.map((col) => (
                    <div
                      key={col.key}
                      className="w-20 text-center text-xs font-medium text-muted-foreground"
                    >
                      {col.label}
                    </div>
                  ))}
                </div>

                {/* Resource rows */}
                {moduleResources.map((resource) => (
                  <div
                    key={resource.code}
                    className="flex items-center border-b px-4 py-2 last:border-b-0 hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1 pl-6">
                      <span className="text-sm">{resource.name}</span>
                    </div>
                    {permissionColumns.map((col) => (
                      <div
                        key={col.key}
                        className="flex w-20 items-center justify-center"
                      >
                        <Checkbox
                          checked={
                            permState[resource.code]?.[col.key] ?? false
                          }
                          onCheckedChange={() =>
                            togglePermission(resource.code, col.key)
                          }
                          disabled={readOnly}
                          aria-label={`${resource.name} ${col.label}`}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Save button */}
      {!readOnly && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={!isDirty || setPermissionsMutation.isPending}
          >
            {setPermissionsMutation.isPending && (
              <Loader2 className="animate-spin" />
            )}
            {t('accessGroups.permission.savePermissions')}
          </Button>
        </div>
      )}
    </div>
  );
}
