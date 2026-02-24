/**
 * Field Override Configuration Panel.
 *
 * Allows administrators to configure per-resource field visibility overrides
 * (VISIBLE, READ_ONLY, HIDDEN) for an access group. Uses replace-all semantics:
 * the Save action sends ALL overrides across ALL resources to the API.
 *
 * Local state holds the complete working set. Selecting a different resource
 * filters the table view but preserves edits for other resources.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import {
  useResources,
  type Resource,
} from '@/features/admin/resources/api/use-resources';
import { useSetFieldOverrides } from '../api/use-access-group-mutations';
import type { AccessGroupFieldOverride, FieldVisibility } from '../api/types';

// --- Types ---

interface LocalOverride {
  localId: string;
  resourceCode: string;
  fieldPath: string;
  visibility: FieldVisibility;
}

export interface FieldOverridePanelProps {
  accessGroupId: string;
  fieldOverrides: AccessGroupFieldOverride[];
  readOnly?: boolean;
}

// --- Helpers ---

/** Convert API field overrides to local state with stable IDs. */
function toLocalOverrides(
  overrides: AccessGroupFieldOverride[],
): LocalOverride[] {
  return overrides.map((o) => ({
    localId: crypto.randomUUID(),
    resourceCode: o.resourceCode,
    fieldPath: o.fieldPath,
    visibility: o.visibility,
  }));
}

/** Deep-compare local overrides to initial snapshot (order-independent). */
function isOverridesDirty(
  current: LocalOverride[],
  initial: LocalOverride[],
): boolean {
  if (current.length !== initial.length) return true;

  // Build a frequency map of "resourceCode|fieldPath|visibility" from initial
  const freq = new Map<string, number>();
  for (const o of initial) {
    const key = `${o.resourceCode}|${o.fieldPath}|${o.visibility}`;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }

  // Decrement for each current entry; any missing key or negative count means dirty
  for (const o of current) {
    const key = `${o.resourceCode}|${o.fieldPath}|${o.visibility}`;
    const count = freq.get(key);
    if (count === undefined || count <= 0) return true;
    freq.set(key, count - 1);
  }
  return false;
}

/** Group resources by module field. */
function groupByModule(resources: Resource[]): Record<string, Resource[]> {
  const groups: Record<string, Resource[]> = {};
  for (const resource of resources) {
    const mod = resource.module;
    if (!groups[mod]) {
      groups[mod] = [];
    }
    groups[mod].push(resource);
  }
  return groups;
}

// --- Validation ---

interface ValidationErrors {
  [localId: string]: string | undefined;
}

// --- Component ---

export function FieldOverridePanel({
  accessGroupId,
  fieldOverrides,
  readOnly = false,
}: FieldOverridePanelProps) {
  const { t } = useI18n();

  // --- Resource fetching ---
  const { data: resourcesData, isLoading: resourcesLoading } = useResources({
    limit: 500,
  });
  const resources = resourcesData?.data ?? [];

  // --- Mutation ---
  const setFieldOverridesMutation = useSetFieldOverrides(accessGroupId);

  // --- Local state ---
  const [localOverrides, setLocalOverrides] = useState<LocalOverride[]>(() =>
    toLocalOverrides(fieldOverrides),
  );
  const [initialSnapshot, setInitialSnapshot] = useState<LocalOverride[]>(() =>
    toLocalOverrides(fieldOverrides),
  );

  // Re-sync when prop changes (e.g., after a successful save + refetch)
  useEffect(() => {
    const next = toLocalOverrides(fieldOverrides);
    setLocalOverrides(next);
    setInitialSnapshot(next);
  }, [fieldOverrides]);

  // --- Resource selector state ---
  const [selectedResourceCode, setSelectedResourceCode] = useState<
    string | null
  >(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // --- Ref for auto-focus on new rows ---
  const newRowInputRef = useRef<HTMLInputElement>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  // Focus the new row's input after render
  useEffect(() => {
    if (pendingFocusId && newRowInputRef.current) {
      newRowInputRef.current.focus();
      setPendingFocusId(null);
    }
  }, [pendingFocusId, localOverrides]);

  // --- Derived state ---

  const moduleGroups = useMemo(() => groupByModule(resources), [resources]);

  const selectedResource = useMemo(
    () => resources.find((r) => r.code === selectedResourceCode) ?? null,
    [resources, selectedResourceCode],
  );

  const overridesForSelectedResource = useMemo(
    () =>
      selectedResourceCode
        ? localOverrides.filter(
            (o) => o.resourceCode === selectedResourceCode,
          )
        : [],
    [localOverrides, selectedResourceCode],
  );

  // --- Validation ---

  const validationErrors = useMemo<ValidationErrors>(() => {
    const errors: ValidationErrors = {};
    for (const override of localOverrides) {
      // Empty field path
      if (!override.fieldPath.trim()) {
        errors[override.localId] = t(
          'accessGroups.fieldOverrides.fieldRequired',
        );
        continue;
      }
      // Duplicate field path within same resource
      const hasDuplicate = localOverrides.some(
        (o) =>
          o.localId !== override.localId &&
          o.resourceCode === override.resourceCode &&
          o.fieldPath.trim() === override.fieldPath.trim(),
      );
      if (hasDuplicate) {
        errors[override.localId] = t(
          'accessGroups.fieldOverrides.duplicateField',
        );
      }
    }
    return errors;
  }, [localOverrides, t]);

  const hasValidationErrors = useMemo(
    () => Object.values(validationErrors).some(Boolean),
    [validationErrors],
  );

  const isDirty = useMemo(
    () => isOverridesDirty(localOverrides, initialSnapshot),
    [localOverrides, initialSnapshot],
  );

  // --- Handlers ---

  const handleSelectResource = useCallback((code: string) => {
    setSelectedResourceCode(code);
    setComboboxOpen(false);
  }, []);

  const handleAddOverride = useCallback(() => {
    if (!selectedResourceCode) return;
    const newId = crypto.randomUUID();
    setLocalOverrides((prev) => [
      ...prev,
      {
        localId: newId,
        resourceCode: selectedResourceCode,
        fieldPath: '',
        visibility: 'VISIBLE',
      },
    ]);
    setPendingFocusId(newId);
  }, [selectedResourceCode]);

  const handleRemoveOverride = useCallback((localId: string) => {
    setLocalOverrides((prev) => prev.filter((o) => o.localId !== localId));
  }, []);

  const handleFieldPathChange = useCallback(
    (localId: string, fieldPath: string) => {
      setLocalOverrides((prev) =>
        prev.map((o) => (o.localId === localId ? { ...o, fieldPath } : o)),
      );
    },
    [],
  );

  const handleVisibilityChange = useCallback(
    (localId: string, visibility: FieldVisibility) => {
      setLocalOverrides((prev) =>
        prev.map((o) => (o.localId === localId ? { ...o, visibility } : o)),
      );
    },
    [],
  );

  const saveFieldOverrides = setFieldOverridesMutation.mutateAsync;

  const handleSave = useCallback(async () => {
    const trimmed = localOverrides.map((o) => ({
      ...o,
      fieldPath: o.fieldPath.trim(),
    }));
    const payload = trimmed.map((o) => ({
      resourceCode: o.resourceCode,
      fieldPath: o.fieldPath,
      visibility: o.visibility,
    }));

    try {
      await saveFieldOverrides({
        fieldOverrides: payload,
      });
      // On success, update local state and snapshot with trimmed values
      setLocalOverrides(trimmed);
      setInitialSnapshot(trimmed);
    } catch {
      // Error handling is in the mutation's onError callback (toast)
    }
  }, [localOverrides, saveFieldOverrides]);

  // --- Visibility options ---
  const visibilityOptions: { value: FieldVisibility; label: string }[] = [
    {
      value: 'VISIBLE',
      label: t('accessGroups.fieldOverrides.visibility.VISIBLE'),
    },
    {
      value: 'READ_ONLY',
      label: t('accessGroups.fieldOverrides.visibility.READ_ONLY'),
    },
    {
      value: 'HIDDEN',
      label: t('accessGroups.fieldOverrides.visibility.HIDDEN'),
    },
  ];

  // --- Render ---

  return (
    <div className="space-y-4">
      {/* Resource Selector */}
      <div className="flex items-center gap-3">
        <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={comboboxOpen}
              aria-haspopup="listbox"
              className="w-[320px] justify-between"
              disabled={resourcesLoading}
            >
              {selectedResource ? (
                <span className="flex items-center gap-2 truncate">
                  <span>{selectedResource.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedResource.code}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t('accessGroups.fieldOverrides.selectResource')}
                </span>
              )}
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder={t(
                  'accessGroups.fieldOverrides.searchResources',
                )}
              />
              <CommandList>
                <CommandEmpty>
                  {t('accessGroups.permission.noResources')}
                </CommandEmpty>
                {Object.keys(moduleGroups)
                  .sort()
                  .map((moduleName) => (
                    <CommandGroup key={moduleName} heading={moduleName}>
                      {moduleGroups[moduleName]!.map((resource) => (
                        <CommandItem
                          key={resource.code}
                          value={`${resource.name} ${resource.code}`}
                          onSelect={() => handleSelectResource(resource.code)}
                        >
                          <Check
                            className={cn(
                              'mr-2 size-4',
                              selectedResourceCode === resource.code
                                ? 'opacity-100'
                                : 'opacity-0',
                            )}
                          />
                          <span>{resource.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {resource.code}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Content area */}
      {!selectedResourceCode ? (
        /* Empty state — no resource selected */
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('accessGroups.fieldOverrides.emptyState')}
          </CardContent>
        </Card>
      ) : overridesForSelectedResource.length === 0 ? (
        /* Empty table state — resource selected but no overrides */
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <p className="text-muted-foreground">
              {t('accessGroups.fieldOverrides.noOverrides')}
            </p>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddOverride}
              >
                <Plus className="size-4" />
                {t('accessGroups.fieldOverrides.addOverride')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Override table */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">
                    {t('accessGroups.fieldOverrides.fieldPath')}
                  </TableHead>
                  <TableHead className="w-[35%]">
                    {t('accessGroups.fieldOverrides.visibility')}
                  </TableHead>
                  <TableHead className="w-[20%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {overridesForSelectedResource.map((override) => (
                  <TableRow key={override.localId}>
                    {/* Field Path */}
                    <TableCell>
                      <div className="space-y-1">
                        <Input
                          ref={
                            pendingFocusId === override.localId
                              ? newRowInputRef
                              : undefined
                          }
                          value={override.fieldPath}
                          onChange={(e) =>
                            handleFieldPathChange(
                              override.localId,
                              e.target.value,
                            )
                          }
                          placeholder={t(
                            'accessGroups.fieldOverrides.fieldPathPlaceholder',
                          )}
                          className="h-8"
                          readOnly={readOnly}
                          disabled={readOnly}
                          aria-invalid={
                            !!validationErrors[override.localId]
                          }
                          aria-describedby={
                            validationErrors[override.localId]
                              ? `error-${override.localId}`
                              : undefined
                          }
                        />
                        {validationErrors[override.localId] && (
                          <p
                            id={`error-${override.localId}`}
                            className="text-xs text-destructive"
                          >
                            {validationErrors[override.localId]}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Visibility */}
                    <TableCell>
                      <Select
                        value={override.visibility}
                        onValueChange={(val) =>
                          handleVisibilityChange(
                            override.localId,
                            val as FieldVisibility,
                          )
                        }
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 w-full" size="sm" disabled={readOnly}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {visibilityOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Remove */}
                    <TableCell className="text-right">
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() =>
                            handleRemoveOverride(override.localId)
                          }
                          aria-label={t(
                            'accessGroups.fieldOverrides.removeOverride',
                            { field: override.fieldPath || '…' },
                          )}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>

          {/* Add Override button below table */}
          {!readOnly && (
            <div className="border-t px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddOverride}
              >
                <Plus className="size-4" />
                {t('accessGroups.fieldOverrides.addOverride')}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Save button */}
      {selectedResourceCode && !readOnly && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={
              !isDirty ||
              hasValidationErrors ||
              setFieldOverridesMutation.isPending
            }
          >
            {setFieldOverridesMutation.isPending && (
              <Loader2 className="animate-spin" />
            )}
            {t('accessGroups.fieldOverrides.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
