'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  SearchX,
  Plus,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  TrendingUp,
  TrendingDown,
  Columns3,
  Filter,
  SlidersHorizontal,
  Star,
  Save,
  Trash2,
  GripVertical,
  Pin,
  X,
} from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/* ───────────── Types & Data ───────────── */

type InvoiceStatus = 'Overdue' | 'Due Soon' | 'Paid' | 'Draft' | 'Posted';

interface Invoice {
  id: string;
  number: string;
  customer: string;
  date: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  hasAiInsight: boolean;
}

const invoices: Invoice[] = [
  {
    id: 'inv1',
    number: 'INV-2026-0082',
    customer: 'Acme Corporation',
    date: '15 Feb 2026',
    amount: 4250,
    status: 'Overdue',
    dueDate: '01 Feb 2026',
    hasAiInsight: true,
  },
  {
    id: 'inv2',
    number: 'INV-2026-0081',
    customer: 'Meridian Supplies',
    date: '14 Feb 2026',
    amount: 1800,
    status: 'Overdue',
    dueDate: '02 Feb 2026',
    hasAiInsight: false,
  },
  {
    id: 'inv3',
    number: 'INV-2026-0080',
    customer: 'TechFlow Ltd',
    date: '12 Feb 2026',
    amount: 12400,
    status: 'Overdue',
    dueDate: '05 Feb 2026',
    hasAiInsight: true,
  },
  {
    id: 'inv4',
    number: 'INV-2026-0079',
    customer: 'Northern Rail Co',
    date: '10 Feb 2026',
    amount: 3100,
    status: 'Overdue',
    dueDate: '08 Feb 2026',
    hasAiInsight: false,
  },
  {
    id: 'inv5',
    number: 'INV-2026-0078',
    customer: 'Beta Industries',
    date: '08 Feb 2026',
    amount: 6700,
    status: 'Overdue',
    dueDate: '10 Feb 2026',
    hasAiInsight: false,
  },
  {
    id: 'inv6',
    number: 'INV-2026-0077',
    customer: 'Coastal Foods',
    date: '05 Feb 2026',
    amount: 890,
    status: 'Overdue',
    dueDate: '12 Feb 2026',
    hasAiInsight: false,
  },
  {
    id: 'inv7',
    number: 'INV-2026-0076',
    customer: 'Summit Partners',
    date: '03 Feb 2026',
    amount: 15200,
    status: 'Overdue',
    dueDate: '14 Feb 2026',
    hasAiInsight: false,
  },
  {
    id: 'inv8',
    number: 'INV-2026-0075',
    customer: 'CloudNine Digital',
    date: '20 Jan 2026',
    amount: 4800,
    status: 'Paid',
    dueDate: '20 Feb 2026',
    hasAiInsight: false,
  },
  {
    id: 'inv9',
    number: 'INV-2026-0074',
    customer: 'FreshFields Organic',
    date: '18 Jan 2026',
    amount: 22100,
    status: 'Paid',
    dueDate: '18 Feb 2026',
    hasAiInsight: false,
  },
  {
    id: 'inv10',
    number: 'INV-2026-0073',
    customer: 'UrbanCraft Studios',
    date: '15 Jan 2026',
    amount: 9300,
    status: 'Due Soon',
    dueDate: '28 Feb 2026',
    hasAiInsight: false,
  },
  {
    id: 'inv11',
    number: 'INV-2026-0072',
    customer: 'NorthStar Logistics',
    date: '17 Feb 2026',
    amount: 6700,
    status: 'Draft',
    dueDate: '\u2014',
    hasAiInsight: false,
  },
  {
    id: 'inv12',
    number: 'INV-2026-0071',
    customer: 'Alpine Tech',
    date: '14 Feb 2026',
    amount: 31000,
    status: 'Posted',
    dueDate: '01 Mar 2026',
    hasAiInsight: true,
  },
];

const statusStyles: Record<InvoiceStatus, string> = {
  Overdue: 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]',
  'Due Soon': 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]',
  Paid: 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]',
  Draft: 'bg-[#f9fafb] text-[#6b7280] border-[#e5e7eb]',
  Posted: 'bg-[#f5f3ff] text-[#7c3aed] border-[#c4b5fd]',
};

interface ViewTab {
  id: string;
  label: string;
  favourite: boolean;
  filter: InvoiceStatus | 'All' | 'HighValue' | 'ThisMonth';
}

const viewTabs: ViewTab[] = [
  { id: 'all', label: 'All', favourite: false, filter: 'All' },
  { id: 'overdue', label: 'Overdue', favourite: true, filter: 'Overdue' },
  { id: 'thisMonth', label: 'This Month', favourite: true, filter: 'ThisMonth' },
  { id: 'highValue', label: 'High Value', favourite: false, filter: 'HighValue' },
  { id: 'paidOnly', label: 'Paid Only', favourite: false, filter: 'Paid' },
];

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  pinned: 'none' | 'left' | 'right';
}

const defaultColumns: ColumnConfig[] = [
  { key: 'number', label: 'Invoice #', visible: true, pinned: 'left' },
  { key: 'customer', label: 'Customer', visible: true, pinned: 'left' },
  { key: 'date', label: 'Date', visible: true, pinned: 'none' },
  { key: 'amount', label: 'Amount', visible: true, pinned: 'none' },
  { key: 'status', label: 'Status', visible: true, pinned: 'none' },
  { key: 'dueDate', label: 'Due Date', visible: true, pinned: 'none' },
  { key: 'paymentTerms', label: 'Payment Terms', visible: false, pinned: 'none' },
  { key: 'vatCode', label: 'VAT Code', visible: false, pinned: 'none' },
  { key: 'createdBy', label: 'Created By', visible: false, pinned: 'none' },
];

type SortKey = 'number' | 'customer' | 'date' | 'amount' | 'status' | 'dueDate';
type SortDir = 'asc' | 'desc';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
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
    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
        <span className="text-xs text-muted-foreground">vs last month</span>
      </div>
    </div>
  );
}

/* ───────────── Columns Popover Content ───────────── */

function ColumnsPopoverContent({
  columns,
  setColumns,
  onClose,
}: {
  columns: ColumnConfig[];
  setColumns: (cols: ColumnConfig[]) => void;
  onClose: () => void;
}) {
  const [localCols, setLocalCols] = useState<ColumnConfig[]>(columns);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  function toggleVisible(key: string) {
    setLocalCols((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  }

  function cyclePin(key: string) {
    setLocalCols((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        const next = c.pinned === 'none' ? 'left' : c.pinned === 'left' ? 'right' : 'none';
        return { ...c, pinned: next };
      }),
    );
  }

  function handleDragStart(index: number) {
    dragItem.current = index;
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
  }

  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...localCols];
    const dragged = items[dragItem.current];
    items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, dragged);
    setLocalCols(items);
    dragItem.current = null;
    dragOverItem.current = null;
  }

  function handleApply() {
    setColumns(localCols);
    onClose();
  }

  function handleReset() {
    setLocalCols(defaultColumns);
  }

  return (
    <div className="w-[300px]">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Columns</h4>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mb-3 border-t border-border" />
      <div className="flex flex-col gap-0.5">
        {localCols.map((col, idx) => (
          <div
            key={col.key}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/60 transition-colors cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
            <Checkbox
              checked={col.visible}
              onCheckedChange={() => toggleVisible(col.key)}
              className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
            />
            <span className="flex-1 text-sm text-foreground">{col.label}</span>
            <button
              onClick={() => cyclePin(col.key)}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                col.pinned === 'left'
                  ? 'bg-[#f5f3ff] text-[#7c3aed]'
                  : col.pinned === 'right'
                    ? 'bg-[#dbeafe] text-[#3b82f6]'
                    : 'text-muted-foreground/40 hover:text-muted-foreground'
              }`}
              title={
                col.pinned === 'none' ? 'Pin left' : col.pinned === 'left' ? 'Pin right' : 'Unpin'
              }
              aria-label={`Pin ${col.label}`}
            >
              <Pin className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-border" />
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={handleReset}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset to Default
        </button>
        <Button
          size="sm"
          className="h-8 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
          onClick={handleApply}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

/* ───────────── Skeleton ───────────── */

export function InvoiceListSkeleton() {
  return (
    <div className="mx-auto max-w-7xl">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="mb-6 h-9 w-48" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/60 px-4 py-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Main Component ───────────── */

export function InvoiceList() {
  const [activeView, setActiveView] = useState('overdue');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [activeFilterCount] = useState(3);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search on Cmd/Ctrl+K
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleRow(id: string) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllRows(ids: string[]) {
    const allSelected = ids.every((id) => selectedRows.has(id));
    if (allSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(ids));
  }

  const currentViewTab = viewTabs.find((v) => v.id === activeView) || viewTabs[0];

  const filtered = useMemo(() => {
    let result = [...invoices];

    // Apply view filter
    const f = currentViewTab.filter;
    if (f === 'Overdue' || f === 'Paid' || f === 'Due Soon' || f === 'Draft' || f === 'Posted') {
      result = result.filter((inv) => inv.status === f);
    } else if (f === 'HighValue') {
      result = result.filter((inv) => inv.amount >= 10000);
    } else if (f === 'ThisMonth') {
      result = result.filter((inv) => inv.date.includes('Feb 2026'));
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (inv) => inv.number.toLowerCase().includes(q) || inv.customer.toLowerCase().includes(q),
      );
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'number':
            cmp = a.number.localeCompare(b.number);
            break;
          case 'customer':
            cmp = a.customer.localeCompare(b.customer);
            break;
          case 'date':
            cmp = a.date.localeCompare(b.date);
            break;
          case 'amount':
            cmp = a.amount - b.amount;
            break;
          case 'status':
            cmp = a.status.localeCompare(b.status);
            break;
          case 'dueDate':
            cmp = a.dueDate.localeCompare(b.dueDate);
            break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [currentViewTab.filter, searchQuery, sortKey, sortDir]);

  const allFilteredIds = filtered.map((inv) => inv.id);
  const allSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedRows.has(id));
  const someSelected = allFilteredIds.some((id) => selectedRows.has(id)) && !allSelected;

  const viewLabel =
    currentViewTab.filter === 'All' ? 'invoices' : `${currentViewTab.label.toLowerCase()} invoices`;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/finance">Finance</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Invoices</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header */}
      <div
        className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <div>
          <p className="text-sm text-muted-foreground">Finance &mdash; Invoices</p>
          <h1 className="font-serif text-2xl font-bold text-foreground">Invoices</h1>
        </div>
        <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6] rounded-lg text-sm font-medium">
          <Plus className="mr-1.5 h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {/* KPI Strip */}
      <div
        className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in-up"
        style={{ animationDelay: '80ms' }}
      >
        <KpiMini label="Total Invoices" value="82" change="+10.8%" changeType="up" />
        <KpiMini
          label="Pending"
          value="18"
          change="+50%"
          changeType="up"
          colorClass="text-[#d97706]"
        />
        <KpiMini
          label="Overdue"
          value="7"
          change="urgent"
          changeType="up"
          colorClass="text-[#ef4444]"
        />
        <KpiMini
          label="Collected This Month"
          value={formatCurrency(289400)}
          change="+11%"
          changeType="up"
          colorClass="text-[#10b981]"
        />
      </div>

      {/* ── Toolbar Row 1: Search + Buttons ── */}
      <div
        className="mb-2 animate-fade-in-up flex items-center gap-2"
        style={{ animationDelay: '100ms' }}
      >
        {/* Search - flex-1 to fill available space */}
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm focus-within:border-[#c4b5fd] focus-within:ring-1 focus-within:ring-[#7c3aed]/20 transition-all">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        {/* Columns button with Popover */}
        <Popover open={columnsOpen} onOpenChange={setColumnsOpen}>
          <PopoverTrigger asChild>
            <button className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-all hover:border-[#c4b5fd] hover:bg-[#f5f3ff] hover:text-[#7c3aed]">
              <Columns3 className="h-4 w-4" />
              <span className="hidden sm:inline">Columns</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-auto rounded-xl border border-border bg-card p-4 shadow-[0_4px_24px_rgba(124,58,237,0.08)]"
          >
            <ColumnsPopoverContent
              columns={columns}
              setColumns={setColumns}
              onClose={() => setColumnsOpen(false)}
            />
          </PopoverContent>
        </Popover>

        {/* Filter button */}
        <button className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-all hover:border-[#c4b5fd] hover:bg-[#f5f3ff] hover:text-[#7c3aed]">
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filter</span>
          {activeFilterCount > 0 && (
            <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#7c3aed] px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Advanced button */}
        <button className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-all hover:border-[#c4b5fd] hover:bg-[#f5f3ff] hover:text-[#7c3aed]">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Advanced</span>
        </button>
      </div>

      {/* ── Toolbar Row 2: Views Bar ── */}
      <div
        className="mb-4 animate-fade-in-up flex items-center justify-between gap-2"
        style={{ animationDelay: '120ms' }}
      >
        {/* Left: view pill tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {viewTabs.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeView === view.id
                  ? 'bg-[#7c3aed] text-white shadow-sm'
                  : 'border border-border bg-card text-muted-foreground hover:border-[#c4b5fd] hover:bg-[#f5f3ff]'
              }`}
            >
              {view.label}
              {view.favourite && (
                <Star
                  className={`h-3 w-3 ${activeView === view.id ? 'fill-white text-white' : 'fill-[#f59e0b] text-[#f59e0b]'}`}
                />
              )}
            </button>
          ))}
          <button className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
            +2 more
          </button>
        </div>

        {/* Right: Save / Delete */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button className="flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-[#c4b5fd] hover:bg-[#f5f3ff] hover:text-[#7c3aed]">
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save</span>
          </button>
          <button className="flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground/60 transition-colors hover:border-destructive/40 hover:bg-[#fef2f2] hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* ── Data Table ── */}
      <div
        className="animate-fade-in-up overflow-hidden rounded-xl border border-[#f3f4f6] bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        style={{ animationDelay: '150ms' }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]">
                <TableHead className="h-11 w-12 px-4">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={() => toggleAllRows(allFilteredIds)}
                    aria-label="Select all"
                    className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
                  />
                </TableHead>
                {[
                  { key: 'number' as SortKey, label: 'Invoice #' },
                  { key: 'customer' as SortKey, label: 'Customer' },
                  { key: 'date' as SortKey, label: 'Date' },
                  { key: 'amount' as SortKey, label: 'Amount', align: 'right' as const },
                  { key: 'status' as SortKey, label: 'Status' },
                  { key: 'dueDate' as SortKey, label: 'Due Date' },
                ].map((col) => (
                  <TableHead
                    key={col.key}
                    className={`h-11 px-4 ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    <button
                      className={`group flex items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${col.align === 'right' ? 'ml-auto' : ''}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      <SortIndicator sortKey={sortKey} sortDir={sortDir} column={col.key} />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                        <SearchX className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No results found</p>
                      <p className="text-xs text-muted-foreground">
                        Try adjusting your search or filters
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-[#f5f3ff]/30"
                  >
                    <TableCell className="w-12 px-4 py-3.5">
                      <Checkbox
                        checked={selectedRows.has(inv.id)}
                        onCheckedChange={() => toggleRow(inv.id)}
                        aria-label={`Select ${inv.number}`}
                        className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <Link
                        href={inv.id === 'inv1' ? '/invoices/INV-2026-0042' : '#'}
                        className="font-mono text-sm font-semibold text-[#7c3aed] hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <span className="text-sm text-foreground">{inv.customer}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <span className="text-sm text-muted-foreground">{inv.date}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-right">
                      <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                        {formatCurrency(inv.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyles[inv.status]}`}
                      >
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3.5">
                      <span className="text-sm text-muted-foreground">{inv.dueDate}</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Table footer */}
      <div
        className="mt-4 animate-fade-in-up flex items-center justify-between"
        style={{ animationDelay: '180ms' }}
      >
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span> of{' '}
          <span className="font-medium text-foreground">{filtered.length}</span> {viewLabel}
        </p>
        {filtered.length > 25 && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg border-border text-sm font-medium text-muted-foreground hover:border-[#c4b5fd] hover:bg-[#f5f3ff] hover:text-[#7c3aed]"
          >
            Load More
          </Button>
        )}
      </div>
    </div>
  );
}
