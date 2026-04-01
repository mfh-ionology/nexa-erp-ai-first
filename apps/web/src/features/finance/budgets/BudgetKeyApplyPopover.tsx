/* eslint-disable i18next/no-literal-string */
/**
 * BudgetKeyApplyPopover — Select a budget key and annual amount,
 * preview the 12-period distribution, and apply it to a budget line.
 */

import { useCallback, useMemo, useState } from 'react';
import { Key } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BudgetKey {
  id: string;
  name: string;
  description: string | null;
  percentages: number[]; // 12 values summing to 100
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function listBudgetKeys(): Promise<BudgetKey[]> {
  const result = await apiGet<BudgetKey[]>('/finance/budget-keys');
  return result.data;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useBudgetKeys() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.finance.budgetKeys(),
    queryFn: () => listBudgetKeys(),
    enabled: isAuthenticated,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PERIOD_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface BudgetKeyApplyPopoverProps {
  onApply: (amounts: number[]) => void;
}

export function BudgetKeyApplyPopover({ onApply }: BudgetKeyApplyPopoverProps) {
  const { t } = useI18n('finance');
  const { data: keys } = useBudgetKeys();
  const [open, setOpen] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [annualAmount, setAnnualAmount] = useState('');

  const activeKeys = (keys ?? []).filter((k) => k.isActive);

  const selectedKey = activeKeys.find((k) => k.id === selectedKeyId);

  // Preview calculation (client-side from percentages)
  const preview = useMemo(() => {
    if (!selectedKey || !annualAmount) return null;
    const annual = parseFloat(annualAmount);
    if (isNaN(annual) || annual <= 0) return null;

    return selectedKey.percentages.map((pct) => Math.round(((annual * pct) / 100) * 100) / 100);
  }, [selectedKey, annualAmount]);

  const handleApply = useCallback(() => {
    if (!preview) return;
    onApply(preview);
    setOpen(false);
    setSelectedKeyId('');
    setAnnualAmount('');
  }, [preview, onApply]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-[#7c3aed]"
          aria-label={t('budgets.action.applyKey')}
        >
          <Key className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold">{t('budgets.budgetKey.title')}</h4>
            <p className="text-xs text-muted-foreground">{t('budgets.budgetKey.description')}</p>
          </div>

          {/* Budget Key selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('budgets.budgetKey.selectKey')}</Label>
            <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select a budget key" />
              </SelectTrigger>
              <SelectContent>
                {activeKeys.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Annual amount */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('budgets.budgetKey.annualAmount')}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={annualAmount}
              onChange={(e) => setAnnualAmount(e.target.value)}
              placeholder="0.00"
              className="h-8 text-sm font-mono"
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-1">
              <Label className="text-xs">{t('budgets.budgetKey.preview')}</Label>
              <div className="grid grid-cols-4 gap-1 text-xs">
                {PERIOD_LABELS.map((label, idx) => (
                  <div
                    key={label}
                    className="rounded border border-border/50 bg-muted/30 px-1.5 py-1 text-center"
                  >
                    <div className="text-muted-foreground">{label}</div>
                    <div className="font-mono tabular-nums">{(preview[idx] ?? 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Apply button */}
          <Button size="sm" className="w-full" disabled={!preview} onClick={handleApply}>
            {t('budgets.budgetKey.apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
