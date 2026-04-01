/* eslint-disable i18next/no-literal-string */
/**
 * DimensionFilter — cascading type/value dropdowns for report parameter forms.
 *
 * Fetches dimension types via GET /finance/dimensions/types,
 * then values via GET /finance/dimensions/types/:id/values.
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DimensionType {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface DimensionValue {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface DimensionFilterValue {
  dimensionTypeId: string | null;
  dimensionValueId: string | null;
}

interface DimensionFilterProps {
  value: DimensionFilterValue;
  onChange: (value: DimensionFilterValue) => void;
  label?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useDimensionTypes() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['finance', 'dimension-types', 'active'],
    queryFn: async () => {
      const result = await apiGet<{ data: DimensionType[] }>(
        '/finance/dimensions/types?isActive=true',
      );
      return result.data.data ?? result.data;
    },
    enabled: isAuthenticated,
  });
}

function useDimensionValues(typeId: string | null) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['finance', 'dimension-values', typeId],
    queryFn: async () => {
      const result = await apiGet<{ data: DimensionValue[] }>(
        `/finance/dimensions/types/${typeId}/values?isActive=true`,
      );
      return result.data.data ?? result.data;
    },
    enabled: isAuthenticated && !!typeId,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionFilter({ value, onChange, label = 'Dimension' }: DimensionFilterProps) {
  const { data: types, isLoading: typesLoading } = useDimensionTypes();
  const { data: values, isLoading: valuesLoading } = useDimensionValues(value.dimensionTypeId);

  // Reset value when type changes
  const [prevTypeId, setPrevTypeId] = useState(value.dimensionTypeId);
  useEffect(() => {
    if (value.dimensionTypeId !== prevTypeId) {
      setPrevTypeId(value.dimensionTypeId);
      if (value.dimensionValueId) {
        onChange({ ...value, dimensionValueId: null });
      }
    }
  }, [value, prevTypeId, onChange]);

  const dimensionTypes = Array.isArray(types) ? types : [];
  const dimensionValues = Array.isArray(values) ? values : [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>{label} Type</Label>
        <Select
          value={value.dimensionTypeId ?? '_none'}
          onValueChange={(v) =>
            onChange({ dimensionTypeId: v === '_none' ? null : v, dimensionValueId: null })
          }
          disabled={typesLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All dimensions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">All dimensions</SelectItem>
            {dimensionTypes.map((dt) => (
              <SelectItem key={dt.id} value={dt.id}>
                {dt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.dimensionTypeId && (
        <div className="space-y-2">
          <Label>{label} Value</Label>
          <Select
            value={value.dimensionValueId ?? '_none'}
            onValueChange={(v) =>
              onChange({ ...value, dimensionValueId: v === '_none' ? null : v })
            }
            disabled={valuesLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All values" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">All values</SelectItem>
              {dimensionValues.map((dv) => (
                <SelectItem key={dv.id} value={dv.id}>
                  {dv.code} — {dv.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
