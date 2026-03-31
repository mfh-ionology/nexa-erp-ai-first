/* eslint-disable i18next/no-literal-string */
/**
 * FE14: Year-End Wizard Page — /finance/year-end
 *
 * Uses T6 (WizardPage) template. Multi-step wizard with validation
 * and close action.
 */

import { useState, useCallback, useMemo } from 'react';

import { WizardPage } from '@/components/templates/wizard-page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react';

import { useYearEndStatus, useCloseYearEnd } from '../hooks/use-year-end';

const CURRENT_YEAR = new Date().getFullYear();
const FISCAL_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const VALIDATION_ICONS: Record<string, React.ReactNode> = {
  passed: <CheckCircle className="size-5 text-emerald-600" />,
  failed: <XCircle className="size-5 text-red-600" />,
  warning: <AlertTriangle className="size-5 text-amber-500" />,
  pending: <Clock className="size-5 text-muted-foreground" />,
};

export function YearEndWizardPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR - 1);
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState('');

  const { yearEnd, isLoading } = useYearEndStatus(fiscalYear);
  const closeMutation = useCloseYearEnd();

  const handleClose = useCallback(() => {
    if (!retainedEarningsAccountId) return;
    closeMutation.mutate({ fiscalYear, retainedEarningsAccountId });
  }, [closeMutation, fiscalYear, retainedEarningsAccountId]);

  const allValidationsPassed = useMemo(() => {
    if (!yearEnd?.validations) return false;
    return yearEnd.validations.every((v) => v.status === 'passed' || v.status === 'warning');
  }, [yearEnd]);

  const steps = useMemo(
    () => [
      {
        key: 'select-year',
        labelKey: 'Select Fiscal Year',
        descriptionKey: 'Choose the fiscal year to close',
        content: (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Fiscal Year</Label>
              <Select value={String(fiscalYear)} onValueChange={(v) => setFiscalYear(Number(v))}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FISCAL_YEARS.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {yearEnd && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Current Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant={
                      yearEnd.status === 'COMPLETED'
                        ? 'default'
                        : yearEnd.status === 'FAILED'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {yearEnd.status}
                  </Badge>
                  {yearEnd.closedAt && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Closed on {new Date(yearEnd.closedAt).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ),
      },
      {
        key: 'validations',
        labelKey: 'Validation Checks',
        descriptionKey: 'Review pre-close validation results',
        content: (
          <div className="space-y-3">
            {yearEnd?.validations?.map((validation) => (
              <div key={validation.step} className="flex items-start gap-3 rounded-lg border p-4">
                <div className="mt-0.5">{VALIDATION_ICONS[validation.status]}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{validation.labelKey}</p>
                  {validation.message && (
                    <p className="mt-1 text-xs text-muted-foreground">{validation.message}</p>
                  )}
                </div>
                <Badge
                  variant={
                    validation.status === 'passed'
                      ? 'default'
                      : validation.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {validation.status}
                </Badge>
              </div>
            )) ?? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No validation data available. Select a fiscal year first.
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'confirm',
        labelKey: 'Confirm & Close',
        descriptionKey: 'Configure retained earnings and close the year',
        content: (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Retained Earnings Account ID</Label>
              <Select
                value={retainedEarningsAccountId}
                onValueChange={setRetainedEarningsAccountId}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retained-earnings-default">
                    3000 - Retained Earnings
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Net profit/loss will be posted to this account.
              </p>
            </div>

            {!allValidationsPassed && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-800">
                    Some validations have not passed. Review them before closing.
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleClose}
              disabled={
                closeMutation.isPending || !retainedEarningsAccountId || !allValidationsPassed
              }
              size="lg"
              className="w-full"
            >
              {closeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Close Fiscal Year {fiscalYear}
            </Button>
          </div>
        ),
      },
    ],
    [
      fiscalYear,
      yearEnd,
      retainedEarningsAccountId,
      allValidationsPassed,
      handleClose,
      closeMutation.isPending,
    ],
  );

  return (
    <WizardPage
      title="Year-End Close"
      subtitle={`Fiscal Year ${fiscalYear}`}
      breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'Year-End Close' }]}
      isLoading={isLoading}
      steps={steps}
      activeStep={activeStep}
      onNext={() => setActiveStep((s) => Math.min(s + 1, steps.length - 1))}
      onBack={() => setActiveStep((s) => Math.max(s - 1, 0))}
      isCurrentStepValid={
        activeStep === 0
          ? true
          : activeStep === 1
            ? allValidationsPassed
            : !!retainedEarningsAccountId
      }
    />
  );
}
