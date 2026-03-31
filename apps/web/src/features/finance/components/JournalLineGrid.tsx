/* eslint-disable i18next/no-literal-string */
/**
 * JournalLineGrid — Excel-like editable line grid for journal entries.
 *
 * Features:
 * - Tab between cells for fast data entry
 * - Account picker with autocomplete search
 * - Auto-calculate totals (debit, credit, difference)
 * - Balance indicator with visual feedback
 * - Add/remove line rows
 * - Read-only mode for posted/reversed entries
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useI18n, useLocale } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

import { useAccountSearch } from '../hooks/use-journals';
import type { JournalLineInput } from '../api/journals-types';
import type { AccountSearchResult } from '../api/journals-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineRow extends JournalLineInput {
  /** Client-side key for React rendering */
  _key: string;
  /** Display-only account name, populated from the account picker */
  accountName?: string;
}

interface JournalLineGridProps {
  lines: LineRow[];
  onChange: (lines: LineRow[]) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let keyCounter = 0;
export function createEmptyLine(): LineRow {
  keyCounter += 1;
  return {
    _key: `line-${Date.now()}-${keyCounter}`,
    accountCode: '',
    description: '',
    debit: 0,
    credit: 0,
    vatCode: '',
  };
}

export function lineRowsFromApi(
  apiLines: Array<{
    accountCode: string;
    accountName?: string;
    description: string | null;
    debit: number;
    credit: number;
    vatCode: string | null;
  }>,
): LineRow[] {
  return apiLines.map((line, idx) => {
    keyCounter += 1;
    return {
      _key: `api-${idx}-${keyCounter}`,
      accountCode: line.accountCode,
      accountName: line.accountName ?? '',
      description: line.description ?? '',
      debit: line.debit,
      credit: line.credit,
      vatCode: line.vatCode ?? '',
    };
  });
}

function formatCurrency(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// VAT code options (matching seed data)
// ---------------------------------------------------------------------------

const VAT_CODES = [
  { code: 'S', label: 'S \u2014 Standard (20%)' },
  { code: 'R', label: 'R \u2014 Reduced (5%)' },
  { code: 'Z', label: 'Z \u2014 Zero Rate' },
  { code: 'E', label: 'E \u2014 Exempt' },
  { code: 'RC', label: 'RC \u2014 Reverse Charge' },
] as const;

// ---------------------------------------------------------------------------
// AccountPicker — autocomplete search for chart of accounts
// ---------------------------------------------------------------------------

function AccountPicker({
  value,
  onChange,
  readOnly,
  onOpenChange,
}: {
  value: string;
  onChange: (code: string, name: string) => void;
  readOnly?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useI18n('finance');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: accounts } = useAccountSearch(search || value, open);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      onOpenChange?.(isOpen);
      if (isOpen) {
        setSearch(value);
      }
    },
    [value, onOpenChange],
  );

  const handleSelect = useCallback(
    (account: AccountSearchResult) => {
      onChange(account.code, account.name);
      setOpen(false);
      onOpenChange?.(false);
    },
    [onChange, onOpenChange],
  );

  if (readOnly) {
    return <span className="font-mono text-sm">{value || '\u2014'}</span>;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-full items-center rounded-md border border-transparent bg-transparent px-2 text-left font-mono text-sm hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label={t('journals.field.account')}
        >
          {value || (
            <span className="text-muted-foreground">{t('journals.field.accountPlaceholder')}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('journals.field.accountSearch')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t('journals.field.noAccounts')}</CommandEmpty>
            <CommandGroup>
              {(accounts ?? []).map((account) => (
                <CommandItem
                  key={account.id}
                  value={account.code}
                  onSelect={() => handleSelect(account)}
                  disabled={!account.isPostable || account.isControl}
                >
                  <div className="flex w-full items-center gap-3">
                    <span className="font-mono text-sm font-medium">{account.code}</span>
                    <span className="truncate text-sm text-muted-foreground">{account.name}</span>
                  </div>
                  {account.isControl && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t('journals.field.controlAccount')}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// NumberCell — inline editable number input
// ---------------------------------------------------------------------------

function NumberCell({
  value,
  onChange,
  readOnly,
  tabIndex,
}: {
  value: number;
  onChange: (val: number) => void;
  readOnly?: boolean;
  tabIndex?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = useCallback(() => {
    if (readOnly) return;
    setEditing(true);
    setText(value === 0 ? '' : String(value));
  }, [readOnly, value]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(Math.round(parsed * 100) / 100);
    } else if (text === '') {
      onChange(0);
    }
  }, [text, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  }, []);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  if (readOnly) {
    return (
      <span className="font-mono text-sm tabular-nums">
        {value === 0 ? '\u2014' : value.toFixed(2)}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        tabIndex={tabIndex}
        className="h-8 w-full rounded-md border border-primary bg-transparent px-2 text-right font-mono text-sm tabular-nums outline-none ring-1 ring-primary"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleFocus}
      onFocus={handleFocus}
      tabIndex={tabIndex}
      className="flex h-8 w-full items-center justify-end rounded-md border border-transparent bg-transparent px-2 font-mono text-sm tabular-nums hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {value === 0 ? '' : value.toFixed(2)}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TextCell — inline editable text input
// ---------------------------------------------------------------------------

function TextCell({
  value,
  onChange,
  readOnly,
  placeholder,
  tabIndex,
}: {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  tabIndex?: number;
}) {
  if (readOnly) {
    return <span className="text-sm">{value || '\u2014'}</span>;
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      tabIndex={tabIndex}
      className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm placeholder:text-muted-foreground hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

// ---------------------------------------------------------------------------
// JournalLineGrid component
// ---------------------------------------------------------------------------

export function JournalLineGrid({ lines, onChange, readOnly = false }: JournalLineGridProps) {
  const { t } = useI18n('finance');
  const locale = useLocale();

  // --- Totals calculation ---
  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += line.debit;
      totalCredit += line.credit;
    }
    const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
    return { totalDebit, totalCredit, difference };
  }, [lines]);

  const isBalanced = totals.difference === 0 && lines.length >= 2;

  // --- Line manipulation ---
  const updateLine = useCallback(
    (index: number, field: keyof JournalLineInput | 'accountName', value: string | number) => {
      const updated = [...lines];
      const current = updated[index];
      if (!current) return;
      const _key = current._key;

      // Build partial update, preserving _key
      let next: LineRow = { ...current, _key, [field]: value } as LineRow;

      // If user enters a debit, clear credit (and vice versa)
      if (field === 'debit' && (value as number) > 0) {
        next = { ...next, _key, debit: value as number, credit: 0 } as LineRow;
      } else if (field === 'credit' && (value as number) > 0) {
        next = { ...next, _key, credit: value as number, debit: 0 } as LineRow;
      }

      updated[index] = next;
      onChange(updated);
    },
    [lines, onChange],
  );

  const updateAccountWithName = useCallback(
    (index: number, code: string, name: string) => {
      const updated = [...lines];
      const current = updated[index];
      if (!current) return;
      updated[index] = { ...current, accountCode: code, accountName: name };
      onChange(updated);
    },
    [lines, onChange],
  );

  const addLine = useCallback(() => {
    onChange([...lines, createEmptyLine()]);
  }, [lines, onChange]);

  const removeLine = useCallback(
    (index: number) => {
      if (lines.length <= 2) return; // Must keep at least 2 lines
      const updated = lines.filter((_, i) => i !== index);
      onChange(updated);
    },
    [lines, onChange],
  );

  return (
    <div className="space-y-3">
      {/* Line grid table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]">
              <TableHead className="h-10 w-12 px-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                #
              </TableHead>
              <TableHead className="h-10 w-36 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('journals.column.account')}
              </TableHead>
              <TableHead className="h-10 w-48 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Account Name
              </TableHead>
              <TableHead className="h-10 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('journals.column.description')}
              </TableHead>
              <TableHead className="h-10 w-32 px-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('journals.column.debit')}
              </TableHead>
              <TableHead className="h-10 w-32 px-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('journals.column.credit')}
              </TableHead>
              <TableHead className="h-10 w-24 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('journals.column.vatCode')}
              </TableHead>
              {!readOnly && <TableHead className="h-10 w-10 px-2" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => (
              <TableRow
                key={line._key}
                className="border-b border-border/60 transition-colors hover:bg-[#f5f3ff]/30"
              >
                {/* Line number */}
                <TableCell className="px-2 py-1 text-center text-xs text-muted-foreground tabular-nums">
                  {index + 1}
                </TableCell>

                {/* Account code picker */}
                <TableCell className="px-2 py-1">
                  <AccountPicker
                    value={line.accountCode}
                    onChange={(code, name) => updateAccountWithName(index, code, name)}
                    readOnly={readOnly}
                  />
                </TableCell>

                {/* Account name (read-only) */}
                <TableCell className="px-2 py-1">
                  <span className="text-sm text-muted-foreground truncate block">
                    {line.accountName || '\u2014'}
                  </span>
                </TableCell>

                {/* Description */}
                <TableCell className="px-2 py-1">
                  <TextCell
                    value={line.description ?? ''}
                    onChange={(val) => updateLine(index, 'description', val)}
                    readOnly={readOnly}
                    placeholder={t('journals.field.lineDescription')}
                  />
                </TableCell>

                {/* Debit */}
                <TableCell className="px-2 py-1 text-right">
                  <NumberCell
                    value={line.debit}
                    onChange={(val) => updateLine(index, 'debit', val)}
                    readOnly={readOnly}
                  />
                </TableCell>

                {/* Credit */}
                <TableCell className="px-2 py-1 text-right">
                  <NumberCell
                    value={line.credit}
                    onChange={(val) => updateLine(index, 'credit', val)}
                    readOnly={readOnly}
                  />
                </TableCell>

                {/* VAT code */}
                <TableCell className="px-2 py-1">
                  {readOnly ? (
                    <span className="text-sm">{line.vatCode || '\u2014'}</span>
                  ) : (
                    <Select
                      value={line.vatCode ?? ''}
                      onValueChange={(val) => updateLine(index, 'vatCode', val)}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-8 w-full border-transparent bg-transparent text-sm shadow-none hover:border-border focus:border-primary"
                      >
                        <SelectValue placeholder={t('journals.field.vatCodePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {VAT_CODES.map((vat) => (
                          <SelectItem key={vat.code} value={vat.code}>
                            {vat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>

                {/* Delete row */}
                {!readOnly && (
                  <TableCell className="px-2 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 2}
                      aria-label={t('journals.action.removeLine')}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add line button */}
      {!readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addLine}
          className="text-[#7c3aed] hover:bg-[#f5f3ff] hover:text-[#5b21b6]"
        >
          <Plus className="size-4" />
          {t('journals.action.addLine')}
        </Button>
      )}

      {/* Balance summary */}
      <div
        className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
          isBalanced
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
            : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
        }`}
      >
        <div className="flex items-center gap-6">
          <div className="text-sm">
            <span className="text-muted-foreground">{t('journals.totals.debit')}:</span>{' '}
            <span className="font-mono font-semibold tabular-nums">
              {formatCurrency(totals.totalDebit, locale)}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">{t('journals.totals.credit')}:</span>{' '}
            <span className="font-mono font-semibold tabular-nums">
              {formatCurrency(totals.totalCredit, locale)}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">{t('journals.totals.difference')}:</span>{' '}
            <span
              className={`font-mono font-semibold tabular-nums ${
                totals.difference === 0
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {formatCurrency(Math.abs(totals.difference), locale)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <>
              <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                {t('journals.status.balanced')}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {t('journals.status.unbalanced')}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
