/* eslint-disable i18next/no-literal-string */
/**
 * Invoice List Page — v0 Concept D reference implementation.
 *
 * Static mock data showcasing the v0 design system for entity lists with:
 * - KPI strip, filter tabs, sortable table, AI insight indicators.
 * Will be wired to real API in E14 (AR module).
 */

import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Search,
  SearchX,
  Plus,
  Sparkles,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useI18n, useLocale } from '@nexa/i18n';

/* ── Types ──────────────────────────────────────────────────── */

type InvoiceStatus = 'overdue' | 'dueSoon' | 'paid' | 'draft' | 'posted';

interface Invoice {
  id: string;
  number: string;
  customer: string;
  amount: number;
  status: InvoiceStatus;
  dueLabel: string;
  hasAiInsight: boolean;
}

type SortKey = 'number' | 'customer' | 'amount' | 'status' | 'dueLabel';
type SortDir = 'asc' | 'desc';

/* ── Static data ────────────────────────────────────────────── */

const invoices: Invoice[] = [
  {
    id: 'inv1',
    number: 'INV-2026-0042',
    customer: 'Acme Corp',
    amount: 31000,
    status: 'overdue',
    dueLabel: '89 days ago',
    hasAiInsight: true,
  },
  {
    id: 'inv2',
    number: 'INV-2026-0045',
    customer: 'BlueStar Ltd',
    amount: 15800,
    status: 'overdue',
    dueLabel: '71 days ago',
    hasAiInsight: true,
  },
  {
    id: 'inv3',
    number: 'INV-2026-0048',
    customer: 'TechVault Inc',
    amount: 8200,
    status: 'overdue',
    dueLabel: '45 days ago',
    hasAiInsight: false,
  },
  {
    id: 'inv4',
    number: 'INV-2026-0051',
    customer: 'Meridian Supplies',
    amount: 12400,
    status: 'dueSoon',
    dueLabel: 'In 5 days',
    hasAiInsight: false,
  },
  {
    id: 'inv5',
    number: 'INV-2026-0053',
    customer: 'CloudNine Digital',
    amount: 4800,
    status: 'dueSoon',
    dueLabel: 'In 12 days',
    hasAiInsight: false,
  },
  {
    id: 'inv6',
    number: 'INV-2026-0055',
    customer: 'FreshFields Organic',
    amount: 22100,
    status: 'paid',
    dueLabel: '12 Feb',
    hasAiInsight: false,
  },
  {
    id: 'inv7',
    number: 'INV-2026-0057',
    customer: 'UrbanCraft Studios',
    amount: 6700,
    status: 'draft',
    dueLabel: '\u2014',
    hasAiInsight: false,
  },
  {
    id: 'inv8',
    number: 'INV-2026-0059',
    customer: 'NorthStar Logistics',
    amount: 9300,
    status: 'posted',
    dueLabel: 'Due 1 Mar',
    hasAiInsight: false,
  },
];

const STATUS_LABEL_KEYS: Record<InvoiceStatus, string> = {
  overdue: 'status.overdue',
  dueSoon: 'status.dueSoon',
  paid: 'status.paid',
  draft: 'status.draft',
  posted: 'status.posted',
};

const statusStyles: Record<InvoiceStatus, { bg: string; text: string; border: string }> = {
  overdue: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  dueSoon: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
  paid: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  draft: { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
  posted: { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },
};

const filterTabs: Array<{ labelKey: string; value: InvoiceStatus | 'all' }> = [
  { labelKey: 'invoices.filter.all', value: 'all' },
  { labelKey: 'invoices.filter.pending', value: 'dueSoon' },
  { labelKey: 'invoices.filter.paid', value: 'paid' },
  { labelKey: 'invoices.filter.overdue', value: 'overdue' },
  { labelKey: 'invoices.filter.draft', value: 'draft' },
];

/* ── Helpers ────────────────────────────────────────────────── */

function formatCurrency(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(amount);
}

function SortIndicator({
  sortKey,
  sortDir,
  column,
}: {
  sortKey: SortKey | null;
  sortDir: SortDir;
  column: SortKey;
}) {
  if (sortKey === column && sortDir === 'asc')
    return <ArrowUp className="ml-1 h-3.5 w-3.5 text-foreground" />;
  if (sortKey === column && sortDir === 'desc')
    return <ArrowDown className="ml-1 h-3.5 w-3.5 text-foreground" />;
  return (
    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
  );
}

function KpiMini({
  label,
  value,
  change,
  changeType,
  colorClass,
}: {
  label: string;
  value: string;
  change: string;
  changeType: 'up' | 'down';
  colorClass?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-xl font-bold tabular-nums ${colorClass || 'text-foreground'}`}
      >
        {value}
      </p>
      <div className="mt-1 flex items-center gap-1">
        {changeType === 'up' ? (
          <TrendingUp className="h-3 w-3 text-[#10b981]" />
        ) : (
          <TrendingDown className="h-3 w-3 text-[#ef4444]" />
        )}
        <span
          className={`text-xs font-medium ${changeType === 'up' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}
        >
          {change}
        </span>
        <span className="text-xs text-muted-foreground">{t('dashboard.kpi.vsLastMonth')}</span>
      </div>
    </div>
  );
}

/* ── Component ──────────────────────────────────────────────── */

export function InvoiceListPage() {
  const { t } = useI18n();
  const locale = useLocale();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<InvoiceStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    let result = invoices;

    if (activeFilter !== 'all') {
      result = result.filter((inv) => inv.status === activeFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (inv) => inv.number.toLowerCase().includes(q) || inv.customer.toLowerCase().includes(q),
      );
    }

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'number':
            cmp = a.number.localeCompare(b.number);
            break;
          case 'customer':
            cmp = a.customer.localeCompare(b.customer);
            break;
          case 'amount':
            cmp = a.amount - b.amount;
            break;
          case 'status':
            cmp = a.status.localeCompare(b.status);
            break;
          case 'dueLabel':
            cmp = a.dueLabel.localeCompare(b.dueLabel);
            break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [activeFilter, searchQuery, sortKey, sortDir]);

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Page Header */}
      <div
        className="mb-6 flex flex-col gap-4 animate-fade-in-up sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: '50ms' }}
      >
        <h1 className="font-serif text-3xl font-bold text-foreground">{t('invoices.title')}</h1>
        <div className="flex items-center gap-2">
          <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            <Plus className="h-4 w-4" />
            {t('invoices.action.new')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div
        className="mb-6 grid grid-cols-1 gap-4 animate-fade-in-up sm:grid-cols-2 lg:grid-cols-4"
        style={{ animationDelay: '100ms' }}
      >
        <KpiMini
          label={t('invoices.kpi.totalInvoices')}
          value="82"
          change="+10.8%"
          changeType="up"
        />
        <KpiMini
          label={t('invoices.kpi.pending')}
          value="18"
          change="+50%"
          changeType="up"
          colorClass="text-[#d97706]"
        />
        <KpiMini
          label={t('invoices.kpi.overdueValue')}
          value={formatCurrency(86500, locale)}
          change="+104%"
          changeType="up"
          colorClass="text-[#ef4444]"
        />
        <KpiMini
          label={t('invoices.kpi.paidThisMonth')}
          value={formatCurrency(735600, locale)}
          change="+5.4%"
          changeType="up"
          colorClass="text-[#10b981]"
        />
      </div>

      {/* Filter Tabs + Search */}
      <div
        className="mb-4 flex flex-col gap-3 animate-fade-in-up sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: '150ms' }}
      >
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setActiveFilter(tab.value);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === tab.value
                  ? 'bg-[#7c3aed] text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm sm:w-64">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('invoices.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Data Table */}
      <div
        className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        style={{ animationDelay: '200ms' }}
      >
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]">
              <TableHead className="h-11 w-10 px-4">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              </TableHead>
              <TableHead className="h-11 px-4">
                <button
                  className="group flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  onClick={() => {
                    toggleSort('number');
                  }}
                >
                  {t('invoices.column.invoiceNumber')}
                  <SortIndicator sortKey={sortKey} sortDir={sortDir} column="number" />
                </button>
              </TableHead>
              <TableHead className="h-11 px-4">
                <button
                  className="group flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  onClick={() => {
                    toggleSort('customer');
                  }}
                >
                  {t('invoices.column.customer')}
                  <SortIndicator sortKey={sortKey} sortDir={sortDir} column="customer" />
                </button>
              </TableHead>
              <TableHead className="h-11 px-4 text-right">
                <button
                  className="group ml-auto flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  onClick={() => {
                    toggleSort('amount');
                  }}
                >
                  {t('invoices.column.amount')}
                  <SortIndicator sortKey={sortKey} sortDir={sortDir} column="amount" />
                </button>
              </TableHead>
              <TableHead className="h-11 px-4">
                <button
                  className="group flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  onClick={() => {
                    toggleSort('status');
                  }}
                >
                  {t('invoices.column.status')}
                  <SortIndicator sortKey={sortKey} sortDir={sortDir} column="status" />
                </button>
              </TableHead>
              <TableHead className="h-11 px-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('invoices.column.dueDate')}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                      <SearchX className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{t('common:noResults')}</p>
                    <p className="text-xs text-muted-foreground">{t('common:noResultsHint')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => {
                const style = statusStyles[inv.status];
                return (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-[#f5f3ff]/50"
                    onClick={() =>
                      void navigate({ to: '/ar/invoices/$id', params: { id: inv.id } })
                    }
                  >
                    <TableCell className="w-10 px-4 py-3.5">
                      {inv.hasAiInsight ? (
                        <Sparkles className="h-3.5 w-3.5 text-[#7c3aed]" />
                      ) : (
                        <span className="h-3.5 w-3.5" />
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <span className="font-mono text-sm font-semibold text-[#7c3aed]">
                        {inv.number}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <span className="text-sm text-foreground">{inv.customer}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-right">
                      <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                        {formatCurrency(inv.amount, locale)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <span
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: style.bg,
                          color: style.text,
                          borderColor: style.border,
                        }}
                      >
                        {t(STATUS_LABEL_KEYS[inv.status])}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <span className="text-sm text-muted-foreground">{inv.dueLabel}</span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Record count */}
      <div className="mt-3 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
        <p className="text-xs text-muted-foreground">
          {t('recordCount', { count: filtered.length })}
        </p>
      </div>
    </div>
  );
}
