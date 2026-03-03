'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Eye, Save } from 'lucide-react';
import Link from 'next/link';

const sampleVars: Record<string, string> = {
  number: 'INV-00234',
  total: '\u00a34,250.00',
  due_date: '15 March 2026',
  contact: 'Mr Smith',
  company_name: 'Acme Ltd',
  signature: 'Kind regards,\nAcme Ltd',
  bank_details: 'Sort: 20-00-00 / Acc: 12345678',
};

const availableVariables = [
  'number',
  'total',
  'due_date',
  'contact',
  'company_name',
  'signature',
  'bank_details',
];

const defaultSubject = 'Invoice {{number}} from {{company_name}}';
const defaultBody = `Dear {{contact}},

Please find attached invoice {{number}} for {{total}}.

Payment is due by {{due_date}}.

{{signature}}`;

function resolveVars(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

export default function EmailTemplateEditorPage() {
  const params = useParams();
  const [name, setName] = useState('Sales Invoice');
  const [docType, setDocType] = useState('invoice');
  const [language, setLanguage] = useState('en');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewBody, setPreviewBody] = useState('');

  const updatePreview = useCallback(() => {
    setPreviewSubject(resolveVars(subject, sampleVars));
    setPreviewBody(resolveVars(body, sampleVars));
  }, [subject, body]);

  useEffect(() => {
    const timeout = setTimeout(updatePreview, 500);
    return () => clearTimeout(timeout);
  }, [updatePreview]);

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings">System</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/system/email-templates/sales-invoice">
              Email Templates
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div
        className="mb-6 flex items-center justify-between animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-serif text-2xl font-bold text-foreground">Email Template: {name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-border text-foreground hover:bg-[#f5f3ff]">
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      <div
        className="animate-fade-in-up grid grid-cols-1 gap-6 lg:grid-cols-2"
        style={{ animationDelay: '100ms' }}
      >
        {/* Editor Pane */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">Editor</h3>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="credit_note">Credit Note</SelectItem>
                    <SelectItem value="statement">Statement</SelectItem>
                    <SelectItem value="purchase_order">Purchase Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Body (HTML)</Label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="w-full resize-none rounded-lg border border-border bg-[#1e1b4b] p-4 font-mono text-sm text-[#e0e7ff] outline-none focus:ring-2 focus:ring-[#7c3aed]"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {'Type {{ to insert a variable. Available: '}
                {availableVariables.map((v, i) => (
                  <span key={v}>
                    <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px] text-[#7c3aed]">{`{{${v}}}`}</code>
                    {i < availableVariables.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>

        {/* Live Preview Pane */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">Live Preview</h3>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Subject
            </p>
            <p className="mb-4 text-sm font-medium text-foreground">{previewSubject || '...'}</p>
            <div className="border-t border-border pt-4">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {previewBody || '...'}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Variables Available
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableVariables.map((v) => (
                <span
                  key={v}
                  className="rounded-full bg-[#f5f3ff] px-2 py-0.5 font-mono text-[11px] text-[#7c3aed]"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="mt-4 animate-fade-in-up text-xs text-muted-foreground"
        style={{ animationDelay: '150ms' }}
      >
        Version: 3 | Last edited: 2h ago by Sarah
      </div>
    </div>
  );
}
