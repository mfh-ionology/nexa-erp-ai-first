'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, Edit3, Eye, Save, ArrowLeft } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  category: string;
  isDefault: boolean;
  version: number;
}

const templates: Template[] = [
  {
    id: 'sales-invoice',
    name: 'Sales Invoice',
    category: 'Invoice Templates',
    isDefault: true,
    version: 3,
  },
  {
    id: 'credit-note',
    name: 'Credit Note',
    category: 'Invoice Templates',
    isDefault: true,
    version: 2,
  },
  {
    id: 'proforma',
    name: 'Proforma Invoice',
    category: 'Invoice Templates',
    isDefault: true,
    version: 1,
  },
  {
    id: 'statement',
    name: 'Customer Statement',
    category: 'Invoice Templates',
    isDefault: true,
    version: 1,
  },
  { id: 'po', name: 'Purchase Order', category: 'Purchase Templates', isDefault: true, version: 2 },
  {
    id: 'grn',
    name: 'Goods Receipt Note',
    category: 'Purchase Templates',
    isDefault: true,
    version: 1,
  },
  {
    id: 'remittance',
    name: 'Supplier Remittance',
    category: 'Purchase Templates',
    isDefault: true,
    version: 1,
  },
  { id: 'payslip', name: 'Payslip', category: 'Payroll Templates', isDefault: true, version: 1 },
  { id: 'p45', name: 'P45', category: 'Payroll Templates', isDefault: true, version: 1 },
  { id: 'p60', name: 'P60', category: 'Payroll Templates', isDefault: true, version: 1 },
];

const categories = ['Invoice Templates', 'Purchase Templates', 'Payroll Templates'];

const sampleHtml = `<div class="head">
  {{#if showLogo}}
  <img src="{{logo}}"/>
  {{/if}}
  <h1>INVOICE</h1>
  <p>{{company_name}}</p>
</div>
<div class="body">
  <p>To: {{customer_name}}</p>
  <p>Invoice: {{number}}</p>
  <p>Date: {{date}}</p>

  <table>
    {{#each lines}}
    <tr>
      <td>{{description}}</td>
      <td>{{total}}</td>
    </tr>
    {{/each}}
  </table>

  <p>Total: {{total}}</p>
  {{#if showBank}}
  <p>Bank: {{bank}}</p>
  {{/if}}
</div>`;

export default function DocumentTemplatesPage() {
  const [search, setSearch] = useState('');
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [htmlContent, setHtmlContent] = useState(sampleHtml);
  const [pageSize, setPageSize] = useState('a4');
  const [showLogo, setShowLogo] = useState(true);
  const [showBank, setShowBank] = useState(true);
  const [showVat, setShowVat] = useState(true);

  const filtered = templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const grouped = categories
    .map((cat) => ({
      category: cat,
      items: filtered.filter((t) => t.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings">System</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Document Templates</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <h1 className="font-serif text-3xl font-bold text-foreground">Document Templates</h1>
        <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '75ms' }}>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Template List */}
      <div className="animate-fade-in-up space-y-6" style={{ animationDelay: '100ms' }}>
        {grouped.map((group) => (
          <div key={group.category}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.category}
            </h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              {group.items.map((tmpl, idx) => (
                <div
                  key={tmpl.id}
                  className={`flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[#f5f3ff]/50 ${
                    idx < group.items.length - 1 ? 'border-b border-border/50' : ''
                  }`}
                >
                  <span className="flex-1 text-sm font-medium text-foreground">{tmpl.name}</span>
                  {tmpl.isDefault && (
                    <span className="rounded-full bg-[#f5f3ff] px-2 py-0.5 text-[10px] font-semibold text-[#7c3aed]">
                      Default
                    </span>
                  )}
                  <span className="font-mono text-xs text-muted-foreground">v{tmpl.version}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditTemplate(tmpl);
                      setHtmlContent(sampleHtml);
                    }}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-[#f5f3ff]"
                  >
                    <Edit3 className="h-3 w-3" /> Edit
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Template Editor Sheet */}
      <Sheet open={!!editTemplate} onOpenChange={(open) => !open && setEditTemplate(null)}>
        <SheetContent className="w-full sm:max-w-[900px] p-0">
          <SheetHeader className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditTemplate(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <SheetTitle className="text-base font-semibold">
                  Template: {editTemplate?.name}
                </SheetTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-[#f5f3ff]"
                >
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
                <Button size="sm" className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </div>
          </SheetHeader>
          <div className="grid h-[calc(100vh-80px)] grid-cols-2 overflow-hidden">
            {/* Left: Settings + HTML Editor */}
            <div className="flex flex-col gap-4 overflow-y-auto border-r border-border p-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Settings
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Page</Label>
                  <Select value={pageSize} onValueChange={setPageSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4</SelectItem>
                      <SelectItem value="letter">Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Orientation</Label>
                  <Select defaultValue="portrait">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show Logo</Label>
                  <Switch checked={showLogo} onCheckedChange={setShowLogo} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show Bank Details</Label>
                  <Switch checked={showBank} onCheckedChange={setShowBank} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show VAT</Label>
                  <Switch checked={showVat} onCheckedChange={setShowVat} />
                </div>
              </div>
              <h4 className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                HTML Template
              </h4>
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                className="min-h-[300px] flex-1 resize-none rounded-lg border border-border bg-[#1e1b4b] p-4 font-mono text-xs leading-relaxed text-[#e0e7ff] outline-none focus:ring-2 focus:ring-[#7c3aed]"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Versions:</span>
                {[1, 2, 3].map((v) => (
                  <button
                    key={v}
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      v === (editTemplate?.version || 1)
                        ? 'bg-[#7c3aed] text-white'
                        : 'bg-secondary text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    v{v}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: PDF Preview */}
            <div className="flex flex-col gap-4 overflow-y-auto bg-secondary/30 p-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                PDF Preview
              </h4>
              <div
                className="mx-auto w-full max-w-[280px] rounded border border-border bg-white p-6 shadow-md"
                style={{ aspectRatio: '210 / 297' }}
              >
                <div className="flex flex-col gap-2 text-[8px] leading-relaxed text-foreground">
                  <div className="text-right">
                    <p className="text-[10px] font-bold">ACME LTD</p>
                    <p>14 High Street</p>
                    <p>London EC2V 8AR</p>
                  </div>
                  <p className="mt-2 text-[12px] font-bold">INVOICE</p>
                  <div className="mt-2">
                    <p>To: Customer Name</p>
                    <p className="font-mono">INV-00234</p>
                    <p>Date: 1/3/26</p>
                  </div>
                  <div className="mt-3 border-t border-border pt-2">
                    <div className="flex justify-between">
                      <span>Widget-A Premium x50</span>
                      <span className="font-mono">{'\u00a320,000'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Widget-B Standard x100</span>
                      <span className="font-mono">{'\u00a38,400'}</span>
                    </div>
                  </div>
                  <div className="mt-2 border-t border-border pt-2 font-bold">
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span className="font-mono">{'\u00a334,080'}</span>
                    </div>
                  </div>
                  {showBank && (
                    <div className="mt-4 border-t border-border pt-2 text-[7px] text-muted-foreground">
                      <p>Bank: Sort 20-00-00 / Acc 12345678</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Variables
                </p>
                <p className="text-xs text-muted-foreground">
                  number, date, customer_name, lines[], total, vat, bank
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
