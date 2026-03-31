/* eslint-disable i18next/no-literal-string */
/**
 * FE10: Budget Detail Page — /finance/budgets/$id
 *
 * Uses T2 (RecordDetailPage) with 12-period spreadsheet-like grid.
 * Approve and Copy actions available.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { RecordDetailPage } from '@/components/templates/record-detail-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { CheckCircle, Copy, Loader2 } from 'lucide-react';

import { useBudget, useUpdateBudget, useApproveBudget, useCopyBudget } from '../hooks/use-budgets';
import type { BudgetLine, BudgetPeriodAmount } from '../types';

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

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(num);
}

interface BudgetDetailPageProps {
  id: string;
}

export function BudgetDetailPage({ id }: BudgetDetailPageProps) {
  const navigate = useNavigate();
  const { budget, isLoading } = useBudget(id);
  const updateMutation = useUpdateBudget();
  const approveMutation = useApproveBudget();
  const copyMutation = useCopyBudget();
  const [editedCells, setEditedCells] = useState<Record<string, string>>({});

  const isDraft = budget?.status === 'DRAFT';

  const handleCellChange = useCallback((accountId: string, period: number, value: string) => {
    setEditedCells((prev) => ({
      ...prev,
      [`${accountId}-${period}`]: value,
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (!budget) return;
    const lineMap = new Map<string, BudgetPeriodAmount[]>();

    for (const line of budget.lines) {
      const periods = line.periods.map((p) => {
        const editKey = `${line.accountId}-${p.period}`;
        const edited = editedCells[editKey];
        return {
          period: p.period,
          amount: edited !== undefined ? edited : p.amount,
        };
      });
      lineMap.set(line.accountId, periods);
    }

    const lines = Array.from(lineMap.entries()).map(([accountId, periods]) => ({
      accountId,
      periods,
    }));

    updateMutation.mutate({ id, input: { lines } });
    setEditedCells({});
  }, [budget, editedCells, id, updateMutation]);

  const handleApprove = useCallback(() => {
    approveMutation.mutate(id);
  }, [approveMutation, id]);

  const handleCopy = useCallback(() => {
    copyMutation.mutate(id, {
      onSuccess: (data) => {
        void navigate({ to: '/finance/budgets/$id', params: { id: data.id } });
      },
    });
  }, [copyMutation, id, navigate]);

  const hasEdits = Object.keys(editedCells).length > 0;

  const actionBar = (
    <div className="flex items-center gap-2">
      {isDraft && hasEdits && (
        <Button onClick={handleSave} disabled={updateMutation.isPending} variant="outline">
          {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Save Changes
        </Button>
      )}
      {isDraft && (
        <Button onClick={handleApprove} disabled={approveMutation.isPending}>
          {approveMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle className="size-4" />
          )}
          Approve
        </Button>
      )}
      <Button onClick={handleCopy} disabled={copyMutation.isPending} variant="outline">
        {copyMutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Copy className="size-4" />
        )}
        Copy Budget
      </Button>
    </div>
  );

  // Calculate period totals
  const periodTotals = PERIOD_LABELS.map((_, idx) => {
    const period = idx + 1;
    let total = 0;
    for (const line of budget?.lines ?? []) {
      const editKey = `${line.accountId}-${period}`;
      const edited = editedCells[editKey];
      const amount =
        edited !== undefined
          ? Number(edited)
          : Number(line.periods.find((p) => p.period === period)?.amount ?? 0);
      if (!Number.isNaN(amount)) total += amount;
    }
    return total;
  });

  const grandTotal = periodTotals.reduce((sum, t) => sum + t, 0);

  const gridContent = budget ? (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background min-w-[200px]">
              Account
            </TableHead>
            {PERIOD_LABELS.map((label) => (
              <TableHead key={label} className="text-right min-w-[100px]">
                {label}
              </TableHead>
            ))}
            <TableHead className="text-right min-w-[120px] font-bold">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budget.lines.map((line: BudgetLine) => {
            let lineTotal = 0;
            return (
              <TableRow key={line.id}>
                <TableCell className="sticky left-0 z-10 bg-background">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {line.accountCode}
                    </span>
                    <span className="ml-2 text-sm">{line.accountName}</span>
                  </div>
                </TableCell>
                {PERIOD_LABELS.map((_, idx) => {
                  const period = idx + 1;
                  const periodData = line.periods.find((p) => p.period === period);
                  const editKey = `${line.accountId}-${period}`;
                  const currentValue = editedCells[editKey] ?? periodData?.amount ?? '0';
                  const numValue = Number(currentValue);
                  if (!Number.isNaN(numValue)) lineTotal += numValue;

                  return (
                    <TableCell key={period} className="p-1 text-right">
                      {isDraft ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={currentValue}
                          onChange={(e) => handleCellChange(line.accountId, period, e.target.value)}
                          className="h-8 text-right font-mono text-sm tabular-nums"
                        />
                      ) : (
                        <span className="font-mono text-sm tabular-nums">
                          {formatCurrency(currentValue)}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right font-mono text-sm font-bold tabular-nums">
                  {formatCurrency(lineTotal)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-muted font-bold">Total</TableCell>
            {periodTotals.map((total, idx) => (
              <TableCell key={idx} className="text-right font-mono text-sm font-bold tabular-nums">
                {formatCurrency(total)}
              </TableCell>
            ))}
            <TableCell className="text-right font-mono text-sm font-bold tabular-nums">
              {formatCurrency(grandTotal)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  ) : null;

  return (
    <RecordDetailPage
      title={budget?.name ?? 'Budget'}
      subtitle={budget ? `FY ${budget.fiscalYear}` : undefined}
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'Budgets', path: '/finance/budgets' },
        { label: budget?.name ?? 'Detail' },
      ]}
      entityType="budget"
      status={budget?.status}
      isLoading={isLoading}
      actionBarSlot={actionBar}
      tabs={[
        {
          key: 'grid',
          labelKey: 'Period Grid',
          content: gridContent,
        },
      ]}
    />
  );
}
