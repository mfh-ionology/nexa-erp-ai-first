/* eslint-disable i18next/no-literal-string */
/**
 * DimensionGroupBy — dropdown for grouping reports by dimension type.
 *
 * Shows "No grouping" (default) + each active dimension type.
 * Used in P&L, Trial Balance, and Budget Variance pages to switch
 * between standard and dimension-pivoted views.
 */

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

export interface DimensionGroupByProps {
  /** dimensionTypeId or null for "No grouping" */
  value: string | null;
  onChange: (dimensionTypeId: string | null) => void;
  label?: string;
}

// ---------------------------------------------------------------------------
// Hook
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionGroupBy({
  value,
  onChange,
  label = 'Group by Dimension',
}: DimensionGroupByProps) {
  const { data: types, isLoading } = useDimensionTypes();
  const dimensionTypes = Array.isArray(types) ? types : [];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value ?? '_none'}
        onValueChange={(v) => onChange(v === '_none' ? null : v)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="No grouping" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">No grouping</SelectItem>
          {dimensionTypes.map((dt) => (
            <SelectItem key={dt.id} value={dt.id}>
              {dt.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
