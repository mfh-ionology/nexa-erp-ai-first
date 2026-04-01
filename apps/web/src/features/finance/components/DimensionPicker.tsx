/* eslint-disable i18next/no-literal-string */
/**
 * DimensionPicker — Compact popover for selecting dimension values on a journal line.
 *
 * Shows a trigger button with selected dimension badges. When clicked, opens a
 * popover with one section per active dimension type. Each section shows either
 * a single-select dropdown or multi-select checkboxes depending on the type's
 * `singleSelect` flag.
 */

import { useCallback, useMemo } from 'react';
import { Tags, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useDimensionTypes, useDimensionValues } from '../dimensions/api';
import type { DimensionType, DimensionValue } from '../dimensions/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineDimension {
  dimensionValueId: string;
  dimensionValueCode?: string;
  dimensionValueName?: string;
  dimensionTypeCode?: string;
  dimensionTypeName?: string;
  dimensionTypeId?: string;
  singleSelect?: boolean;
}

interface DimensionPickerProps {
  dimensions: LineDimension[];
  onChange: (dimensions: LineDimension[]) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Internal: Per-type value selector
// ---------------------------------------------------------------------------

function DimensionTypeSection({
  dimType,
  selected,
  onSelect,
  onDeselect,
}: {
  dimType: DimensionType;
  selected: LineDimension[];
  onSelect: (value: DimensionValue) => void;
  onDeselect: (dimensionValueId: string) => void;
}) {
  const { data: values } = useDimensionValues(dimType.id);
  const activeValues = useMemo(() => (values ?? []).filter((v) => v.isActive), [values]);

  const selectedIds = useMemo(() => new Set(selected.map((d) => d.dimensionValueId)), [selected]);

  if (activeValues.length === 0) return null;

  // Single-select: use a Select dropdown
  if (dimType.singleSelect) {
    const currentValue = selected[0]?.dimensionValueId ?? '';

    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{dimType.name}</Label>
        <Select
          value={currentValue}
          onValueChange={(valId) => {
            if (valId === '__clear__') {
              // Deselect current
              if (currentValue) onDeselect(currentValue);
              return;
            }
            const found = activeValues.find((v) => v.id === valId);
            if (found) onSelect(found);
          }}
        >
          <SelectTrigger size="sm" className="h-8 text-sm">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {currentValue && (
              <SelectItem value="__clear__" className="text-muted-foreground italic">
                Clear selection
              </SelectItem>
            )}
            {activeValues.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                <span className="font-mono text-xs">{v.code}</span>{' '}
                <span className="text-muted-foreground">{v.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Multi-select: use checkboxes
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{dimType.name}</Label>
      <div className="max-h-36 space-y-1 overflow-y-auto">
        {activeValues.map((v) => {
          const isChecked = selectedIds.has(v.id);
          return (
            <label
              key={v.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onSelect(v);
                  } else {
                    onDeselect(v.id);
                  }
                }}
              />
              <span className="font-mono text-xs">{v.code}</span>
              <span className="truncate text-muted-foreground">{v.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DimensionPicker
// ---------------------------------------------------------------------------

export function DimensionPicker({ dimensions, onChange, readOnly }: DimensionPickerProps) {
  const { data: dimensionTypes } = useDimensionTypes({ isActive: true });

  const activeTypes = useMemo(
    () =>
      (dimensionTypes ?? []).filter((dt) => dt.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [dimensionTypes],
  );

  // Group current dimensions by type id
  const dimsByType = useMemo(() => {
    const map = new Map<string, LineDimension[]>();
    for (const d of dimensions) {
      const typeId = d.dimensionTypeId ?? '';
      if (!map.has(typeId)) map.set(typeId, []);
      map.get(typeId)!.push(d);
    }
    return map;
  }, [dimensions]);

  const handleSelect = useCallback(
    (dimType: DimensionType, value: DimensionValue) => {
      let updated: LineDimension[];

      if (dimType.singleSelect) {
        // Replace any existing for this type
        updated = dimensions.filter((d) => d.dimensionTypeId !== dimType.id);
      } else {
        // Add (but don't duplicate)
        if (dimensions.some((d) => d.dimensionValueId === value.id)) return;
        updated = [...dimensions];
      }

      updated.push({
        dimensionValueId: value.id,
        dimensionValueCode: value.code,
        dimensionValueName: value.name,
        dimensionTypeCode: dimType.code,
        dimensionTypeName: dimType.name,
        dimensionTypeId: dimType.id,
        singleSelect: dimType.singleSelect,
      });

      onChange(updated);
    },
    [dimensions, onChange],
  );

  const handleDeselect = useCallback(
    (dimensionValueId: string) => {
      onChange(dimensions.filter((d) => d.dimensionValueId !== dimensionValueId));
    },
    [dimensions, onChange],
  );

  // No dimension types configured — don't render
  if (activeTypes.length === 0)
    return <span className="text-xs text-muted-foreground">{'\u2014'}</span>;

  // Read-only: show comma-separated names
  if (readOnly) {
    if (dimensions.length === 0) {
      return <span className="text-xs text-muted-foreground">{'\u2014'}</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {dimensions.map((d) => (
          <Badge key={d.dimensionValueId} variant="secondary" className="text-[10px] px-1.5 py-0">
            {d.dimensionValueName ?? d.dimensionValueCode ?? d.dimensionValueId.slice(0, 8)}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center gap-1 rounded-md border border-transparent bg-transparent px-1.5 text-left text-sm hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {dimensions.length === 0 ? (
            <Tags className="size-3.5 text-muted-foreground" />
          ) : (
            <div className="flex flex-wrap gap-0.5 overflow-hidden">
              {dimensions.map((d) => (
                <Badge
                  key={d.dimensionValueId}
                  variant="secondary"
                  className="text-[10px] px-1 py-0 max-w-[80px] truncate"
                >
                  {d.dimensionValueCode ?? d.dimensionValueName ?? '?'}
                </Badge>
              ))}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Dimensions</span>
            {dimensions.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={() => onChange([])}
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Selected dimension badges with remove buttons */}
          {dimensions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {dimensions.map((d) => (
                <Badge
                  key={d.dimensionValueId}
                  variant="secondary"
                  className="gap-1 pr-0.5 text-xs"
                >
                  <span className="max-w-[100px] truncate">
                    {d.dimensionValueName ?? d.dimensionValueCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeselect(d.dimensionValueId)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                    aria-label={`Remove ${d.dimensionValueName ?? d.dimensionValueCode}`}
                  >
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Per-type sections */}
          {activeTypes.map((dt) => (
            <DimensionTypeSection
              key={dt.id}
              dimType={dt}
              selected={dimsByType.get(dt.id) ?? []}
              onSelect={(value) => handleSelect(dt, value)}
              onDeselect={handleDeselect}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
