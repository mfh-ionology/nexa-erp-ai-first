import { useCallback, useMemo, useState } from 'react';
import { CalendarIcon, ChevronsUpDown } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { DateRangePresetDto, FilterConditionState } from '../types';

interface DateFilterControlProps {
  condition: FilterConditionState | null;
  datePresets: DateRangePresetDto[];
  onUpdate: (updates: Partial<FilterConditionState>) => void;
}

/**
 * Mapping from presetKey to i18n translation key suffix.
 * Keys match the date_range_presets table's presetKey column.
 * Uses snake_case keys to match DB column values.
 */
/* eslint-disable @typescript-eslint/naming-convention, i18next/no-literal-string -- keys match DB presetKey column; values are i18n key suffixes */
const PRESET_I18N_MAP: Record<string, string> = {
  custom: 'custom',
  today: 'today',
  yesterday: 'yesterday',
  tomorrow: 'tomorrow',
  last_3_days: 'last3days',
  last_7_days: 'last7days',
  last_30_days: 'last30days',
  next_7_days: 'next7days',
  next_30_days: 'next30days',
  this_week: 'thisweek',
  last_week: 'lastweek',
  next_week: 'nextweek',
  this_month: 'thismonth',
  last_month: 'lastmonth',
  next_month: 'nextmonth',
  this_year: 'thisyear',
  last_year: 'lastyear',
  next_year: 'nextyear',
  mtd: 'mtd',
  ytd: 'ytd',
};
/* eslint-enable @typescript-eslint/naming-convention, i18next/no-literal-string */

/** Group presets visually by category */
function groupPresets(presets: DateRangePresetDto[]): {
  label: string;
  items: DateRangePresetDto[];
}[] {
  const relative: DateRangePresetDto[] = [];
  const ranges: DateRangePresetDto[] = [];
  const periods: DateRangePresetDto[] = [];
  const cumulative: DateRangePresetDto[] = [];
  const custom: DateRangePresetDto[] = [];

  /* eslint-disable i18next/no-literal-string -- matching DB presetKey patterns, not user-facing */
  for (const p of presets) {
    const key = p.presetKey;
    if (key === 'custom') {
      custom.push(p);
    } else if (['today', 'yesterday', 'tomorrow'].includes(key)) {
      relative.push(p);
    } else if (key.startsWith('last_') || key.startsWith('next_')) {
      if (key.includes('days')) {
        ranges.push(p);
      } else {
        periods.push(p);
      }
    } else if (key.startsWith('this_')) {
      periods.push(p);
    } else if (['mtd', 'ytd'].includes(key)) {
      cumulative.push(p);
    } else {
      ranges.push(p);
    }
  }

  const groups: { label: string; items: DateRangePresetDto[] }[] = [];
  if (relative.length) groups.push({ label: 'relative', items: relative });
  if (ranges.length) groups.push({ label: 'ranges', items: ranges });
  if (periods.length) groups.push({ label: 'periods', items: periods });
  if (cumulative.length) groups.push({ label: 'cumulative', items: cumulative });
  if (custom.length) groups.push({ label: 'custom', items: custom });
  /* eslint-enable i18next/no-literal-string */
  return groups;
}

export function DateFilterControl({ condition, datePresets, onUpdate }: DateFilterControlProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [showCustomRange, setShowCustomRange] = useState(false);

  const sortedPresets = useMemo(
    () => [...datePresets].sort((a, b) => a.orderInList - b.orderInList),
    [datePresets],
  );
  const groupedPresets = useMemo(() => groupPresets(sortedPresets), [sortedPresets]);

  // Parse custom range from condition value (JSON: ["start", "end"])
  const customRange = useMemo((): { from: Date | undefined; to: Date | undefined } => {
    if (!condition?.value) return { from: undefined, to: undefined };
    try {
      const parsed = JSON.parse(condition.value) as [string, string];
      return {
        from: parsed[0] ? new Date(parsed[0]) : undefined,
        to: parsed[1] ? new Date(parsed[1]) : undefined,
      };
    } catch {
      return { from: undefined, to: undefined };
    }
  }, [condition]);

  // Find active preset name
  const activePreset = useMemo(() => {
    if (!condition?.datePresetId) return null;
    return datePresets.find((p) => p.id === condition.datePresetId) ?? null;
  }, [condition, datePresets]);

  const triggerLabel = useMemo(() => {
    if (activePreset) {
      const i18nKey = PRESET_I18N_MAP[activePreset.presetKey];
      return i18nKey ? t(`views.datePreset.${i18nKey}`) : activePreset.presetName;
    }
    if (condition?.operator === 'BETWEEN' && condition.value) {
      try {
        const parsed = JSON.parse(condition.value) as [string, string];
        const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
        const fromFormatted = fmt.format(new Date(parsed[0]));
        const toFormatted = fmt.format(new Date(parsed[1]));
        // eslint-disable-next-line i18next/no-literal-string -- formatted date range display
        return `${fromFormatted} \u2013 ${toFormatted}`;
      } catch {
        return t('views.customRange');
      }
    }
    return t('views.allValues');
  }, [activePreset, condition, t]);

  const handleSelectPreset = useCallback(
    (preset: DateRangePresetDto) => {
      if (preset.presetKey === 'custom') {
        setShowCustomRange(true);
        return;
      }
      setShowCustomRange(false);
      onUpdate({
        datePresetId: preset.id,
        operator: 'EQUALS',
        value: null,
        valueList: null,
      });
      setOpen(false);
    },
    [onUpdate],
  );

  const handleCustomFromChange = useCallback(
    (date: Date | undefined) => {
      const to = customRange.to;
      const fromStr = date ? date.toISOString().slice(0, 10) : '';
      const toStr = to ? to.toISOString().slice(0, 10) : '';

      onUpdate({
        datePresetId: null,
        operator: 'BETWEEN',
        value: JSON.stringify([fromStr, toStr]),
        valueList: null,
      });
    },
    [customRange.to, onUpdate],
  );

  const handleCustomToChange = useCallback(
    (date: Date | undefined) => {
      const from = customRange.from;
      const fromStr = from ? from.toISOString().slice(0, 10) : '';
      const toStr = date ? date.toISOString().slice(0, 10) : '';

      onUpdate({
        datePresetId: null,
        operator: 'BETWEEN',
        value: JSON.stringify([fromStr, toStr]),
        valueList: null,
      });
    },
    [customRange.from, onUpdate],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-8 min-w-[140px] justify-between text-xs font-normal"
        >
          <CalendarIcon className="mr-1 size-3 shrink-0 opacity-50" />
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto min-w-[200px] rounded-lg p-0 shadow-md" align="start">
        {!showCustomRange ? (
          <div className="max-h-[320px] overflow-y-auto py-1">
            {groupedPresets.map((group) => (
              <div key={group.label}>
                <div className="space-y-0.5 px-1">
                  {group.items.map((preset) => {
                    const isActive = condition?.datePresetId === preset.id;
                    const i18nKey = PRESET_I18N_MAP[preset.presetKey];
                    const label = i18nKey ? t(`views.datePreset.${i18nKey}`) : preset.presetName;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          handleSelectPreset(preset);
                        }}
                        className={cn(
                          'flex w-full items-center rounded-md px-3 py-1.5 text-sm transition-colors',
                          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                          isActive && 'bg-primary/10 text-primary font-medium',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="my-1 h-px bg-border last:hidden" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 p-3">
            <button
              type="button"
              onClick={() => {
                setShowCustomRange(false);
              }}
              className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
            >
              {t('back')}
            </button>

            <div className="space-y-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t('views.from')}</p>
                <Calendar
                  mode="single"
                  selected={customRange.from}
                  onSelect={handleCustomFromChange}
                  className="rounded-lg border"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t('views.to')}</p>
                <Calendar
                  mode="single"
                  selected={customRange.to}
                  onSelect={handleCustomToChange}
                  className="rounded-lg border"
                />
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
