/* eslint-disable i18next/no-literal-string */
/**
 * FE9: VAT Return Detail Page — /finance/vat-returns/$id
 *
 * Uses T2 (RecordDetailPage) with 9-box display, calculate and submit actions.
 */

import { useCallback } from 'react';

import { RecordDetailPage } from '@/components/templates/record-detail-page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calculator, Send, Loader2 } from 'lucide-react';

import { useVatReturn, useCalculateVatReturn, useSubmitVatReturn } from '../hooks/use-vat-returns';

function formatCurrency(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface VatReturnDetailPageProps {
  id: string;
}

export function VatReturnDetailPage({ id }: VatReturnDetailPageProps) {
  const { vatReturn, isLoading } = useVatReturn(id);
  const calculateMutation = useCalculateVatReturn();
  const submitMutation = useSubmitVatReturn();

  const handleCalculate = useCallback(() => {
    calculateMutation.mutate(id);
  }, [calculateMutation, id]);

  const handleSubmit = useCallback(() => {
    submitMutation.mutate(id);
  }, [submitMutation, id]);

  const canCalculate = vatReturn?.status === 'DRAFT';
  const canSubmit = vatReturn?.status === 'CALCULATED';

  const actionBar = (
    <div className="flex items-center gap-2">
      {canCalculate && (
        <Button onClick={handleCalculate} disabled={calculateMutation.isPending} variant="outline">
          {calculateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Calculator className="size-4" />
          )}
          Calculate
        </Button>
      )}
      {canSubmit && (
        <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
          {submitMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Submit to HMRC
        </Button>
      )}
    </div>
  );

  const BOX_LABELS = [
    { key: 'box1', label: 'Box 1', description: 'VAT due on sales and other outputs' },
    { key: 'box2', label: 'Box 2', description: 'VAT due on acquisitions from EU' },
    { key: 'box3', label: 'Box 3', description: 'Total VAT due (Box 1 + Box 2)' },
    { key: 'box4', label: 'Box 4', description: 'VAT reclaimed on purchases and inputs' },
    { key: 'box5', label: 'Box 5', description: 'Net VAT to pay or reclaim (Box 3 - Box 4)' },
    { key: 'box6', label: 'Box 6', description: 'Total value of sales excl. VAT' },
    { key: 'box7', label: 'Box 7', description: 'Total value of purchases excl. VAT' },
    { key: 'box8', label: 'Box 8', description: 'Total value of EU supplies excl. VAT' },
    { key: 'box9', label: 'Box 9', description: 'Total value of EU acquisitions excl. VAT' },
  ] as const;

  const nineBoxContent = vatReturn ? (
    <div className="space-y-6">
      {/* Period info */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span>
          Period: {formatDate(vatReturn.periodStart)} - {formatDate(vatReturn.periodEnd)}
        </span>
        {vatReturn.submittedAt && <span>Submitted: {formatDate(vatReturn.submittedAt)}</span>}
        {vatReturn.hmrcCorrelationId && <span>HMRC Ref: {vatReturn.hmrcCorrelationId}</span>}
      </div>

      {/* 9-box grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BOX_LABELS.map((box) => {
          const value = vatReturn[box.key as keyof typeof vatReturn] as string;
          const isHighlight = box.key === 'box5';
          return (
            <Card
              key={box.key}
              className={
                isHighlight ? 'border-primary/50 bg-primary/5 sm:col-span-2 lg:col-span-1' : ''
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground">{box.label}</span>
                  <span className="font-mono text-lg font-bold tabular-nums">
                    {formatCurrency(value)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">{box.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary section */}
      <Separator />
      <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
        <div>
          <p className="text-sm font-medium">Net VAT Amount</p>
          <p className="text-xs text-muted-foreground">
            {Number(vatReturn.box5) >= 0 ? 'Amount to pay to HMRC' : 'Amount to reclaim from HMRC'}
          </p>
        </div>
        <span className="font-mono text-2xl font-bold tabular-nums">
          {formatCurrency(vatReturn.box5)}
        </span>
      </div>
    </div>
  ) : null;

  return (
    <RecordDetailPage
      title={
        vatReturn
          ? `VAT Return: ${formatDate(vatReturn.periodStart)} - ${formatDate(vatReturn.periodEnd)}`
          : 'VAT Return'
      }
      breadcrumbs={[
        { label: 'Finance', path: '/finance' },
        { label: 'VAT Returns', path: '/finance/vat-returns' },
        { label: 'Detail' },
      ]}
      entityType="vat-return"
      status={vatReturn?.status}
      isLoading={isLoading}
      actionBarSlot={actionBar}
      tabs={[
        {
          key: '9box',
          labelKey: '9-Box Return',
          content: nineBoxContent,
        },
      ]}
    />
  );
}
