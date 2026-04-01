/* eslint-disable i18next/no-literal-string */
/**
 * DimensionPicker — Grid-style dimension selector for journal/simulation lines.
 *
 * Shows one row per active dimension type. When an account is selected,
 * fetches that account's mandatory dimensions and highlights them in red.
 * Each type shows a single-select dropdown (journal lines always use single-select).
 */

import { useCallback, useMemo } from 'react';
import { Tags, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useMandatoryDimensions } from '../dimensions/api';
import type { DimensionType, DimensionValue } from '../dimensions/api';
import { cn } from '@/lib/utils';

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
  /** The chart-of-account ID for the selected account on this line. Used to fetch mandatory dimensions. */
  accountId?: string | null;
}

// ---------------------------------------------------------------------------
// Internal: Per-type value selector row
// ---------------------------------------------------------------------------

function DimensionTypeRow({
  dimType,
  selected,
  onSelect,
  onDeselect,
  isMandatory,
}: {
  dimType: DimensionType;
  selected: LineDimension[];
  onSelect: (value: DimensionValue) => void;
  onDeselect: (dimensionValueId: string) => void;
  isMandatory: boolean;
}) {
  const { data: values } = useDimensionValues(dimType.id);
  const activeValues = useMemo(() => (values ?? []).filter((v) => v.isActive), [values]);

  const currentValue = selected[0]?.dimensionValueId ?? '';

  if (activeValues.length === 0) return null;

  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
      <Label
        className={cn(
          'text-xs font-medium truncate',
          isMandatory ? 'text-red-600 font-semibold' : 'text-muted-foreground',
        )}
        title={isMandatory ? `${dimType.name} (required)` : dimType.name}
      >
        {dimType.name}
        {isMandatory && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <Select
        value={currentValue}
        onValueChange={(valId) => {
          if (valId === '__clear__') {
            if (currentValue) onDeselect(currentValue);
            return;
          }
          const found = activeValues.find((v) => v.id === valId);
          if (found) onSelect(found);
        }}
      >
        <SelectTrigger size="sm" className="h-7 text-xs">
          <SelectValue placeholder={isMandatory ? 'Required...' : 'Select...'} />
        </SelectTrigger>
        <SelectContent>
          {currentValue && (
            <SelectItem value="__clear__" className="text-muted-foreground italic text-xs">
              Clear
            </SelectItem>
          )}
          {activeValues.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              <span className="font-mono text-xs">{v.code}</span>{' '}
              <span className="text-muted-foreground text-xs">{v.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DimensionPicker
// ---------------------------------------------------------------------------

export function DimensionPicker({
  dimensions,
  onChange,
  readOnly,
  accountId,
}: DimensionPickerProps) {
  const { data: dimensionTypes } = useDimensionTypes({ isActive: true });
  const { data: mandatoryDims } = useMandatoryDimensions(accountId ?? undefined);

  const activeTypes = useMemo(
    () =>
      (dimensionTypes ?? []).filter((dt) => dt.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [dimensionTypes],
  );

  // Set of dimension type IDs that are mandatory for this account
  const mandatoryTypeIds = useMemo(() => {
    if (!mandatoryDims) return new Set<string>();
    return new Set(mandatoryDims.map((md) => md.dimensionTypeId));
  }, [mandatoryDims]);

  // Sort: mandatory types first, then by sort order
  const sortedTypes = useMemo(() => {
    return [...activeTypes].sort((a, b) => {
      const aMandatory = mandatoryTypeIds.has(a.id) ? 0 : 1;
      const bMandatory = mandatoryTypeIds.has(b.id) ? 0 : 1;
      if (aMandatory !== bMandatory) return aMandatory - bMandatory;
      return a.sortOrder - b.sortOrder;
    });
  }, [activeTypes, mandatoryTypeIds]);

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
      // Always single-select for journal lines: replace any existing for this type
      const updated = dimensions.filter((d) => d.dimensionTypeId !== dimType.id);

      updated.push({
        dimensionValueId: value.id,
        dimensionValueCode: value.code,
        dimensionValueName: value.name,
        dimensionTypeCode: dimType.code,
        dimensionTypeName: dimType.name,
        dimensionTypeId: dimType.id,
        singleSelect: true,
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
            <Tags
              className={cn(
                'size-3.5',
                mandatoryTypeIds.size > 0 ? 'text-red-500' : 'text-muted-foreground',
              )}
            />
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
      <PopoverContent className="w-80 p-3" align="start">
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

          {/* Dimension type grid — one row per type */}
          <div className="space-y-2">
            {sortedTypes.map((dt) => (
              <DimensionTypeRow
                key={dt.id}
                dimType={dt}
                selected={dimsByType.get(dt.id) ?? []}
                onSelect={(value) => handleSelect(dt, value)}
                onDeselect={handleDeselect}
                isMandatory={mandatoryTypeIds.has(dt.id)}
              />
            ))}
          </div>

          {mandatoryTypeIds.size > 0 && (
            <p className="text-[10px] text-red-500 mt-1">
              * Required dimension types must have a value before saving
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
