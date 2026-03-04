/* eslint-disable i18next/no-literal-string */
/**
 * Invoice Detail Page — v0 Concept D reference implementation.
 *
 * Static mock data showcasing the v0 design system for record detail with:
 * - Action bar, info grid, line items table, status timeline, AI insight card.
 * Will be wired to real API in E14 (AR module).
 */

import { useI18n, useLocale } from '@nexa/i18n';
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

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { EmailCompositionDialog, useEmailAction } from '@/features/email';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

/* ── Static data ────────────────────────────────────────────── */

const lineItems = [
  { code: 'WDG-A-PRM', description: 'Widget-A Premium', qty: 50, unitPrice: 400, vatPct: 20 },
  { code: 'WDG-B-STD', description: 'Widget-B Standard', qty: 100, unitPrice: 84, vatPct: 20 },
];

const timeline = [
  {
    labelKey: 'status.created',
    date: '17 Feb 2026, 09:15',
    by: 'Sarah Chen',
    color: '#9ca3af',
    pulse: false,
  },
  {
    labelKey: 'status.submitted',
    date: '17 Feb 2026, 10:30',
    by: 'Sarah Chen',
    color: '#3b82f6',
    pulse: false,
  },
  {
    labelKey: 'status.approved',
    date: '17 Feb 2026, 14:20',
    by: 'David Morris',
    color: '#10b981',
    pulse: false,
  },
  { labelKey: 'status.overdue', date: '19 Mar 2026', by: 'System', color: '#ef4444', pulse: true },
];

/* ── Component ──────────────────────────────────────────────── */

export function InvoiceDetailPage() {
  const { t } = useI18n();
  const locale = useLocale();

  // Mock record data — will be replaced with real API data in E14
  const mockRecordId = '00000000-0000-0000-0000-000000000001';
  const mockStatus = 'POSTED'; // POSTED invoices are sendable

  const { canEmail, openEmailDialog, emailDialogOpen, setEmailDialogOpen, emailActionLabel } =
    useEmailAction({
      documentType: 'CustomerInvoice',
      status: mockStatus,
    });

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(amount);
  }
  const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Page Header */}
      <div
        className="mb-6 flex flex-col gap-4 animate-fade-in-up sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: '50ms' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-3xl font-bold text-foreground">INV-2026-0042</h1>
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}
          >
            {t('status.overdue')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            <Mail className="h-4 w-4" />
            {t('invoices.action.sendReminder')}
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground"
          >
            <Printer className="h-4 w-4" />
            {t('print')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2" disabled={!canEmail} onClick={openEmailDialog}>
                <Mail className="h-4 w-4" /> {emailActionLabel}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <FileDown className="h-4 w-4" /> {t('actionBar.exportPdf')}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Copy className="h-4 w-4" /> {t('actionBar.duplicate')}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-[#ef4444] focus:text-[#ef4444]">
                <Ban className="h-4 w-4" /> {t('actionBar.void')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2">
                <History className="h-4 w-4" /> {t('actionBar.viewAuditLog')}
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
                {t('invoices.field.customer')}
              </p>
              <p className="mt-0.5 text-sm font-medium text-[#7c3aed]">Acme Corp (AC-001)</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('invoices.field.address')}
              </p>
              <p className="mt-0.5 text-sm text-foreground">14 High Street, London EC2V 8AR</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('invoices.field.contact')}
              </p>
              <p className="mt-0.5 text-sm text-foreground">James Walker, james@acmecorp.co.uk</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('invoices.field.invoiceDate')}
              </p>
              <p className="mt-0.5 text-sm text-foreground">17/02/2026</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('invoices.field.dueDate')}
              </p>
              <p className="mt-0.5 text-sm font-medium text-[#ef4444]">19/03/2026</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('invoices.field.paymentTerms')}
                </p>
                <p className="mt-0.5 text-sm text-foreground">NET30</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('invoices.field.reference')}
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
          <h3 className="font-serif text-sm font-semibold text-foreground">{t('lineItems')}</h3>
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-border text-xs text-foreground hover:bg-[#f5f3ff]"
          >
            <Plus className="h-3 w-3" /> {t('addLine')}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-[rgba(107,114,128,0.04)] hover:bg-[rgba(107,114,128,0.04)]">
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('invoices.column.itemCode')}
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('invoices.column.description')}
                </TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('invoices.column.qty')}
                </TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('invoices.column.unitPrice')}
                </TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('invoices.column.vatPct')}
                </TableHead>
                <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('invoices.column.lineTotal')}
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
              <span>{t('subtotal')}</span>
              <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between py-2 text-sm text-muted-foreground">
              <span>{t('vatAmount', { rate: '20%' })}</span>
              <span className="font-mono tabular-nums">{formatCurrency(vat)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-semibold text-foreground">{t('total')}</span>
              <span className="font-mono text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status Timeline */}
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
          style={{ animationDelay: '200ms' }}
        >
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
            {t('actionBar.statusTimeline')}
          </h3>
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
                  <span className="text-sm font-medium text-foreground">{t(item.labelKey)}</span>
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
              {t('aiSummary')}
            </span>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-foreground">
            {t('invoices.aiInsight.overdueSummary')}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8 bg-[#7c3aed] text-xs text-white hover:bg-[#5b21b6]">
              {t('invoices.action.sendReminder')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-border text-xs text-foreground hover:bg-[#f5f3ff]"
            >
              {t('invoices.action.scheduleCall')}
            </Button>
          </div>
        </div>
      </div>

      {/* Email Composition Dialog */}
      <EmailCompositionDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        documentType="CustomerInvoice"
        recordId={mockRecordId}
        documentTitle="Invoice INV-2026-0042"
      />
    </div>
  );
}
