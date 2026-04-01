/* eslint-disable i18next/no-literal-string */
/**
 * BudgetVersionFilter — dropdown to select budget version for variance reports.
 *
 * Fetches budget versions from GET /finance/budget-versions.
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

interface BudgetVersion {
  id: string;
  versionNumber: number;
  name: string;
  fiscalYear: number;
}

interface BudgetVersionFilterProps {
  value: string | null;
  onChange: (versionId: string | null) => void;
  fiscalYear?: number;
  label?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useBudgetVersions(fiscalYear?: number) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['finance', 'budget-versions', fiscalYear],
    queryFn: async () => {
      const qs = fiscalYear ? `?fiscalYear=${fiscalYear}` : '';
      const result = await apiGet<{ data: BudgetVersion[] }>(`/finance/budget-versions${qs}`);
      return result.data.data ?? result.data;
    },
    enabled: isAuthenticated,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetVersionFilter({
  value,
  onChange,
  fiscalYear,
  label = 'Budget Version',
}: BudgetVersionFilterProps) {
  const { data, isLoading } = useBudgetVersions(fiscalYear);
  const versions = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value ?? '_none'}
        onValueChange={(v) => onChange(v === '_none' ? null : v)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="All versions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">All versions</SelectItem>
          {versions.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              Version {v.versionNumber}: {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
