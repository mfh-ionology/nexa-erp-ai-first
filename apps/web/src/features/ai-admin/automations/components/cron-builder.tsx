/* eslint-disable i18next/no-literal-string */
/**
 * CronBuilder — Visual cron expression builder with bidirectional raw input sync.
 *
 * AC-2: Scheduled trigger configuration with cron fields, presets,
 * human-readable preview, raw input, timezone selector, and validation.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CronBuilderProps {
  value: string;
  onChange: (cron: string) => void;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  error?: string | null;
}

interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DAY_OF_WEEK_LABELS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
] as const;

const MONTH_LABELS: Record<string, string> = {
  '1': 'Jan',
  '2': 'Feb',
  '3': 'Mar',
  '4': 'Apr',
  '5': 'May',
  '6': 'Jun',
  '7': 'Jul',
  '8': 'Aug',
  '9': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Dec',
};

const PRESETS: { label: string; cron: string }[] = [
  { label: 'Every minute', cron: '* * * * *' },
  { label: 'Hourly', cron: '0 * * * *' },
  { label: 'Daily at midnight', cron: '0 0 * * *' },
  { label: 'Weekdays at 9 AM', cron: '0 9 * * 1-5' },
  { label: 'Weekly on Monday', cron: '0 0 * * 1' },
  { label: 'Monthly on 1st', cron: '0 0 1 * *' },
];

const COMMON_TIMEZONES = [
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Dublin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Zurich',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

// ─── Cron Parsing Utilities ─────────────────────────────────────────────────

function parseCronToFields(cron: string): CronFields | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  // After length check, all 5 indices are guaranteed
  return {
    minute: parts[0]!,
    hour: parts[1]!,
    dayOfMonth: parts[2]!,
    month: parts[3]!,
    dayOfWeek: parts[4]!,
  };
}

function fieldsToCron(fields: CronFields): string {
  return `${fields.minute} ${fields.hour} ${fields.dayOfMonth} ${fields.month} ${fields.dayOfWeek}`;
}

/**
 * Validate a cron expression (basic structural check).
 * Returns null if valid, or an error message string.
 */
function validateCron(cron: string): string | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return 'Cron expression must have exactly 5 fields';
  }
  if (!isValidCronField(parts[0]!, 0, 59)) return 'Invalid minute field';
  if (!isValidCronField(parts[1]!, 0, 23)) return 'Invalid hour field';
  if (!isValidCronField(parts[2]!, 1, 31)) return 'Invalid day-of-month field';
  if (!isValidCronField(parts[3]!, 1, 12)) return 'Invalid month field';
  if (!isValidCronField(parts[4]!, 0, 7)) return 'Invalid day-of-week field';
  return null;
}

function isValidCronField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;
  // Step values: */N or N/N
  if (field.includes('/')) {
    const slashParts = field.split('/');
    const base = slashParts[0] ?? '';
    const step = slashParts[1] ?? '';
    if (!step || isNaN(Number(step)) || Number(step) < 1) return false;
    if (base === '*') return true;
    return isValidCronField(base, min, max);
  }
  // Ranges: N-N
  if (field.includes('-') && !field.includes(',')) {
    const dashParts = field.split('-');
    const s = Number(dashParts[0]);
    const e = Number(dashParts[1]);
    return !isNaN(s) && !isNaN(e) && s >= min && e <= max && s <= e;
  }
  // Lists: N,N,N
  if (field.includes(',')) {
    return field.split(',').every((part) => isValidCronField(part.trim(), min, max));
  }
  // Single value
  const n = Number(field);
  return !isNaN(n) && n >= min && n <= max;
}

/**
 * Convert a cron expression to a human-readable string.
 */
export function cronToHumanReadable(cron: string): string {
  const fields = parseCronToFields(cron);
  if (!fields) return 'Invalid cron expression';
  if (validateCron(cron) !== null) return 'Invalid cron expression';

  const { minute, hour, dayOfMonth, month, dayOfWeek } = fields;

  const parts: string[] = [];

  // Time portion
  parts.push(describeTime(minute, hour));

  // Day-of-month constraint
  if (dayOfMonth !== '*') {
    parts.push(describeDayOfMonth(dayOfMonth));
  }

  // Month constraint
  if (month !== '*') {
    parts.push(describeMonth(month));
  }

  // Day-of-week constraint
  if (dayOfWeek !== '*') {
    parts.push(describeDayOfWeek(dayOfWeek));
  }

  return parts.join(', ');
}

function describeTime(minute: string, hour: string): string {
  if (minute === '*' && hour === '*') return 'Every minute';
  if (minute.startsWith('*/') && hour === '*') {
    return `Every ${minute.slice(2)} minutes`;
  }
  if (hour === '*' && !minute.includes('*')) {
    return `Every hour at :${minute.padStart(2, '0')}`;
  }
  if (
    !minute.includes('*') &&
    !hour.includes('*') &&
    !hour.includes('/') &&
    !minute.includes('/')
  ) {
    return `At ${formatTime(hour, minute)}`;
  }
  if (hour.startsWith('*/')) {
    const atMin = minute === '0' || minute === '00' ? '' : ` at :${minute.padStart(2, '0')}`;
    return `Every ${hour.slice(2)} hours${atMin}`;
  }
  return `At minute ${minute} of hour ${hour}`;
}

function formatTime(hour: string, minute: string): string {
  if (hour.includes('-') || hour.includes(',')) {
    return `${minute.padStart(2, '0')} past hours ${hour}`;
  }
  const h = Number(hour);
  const m = minute.padStart(2, '0');
  if (isNaN(h)) return `${hour}:${m}`;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${suffix}`;
}

function describeDayOfMonth(dom: string): string {
  if (dom.includes(',')) {
    return `on days ${dom} of the month`;
  }
  if (dom.includes('-')) {
    const dashParts = dom.split('-');
    return `on days ${dashParts[0] ?? ''} through ${dashParts[1] ?? ''} of the month`;
  }
  return `on day ${dom} of the month`;
}

function describeMonth(month: string): string {
  if (month.includes(',')) {
    const months = month.split(',').map((m) => MONTH_LABELS[m.trim()] ?? m.trim());
    return `in ${months.join(', ')}`;
  }
  if (month.includes('-')) {
    const dashParts = month.split('-');
    const s = dashParts[0] ?? '';
    const e = dashParts[1] ?? '';
    return `in ${MONTH_LABELS[s] ?? s} through ${MONTH_LABELS[e] ?? e}`;
  }
  return `in ${MONTH_LABELS[month] ?? month}`;
}

const DOW_NAMES: Record<string, string> = {
  '0': 'Sunday',
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
  '7': 'Sunday',
};

function describeDayOfWeek(dow: string): string {
  if (dow === '1-5') return 'Monday through Friday';
  if (dow === '0,6' || dow === '6,0') return 'on weekends';
  if (dow.includes(',')) {
    const days = dow.split(',').map((d) => DOW_NAMES[d.trim()] ?? d.trim());
    return `on ${days.join(', ')}`;
  }
  if (dow.includes('-')) {
    const dashParts = dow.split('-');
    const s = dashParts[0] ?? '';
    const e = dashParts[1] ?? '';
    return `${DOW_NAMES[s] ?? s} through ${DOW_NAMES[e] ?? e}`;
  }
  return `on ${DOW_NAMES[dow] ?? dow}`;
}

// ─── Day-of-week field helpers ──────────────────────────────────────────────

function parseDayOfWeekField(field: string): string[] {
  if (field === '*') return [];
  const result: string[] = [];
  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const dashParts = part.split('-').map(Number);
      const s = dashParts[0];
      const e = dashParts[1];
      if (s != null && e != null && !isNaN(s) && !isNaN(e)) {
        for (let i = s; i <= e; i++) result.push(String(i));
      }
    } else {
      result.push(part.trim());
    }
  }
  return result;
}

function dayOfWeekToField(selected: string[]): string {
  if (selected.length === 0) return '*';
  const nums = selected.map(Number).sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = nums[0]!;
  let rangeEnd = nums[0]!;
  for (let i = 1; i < nums.length; i++) {
    const current = nums[i]!;
    if (current === rangeEnd + 1) {
      rangeEnd = current;
    } else {
      ranges.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}-${rangeEnd}`);
      rangeStart = current;
      rangeEnd = current;
    }
  }
  ranges.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}-${rangeEnd}`);
  return ranges.join(',');
}

// ─── Select options generators ──────────────────────────────────────────────

function minuteOptions(): { value: string; label: string }[] {
  const opts = [{ value: '*', label: 'Every (*)' }];
  for (let i = 0; i < 60; i++) {
    opts.push({ value: String(i), label: String(i).padStart(2, '0') });
  }
  return opts;
}

function hourOptions(): { value: string; label: string }[] {
  const opts = [{ value: '*', label: 'Every (*)' }];
  for (let i = 0; i < 24; i++) {
    const suffix = i >= 12 ? 'PM' : 'AM';
    const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
    opts.push({ value: String(i), label: `${String(i).padStart(2, '0')} (${h12} ${suffix})` });
  }
  return opts;
}

function dayOfMonthOptions(): { value: string; label: string }[] {
  const opts = [{ value: '*', label: 'Every (*)' }];
  for (let i = 1; i <= 31; i++) {
    opts.push({ value: String(i), label: String(i) });
  }
  return opts;
}

function monthOptions(): { value: string; label: string }[] {
  const opts = [{ value: '*', label: 'Every (*)' }];
  for (let i = 1; i <= 12; i++) {
    opts.push({ value: String(i), label: MONTH_LABELS[String(i)] ?? String(i) });
  }
  return opts;
}

// Memoised option arrays (static data)
const MINUTE_OPTIONS = minuteOptions();
const HOUR_OPTIONS = hourOptions();
const DAY_OF_MONTH_OPTIONS = dayOfMonthOptions();
const MONTH_OPTIONS = monthOptions();

// ─── Component ──────────────────────────────────────────────────────────────

export function CronBuilder({
  value,
  onChange,
  timezone,
  onTimezoneChange,
  error: externalError,
}: CronBuilderProps) {
  const [rawInput, setRawInput] = useState(value);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Parse current value into fields
  const fields = useMemo(
    () =>
      parseCronToFields(value) ?? {
        minute: '*',
        hour: '*',
        dayOfMonth: '*',
        month: '*',
        dayOfWeek: '*',
      },
    [value],
  );

  const selectedDays = useMemo(() => parseDayOfWeekField(fields.dayOfWeek), [fields.dayOfWeek]);

  // Sync raw input when value changes from outside
  useEffect(() => {
    setRawInput(value);
  }, [value]);

  // Human-readable preview
  const preview = useMemo(() => cronToHumanReadable(value), [value]);

  const activePreset = useMemo(() => PRESETS.find((p) => p.cron === value)?.label ?? null, [value]);

  // ─── Field change handlers ──────────────────────────────────────────

  const updateField = useCallback(
    (field: keyof CronFields, newValue: string) => {
      const updated = { ...fields, [field]: newValue };
      const cron = fieldsToCron(updated);
      setValidationError(null);
      onChange(cron);
    },
    [fields, onChange],
  );

  const handleDayOfWeekToggle = useCallback(
    (day: string, checked: boolean) => {
      let newSelected: string[];
      if (checked) {
        newSelected = [...selectedDays, day];
      } else {
        newSelected = selectedDays.filter((d) => d !== day);
      }
      updateField('dayOfWeek', dayOfWeekToField(newSelected));
    },
    [selectedDays, updateField],
  );

  const handlePreset = useCallback(
    (cron: string) => {
      setValidationError(null);
      onChange(cron);
    },
    [onChange],
  );

  const handleRawInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRawInput(e.target.value);
  }, []);

  const handleRawInputBlur = useCallback(() => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;
    const err = validateCron(trimmed);
    if (err) {
      setValidationError(err);
    } else {
      setValidationError(null);
      onChange(trimmed);
    }
  }, [rawInput, onChange]);

  const handleRawInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRawInputBlur();
      }
    },
    [handleRawInputBlur],
  );

  const displayError = externalError || validationError;

  return (
    <div className="space-y-4">
      {/* ─── Preset Buttons ──────────────────────────────────────── */}
      <div>
        <Label className="mb-2 block text-xs font-medium text-muted-foreground">Presets</Label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.cron}
              type="button"
              variant={activePreset === preset.label ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-7 rounded-full px-3 text-xs transition-all',
                activePreset === preset.label
                  ? 'bg-[#7c3aed] text-white hover:bg-[#5b21b6]'
                  : 'border-[#7c3aed]/20 text-[#7c3aed] hover:border-[#7c3aed]/40 hover:bg-[#f5f3ff]',
              )}
              onClick={() => handlePreset(preset.cron)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ─── Field Selectors ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Minute */}
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Minute</Label>
          <Select value={fields.minute} onValueChange={(v) => updateField('minute', v)}>
            <SelectTrigger className="w-full font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {MINUTE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="font-mono text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hour */}
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Hour</Label>
          <Select value={fields.hour} onValueChange={(v) => updateField('hour', v)}>
            <SelectTrigger className="w-full font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {HOUR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="font-mono text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Day of Month */}
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Day of Month</Label>
          <Select value={fields.dayOfMonth} onValueChange={(v) => updateField('dayOfMonth', v)}>
            <SelectTrigger className="w-full font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {DAY_OF_MONTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="font-mono text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month */}
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Month</Label>
          <Select value={fields.month} onValueChange={(v) => updateField('month', v)}>
            <SelectTrigger className="w-full font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {MONTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="font-mono text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Day of Week — checkbox row */}
      <div>
        <Label className="mb-2 block text-xs text-muted-foreground">Day of Week</Label>
        <div className="flex flex-wrap gap-3">
          {DAY_OF_WEEK_LABELS.map((day) => {
            const isChecked = selectedDays.includes(day.value);
            return (
              <label
                key={day.value}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all',
                  isChecked
                    ? 'border-[#7c3aed] bg-[#7c3aed]/10 text-[#7c3aed]'
                    : 'border-border text-muted-foreground hover:border-[#7c3aed]/30 hover:bg-[#f5f3ff]',
                )}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => handleDayOfWeekToggle(day.value, checked === true)}
                  className="size-3.5"
                />
                {day.label}
              </label>
            );
          })}
        </div>
      </div>

      {/* ─── Raw Cron Input ──────────────────────────────────────── */}
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">Raw Expression</Label>
        <Input
          value={rawInput}
          onChange={handleRawInputChange}
          onBlur={handleRawInputBlur}
          onKeyDown={handleRawInputKeyDown}
          placeholder="* * * * *"
          className={cn(
            'font-mono text-sm',
            displayError && 'border-destructive focus-visible:ring-destructive/50',
          )}
        />
        {displayError && <p className="mt-1 text-xs text-destructive">{displayError}</p>}
      </div>

      {/* ─── Human-Readable Preview ──────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-lg border border-[#7c3aed]/10 bg-[#f5f3ff]/60 px-3 py-2">
        <Clock className="size-4 shrink-0 text-[#7c3aed]/60" />
        <span className="text-sm text-gray-600">{preview}</span>
      </div>

      {/* ─── Timezone Selector ───────────────────────────────────── */}
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">Timezone</Label>
        <Select value={timezone} onValueChange={onTimezoneChange}>
          <SelectTrigger className="w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {COMMON_TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz} className="text-sm">
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
