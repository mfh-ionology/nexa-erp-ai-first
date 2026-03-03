/* eslint-disable i18next/no-literal-string */
/**
 * Filter bar for the Automation Runs list page (AC-2).
 *
 * - Status multi-select (Popover + Checkboxes)
 * - Date range (From / To date inputs)
 * - Automation filter (Select dropdown — only in "all runs" mode)
 * - Clear Filters button
 */

import { useCallback } from 'react';
import { Filter, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { AutomationRunStatus } from '../api/types';
import { useAiAutomations } from '../api/use-ai-automations';
import type { RunFilters } from './automation-run-list-page';

// ─── Status options ──────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ value: AutomationRunStatus; label: string; dotColor: string }> = [
  { value: 'PENDING', label: 'Pending', dotColor: 'bg-[#d1d5db]' },
  { value: 'RUNNING', label: 'Running', dotColor: 'bg-[#f59e0b]' },
  { value: 'COMPLETED', label: 'Completed', dotColor: 'bg-[#10b981]' },
  { value: 'FAILED', label: 'Failed', dotColor: 'bg-[#dc2626]' },
  { value: 'CANCELLED', label: 'Cancelled', dotColor: 'bg-[#9ca3af]' },
];

// ─── Automation Select (extracted so hook only fires when mounted) ───────────

function AutomationSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (automationId: string) => void;
}) {
  const { data: automationsData } = useAiAutomations();
  const automations = automationsData?.data ?? [];

  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
      <SelectTrigger size="sm" className="h-8 w-44 text-xs">
        <SelectValue placeholder="All Automations" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Automations</SelectItem>
        {automations.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface AutomationRunFilterBarProps {
  filters: RunFilters;
  onChange: (filters: RunFilters) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  /** Show the automation name dropdown (hidden when scoped to single automation) */
  showAutomationFilter: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AutomationRunFilterBar({
  filters,
  onChange,
  onClear,
  hasActiveFilters,
  showAutomationFilter,
}: AutomationRunFilterBarProps) {
  const handleStatusToggle = useCallback(
    (status: AutomationRunStatus, checked: boolean) => {
      const next = checked
        ? [...filters.statuses, status]
        : filters.statuses.filter((s) => s !== status);
      onChange({ ...filters, statuses: next });
    },
    [filters, onChange],
  );

  const statusLabel =
    filters.statuses.length === 0
      ? 'All Statuses'
      : filters.statuses.length === 1
        ? (STATUS_OPTIONS.find((o) => o.value === filters.statuses[0])?.label ?? 'Status')
        : `${filters.statuses.length} statuses`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-xs',
              filters.statuses.length > 0 && 'border-[#7c3aed]/40 bg-[#f5f3ff]',
            )}
          >
            <Filter className="size-3.5" />
            {statusLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={filters.statuses.includes(opt.value)}
                  onCheckedChange={(checked) => handleStatusToggle(opt.value, !!checked)}
                />
                <span className={cn('size-2 rounded-full', opt.dotColor)} aria-hidden="true" />
                {opt.label}
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Date range: From */}
      <Input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        placeholder="From date"
        className="h-8 w-36 text-xs"
        aria-label="From date"
      />

      {/* Date range: To */}
      <Input
        type="date"
        value={filters.dateTo}
        onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
        placeholder="To date"
        className="h-8 w-36 text-xs"
        aria-label="To date"
      />

      {/* Automation name filter (only in all-runs mode) */}
      {showAutomationFilter && (
        <AutomationSelect
          value={filters.automationId}
          onChange={(automationId) => onChange({ ...filters, automationId })}
        />
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 gap-1 text-xs text-muted-foreground"
        >
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
