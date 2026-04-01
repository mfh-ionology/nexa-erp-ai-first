/* eslint-disable i18next/no-literal-string */
/**
 * BudgetVersionSelector — LOV dropdown for budget versions.
 *
 * Populated from GET /finance/budget-versions?fiscalYear={selectedYear}
 * Shows: "Version {number}: {name}"
 */

import { useI18n } from '@nexa/i18n';
import { useQuery } from '@tanstack/react-query';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { apiGet, buildQueryString } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BudgetVersion {
  id: string;
  fiscalYear: number;
  versionNumber: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function listBudgetVersions(fiscalYear?: number): Promise<BudgetVersion[]> {
  const qs = buildQueryString(fiscalYear ? ({ fiscalYear } as Record<string, unknown>) : {});
  const result = await apiGet<BudgetVersion[]>(`/finance/budget-versions${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBudgetVersions(fiscalYear?: number) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.budgetVersions(fiscalYear),
    queryFn: () => listBudgetVersions(fiscalYear),
    enabled: isAuthenticated && !!fiscalYear,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BudgetVersionSelectorProps {
  fiscalYear?: number;
  value: string;
  onChange: (versionId: string) => void;
  disabled?: boolean;
}

export function BudgetVersionSelector({
  fiscalYear,
  value,
  onChange,
  disabled,
}: BudgetVersionSelectorProps) {
  const { t } = useI18n('finance');
  const { data: versions, isLoading } = useBudgetVersions(fiscalYear);

  const activeVersions = (versions ?? []).filter((v) => v.isActive);

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{t('budgets.field.version')}</Label>
      <Select
        value={value || '_none_'}
        onValueChange={(val) => onChange(val === '_none_' ? '' : val)}
        disabled={disabled || isLoading || activeVersions.length === 0}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder={t('budgets.field.versionPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none_">{t('budgets.field.noVersion')}</SelectItem>
          {activeVersions.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              Version {v.versionNumber}: {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
