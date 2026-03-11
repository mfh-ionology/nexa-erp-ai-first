'use client';

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  MoreHorizontal,
  Printer,
  Sparkles,
  Mail,
  FileDown,
  Copy,
  Ban,
  History,
  Plus,
} from 'lucide-react';
import { AttachmentPanel } from '@/components/panels/attachment-panel';
import { NotesPanel } from '@/components/panels/notes-panel';
import { RecordLinksPanel } from '@/components/panels/record-links-panel';
import { TaskPanel } from '@/components/tasks/task-panel';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(amount);
}

const lineItems = [
  { code: 'WDG-A-PRM', description: 'Widget-A Premium', qty: 50, unitPrice: 400, vatPct: 20 },
  { code: 'WDG-B-STD', description: 'Widget-B Standard', qty: 100, unitPrice: 84, vatPct: 20 },
];

const timeline = [
  {
    label: 'Created',
    date: '17 Feb 2026, 09:15',
    by: 'Sarah Chen',
    color: '#9ca3af',
    pulse: false,
  },
  {
    label: 'Submitted',
    date: '17 Feb 2026, 10:30',
    by: 'Sarah Chen',
    color: '#3b82f6',
    pulse: false,
  },
  {
    label: 'Approved',
    date: '17 Feb 2026, 14:20',
    by: 'David Morris',
    color: '#10b981',
    pulse: false,
  },
  { label: 'Overdue', date: '19 Mar 2026', by: 'System', color: '#ef4444', pulse: true },
];

export default function InvoiceDetailPage() {
  const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

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
            <BreadcrumbLink href="/invoices">Invoices</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>INV-2026-0042</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header */}
      <div
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-3xl font-bold text-foreground">INV-2026-0042</h1>
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}
          >
            Overdue
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            <Mail className="h-4 w-4" />
            Send Reminder
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <div className="flex items-center gap-0.5 border-l border-border pl-2 ml-1">
            <AttachmentPanel />
            <NotesPanel />
            <RecordLinksPanel />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2">
                <Mail className="h-4 w-4" /> Email to Customer
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <FileDown className="h-4 w-4" /> Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Copy className="h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[#ef4444] focus:text-[#ef4444]">
                <Ban className="h-4 w-4" /> Void
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2">
                <History className="h-4 w-4" /> View Audit Log
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Info Grid */}
      <div
        className="animate-fade-in-up mb-6 rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
        style={{ animationDelay: '100ms' }}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Customer
              </p>
              <p className="mt-0.5 text-sm font-medium text-[#7c3aed]">{'Acme Corp (AC-001)'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Address
              </p>
              <p className="mt-0.5 text-sm text-foreground">14 High Street, London EC2V 8AR</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contact
              </p>
              <p className="mt-0.5 text-sm text-foreground">James Walker, james@acmecorp.co.uk</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Invoice Date
              </p>
              <p className="mt-0.5 text-sm text-foreground">17/02/2026</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Due Date
              </p>
              <p className="mt-0.5 text-sm font-medium text-[#ef4444]">19/03/2026</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payment Terms
                </p>
                <p className="mt-0.5 text-sm text-foreground">NET30</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reference
                </p>
                <p className="mt-0.5 font-mono text-sm text-foreground">PO-2026-0031</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div
        className="animate-fade-in-up mb-6 rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
        style={{ animationDelay: '150ms' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-sm font-semibold text-foreground">Line Items</h3>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-border text-foreground hover:bg-[#f5f3ff]"
          >
            <Plus className="h-3 w-3" /> Add Line
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]">
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Item Code
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Qty
                </TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Unit Price
                </TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  VAT %
                </TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Line Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((item) => (
                <TableRow
                  key={item.code}
                  className="border-b border-border/60 hover:bg-[#f5f3ff]/50"
                >
                  <TableCell className="px-4 py-3 font-mono text-sm text-foreground">
                    {item.code}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground">
                    {item.description}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                    {item.qty}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                    {formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                    {item.vatPct}%
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-sm font-bold tabular-nums text-foreground">
                    {formatCurrency(item.qty * item.unitPrice)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-[250px]">
            <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">
              <span>VAT (20%)</span>
              <span className="font-mono tabular-nums">{formatCurrency(vat)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="font-mono text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Task Panel */}
      <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '175ms' }}>
        <TaskPanel
          entityType="CustomerInvoice"
          entityId="INV-2026-0042"
          entityLabel="Invoice INV-2026-0042 — Acme Corp"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status Timeline */}
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
          style={{ animationDelay: '200ms' }}
        >
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">Status Timeline</h3>
          <div className="relative flex flex-col">
            {timeline.map((item, idx) => (
              <div key={idx} className="relative flex gap-3 pb-6 last:pb-0">
                {idx < timeline.length - 1 && (
                  <div className="absolute left-[9px] top-5 h-full w-px bg-[#ede9fe]" />
                )}
                <div className="relative z-10 mt-1 flex shrink-0 items-center justify-center">
                  <span
                    className={`block h-5 w-5 rounded-full border-[3px] bg-card ${item.pulse ? 'animate-pulse' : ''}`}
                    style={{ borderColor: item.color }}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.date}</span>
                  <span className="text-xs text-muted-foreground">{item.by}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insight Card */}
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
          style={{
            animationDelay: '250ms',
            borderLeftWidth: '3px',
            borderLeftColor: '#7c3aed',
            background:
              'linear-gradient(135deg, rgba(124,58,237,0.02) 0%, rgba(255,255,255,1) 50%)',
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#7c3aed]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7c3aed]">
              AI Insight
            </span>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-foreground">
            This invoice is 89 days overdue. Acme Corp has a 67% payment probability. Recommended
            action: Send formal payment demand.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8 bg-[#7c3aed] text-xs text-white hover:bg-[#5b21b6]">
              Send Reminder
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-border text-foreground hover:bg-[#f5f3ff]"
            >
              Schedule Call
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
