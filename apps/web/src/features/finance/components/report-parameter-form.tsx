/* eslint-disable i18next/no-literal-string */
/**
 * Shared report parameter form for financial reports (FE6).
 *
 * Parameters: fiscalYear, periodFrom, periodTo
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

import type { ReportParams } from '../types';

interface ReportParameterFormProps {
  params: ReportParams;
  onChange: (params: ReportParams) => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const FISCAL_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const PERIODS = Array.from({ length: 12 }, (_, i) => i + 1);

const PERIOD_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function ReportParameterForm({ params, onChange }: ReportParameterFormProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Fiscal Year */}
      <div className="space-y-2">
        <Label>Fiscal Year</Label>
        <Select
          value={String(params.fiscalYear)}
          onValueChange={(v) => onChange({ ...params, fiscalYear: Number(v) })}
        >
          <SelectTrigger className="w-full">
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

      {/* Period From */}
      <div className="space-y-2">
        <Label>Period From</Label>
        <Select
          value={String(params.periodFrom)}
          onValueChange={(v) => onChange({ ...params, periodFrom: Number(v) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p} value={String(p)}>
                {p} — {PERIOD_NAMES[p - 1]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Period To */}
      <div className="space-y-2">
        <Label>Period To</Label>
        <Select
          value={String(params.periodTo)}
          onValueChange={(v) => onChange({ ...params, periodTo: Number(v) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p} value={String(p)}>
                {p} — {PERIOD_NAMES[p - 1]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
