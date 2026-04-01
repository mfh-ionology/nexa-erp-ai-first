/* eslint-disable i18next/no-literal-string */
/**
 * DimensionSplitModal — Modal for splitting a budget line
 * by dimension values across 12 periods.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, SplitSquareVertical } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiPut, apiDelete } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

import { useDimensionTypes, useDimensionValues } from '../dimensions/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIOD_LABELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SplitRow {
  dimensionValueId: string;
  dimensionValueName: string;
  amounts: number[]; // 12 periods
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DimensionSplitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  lineId: string;
  /** Parent line period amounts (12 values) for validation */
  parentAmounts: number[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DimensionSplitModal({
  open,
  onOpenChange,
  budgetId,
  lineId,
  parentAmounts,
}: DimensionSplitModalProps) {
  const { t } = useI18n('finance');
  const queryClient = useQueryClient();

  const { data: dimensionTypes } = useDimensionTypes({ isActive: true });
  const [selectedTypeId, setSelectedTypeId] = useState('');

  const { data: dimensionValues } = useDimensionValues(selectedTypeId || undefined);
  const activeValues = (dimensionValues ?? []).filter((v) => v.isActive);

  const [splits, setSplits] = useState<SplitRow[]>([]);

  // Initialize split rows when dimension values load
  useEffect(() => {
    if (activeValues.length > 0 && selectedTypeId) {
      setSplits(
        activeValues.map((v) => ({
          dimensionValueId: v.id,
          dimensionValueName: `${v.code} - ${v.name}`,
          amounts: new Array(12).fill(0),
        })),
      );
    }
  }, [activeValues, selectedTypeId]);

  // Calculate period totals
  const periodTotals = useMemo(() => {
    return PERIOD_LABELS.map((_, idx) => {
      let total = 0;
      for (const row of splits) {
        total += row.amounts[idx] ?? 0;
      }
      return Math.round(total * 100) / 100;
    });
  }, [splits]);

  // Check if totals match parent amounts
  const mismatches = useMemo(() => {
    return periodTotals.map((total, idx) => {
      const parent = parentAmounts[idx] ?? 0;
      return Math.abs(total - parent) > 0.01;
    });
  }, [periodTotals, parentAmounts]);

  const hasMismatches = mismatches.some(Boolean);

  const handleCellChange = useCallback((rowIdx: number, periodIdx: number, value: string) => {
    setSplits((prev) => {
      const next = [...prev];
      const existing = next[rowIdx];
      if (!existing) return next;
      const amounts = [...existing.amounts];
      amounts[periodIdx] = parseFloat(value) || 0;
      next[rowIdx] = { ...existing, amounts };
      return next;
    });
  }, []);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        dimensionTypeId: selectedTypeId,
        splits: splits.map((s) => ({
          dimensionValueId: s.dimensionValueId,
          amounts: s.amounts.map((a, idx) => ({
            period: idx + 1,
            amount: a,
          })),
        })),
      };
      await apiPut(
        `/finance/budgets/${encodeURIComponent(budgetId)}/lines/${encodeURIComponent(lineId)}/dimension-splits`,
        payload,
      );
    },
    onSuccess: () => {
      toast.success(t('budgets.dimensionSplit.toast.saved'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.budget(budgetId),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('budgets.dimensionSplit.toast.saveFailed'));
    },
  });

  // Clear mutation
  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiDelete(
        `/finance/budgets/${encodeURIComponent(budgetId)}/lines/${encodeURIComponent(lineId)}/dimension-splits/${encodeURIComponent(selectedTypeId)}`,
      );
    },
    onSuccess: () => {
      toast.success(t('budgets.dimensionSplit.toast.cleared'));
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.budget(budgetId),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('budgets.dimensionSplit.toast.clearFailed'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SplitSquareVertical className="size-5 text-[#7c3aed]" />
            {t('budgets.dimensionSplit.title')}
          </DialogTitle>
          <DialogDescription>{t('budgets.dimensionSplit.description')}</DialogDescription>
        </DialogHeader>

        {/* Dimension type selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t('budgets.dimensionSplit.selectType')}</label>
          <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select dimension type" />
            </SelectTrigger>
            <SelectContent>
              {(dimensionTypes ?? []).map((dt) => (
                <SelectItem key={dt.id} value={dt.id}>
                  {dt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Parent line reference */}
        {selectedTypeId && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {t('budgets.dimensionSplit.parentAmounts')}
            </p>
            <div className="flex gap-2 overflow-x-auto">
              {PERIOD_LABELS.map((label, idx) => (
                <div key={label} className="text-center min-w-[60px]">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="font-mono text-xs tabular-nums">
                    {(parentAmounts[idx] ?? 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Split table */}
        {selectedTypeId && splits.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-background min-w-[180px]">
                    {t('budgets.dimensionSplit.column.dimensionValue')}
                  </TableHead>
                  {PERIOD_LABELS.map((label) => (
                    <TableHead key={label} className="text-right min-w-[80px]">
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {splits.map((row, rowIdx) => (
                  <TableRow key={row.dimensionValueId}>
                    <TableCell className="sticky left-0 z-10 bg-background text-sm font-medium">
                      {row.dimensionValueName}
                    </TableCell>
                    {PERIOD_LABELS.map((_, periodIdx) => (
                      <TableCell key={periodIdx} className="p-1 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={row.amounts[periodIdx] || ''}
                          onChange={(e) => handleCellChange(rowIdx, periodIdx, e.target.value)}
                          className="h-7 text-right font-mono text-xs tabular-nums w-20"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-muted font-bold text-sm">
                    Totals
                  </TableCell>
                  {periodTotals.map((total, idx) => (
                    <TableCell
                      key={idx}
                      className={`text-right font-mono text-xs font-bold tabular-nums ${
                        mismatches[idx]
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {total.toFixed(2)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {selectedTypeId && splits.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            {t('budgets.dimensionSplit.noValues')}
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || !selectedTypeId}
          >
            {clearMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('budgets.dimensionSplit.clear')}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !selectedTypeId || hasMismatches}
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t('budgets.dimensionSplit.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
