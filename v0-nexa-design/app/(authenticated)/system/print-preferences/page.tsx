'use client';

import { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PrintPref {
  docType: string;
  action: string;
}

const defaultUserPrefs: PrintPref[] = [
  { docType: 'Sales Invoice', action: 'auto_download' },
  { docType: 'Credit Note', action: 'print_dialog' },
  { docType: 'Sales Order', action: 'do_nothing' },
  { docType: 'Purchase Order', action: 'auto_download' },
  { docType: 'Delivery Note', action: 'print_dialog' },
  { docType: 'Payslip', action: 'do_nothing' },
  { docType: 'Customer Statement', action: 'auto_download' },
];

const defaultCompanyPrefs: PrintPref[] = [
  { docType: 'Sales Invoice', action: 'auto_download' },
  { docType: 'Credit Note', action: 'do_nothing' },
  { docType: 'Sales Order', action: 'do_nothing' },
  { docType: 'Purchase Order', action: 'auto_download' },
  { docType: 'Delivery Note', action: 'do_nothing' },
  { docType: 'Payslip', action: 'do_nothing' },
  { docType: 'Customer Statement', action: 'do_nothing' },
];

const actionLabels: Record<string, string> = {
  auto_download: 'Auto Download PDF',
  print_dialog: 'Open Print Dialog',
  do_nothing: 'Do Nothing',
  company_default: 'Use Company Default',
};

export default function PrintPreferencesPage() {
  const [userPrefs, setUserPrefs] = useState(defaultUserPrefs);
  const [companyPrefs, setCompanyPrefs] = useState(defaultCompanyPrefs);

  const updateUserPref = (idx: number, action: string) => {
    setUserPrefs((prev) => prev.map((p, i) => (i === idx ? { ...p, action } : p)));
  };

  const updateCompanyPref = (idx: number, action: string) => {
    setCompanyPrefs((prev) => prev.map((p, i) => (i === idx ? { ...p, action } : p)));
  };

  const resetDefaults = () =>
    setUserPrefs(defaultUserPrefs.map((p) => ({ ...p, action: 'company_default' })));

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings">System</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Print Preferences</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1
        className="mb-2 font-serif text-3xl font-bold text-foreground animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        Print Preferences
      </h1>
      <p
        className="mb-6 text-sm text-muted-foreground animate-fade-in-up"
        style={{ animationDelay: '75ms' }}
      >
        Choose what happens when you save or approve a document.
      </p>

      <div
        className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        style={{ animationDelay: '100ms' }}
      >
        {/* User Preferences */}
        <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
          Your Preferences (overrides company defaults)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Document Type
                </th>
                <th className="pb-2 pl-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  On Save Action
                </th>
              </tr>
            </thead>
            <tbody>
              {userPrefs.map((pref, idx) => (
                <tr key={pref.docType} className="border-b border-border/50 last:border-b-0">
                  <td className="py-3 pr-4 text-sm text-foreground">{pref.docType}</td>
                  <td className="py-3 pl-4">
                    <Select value={pref.action} onValueChange={(v) => updateUserPref(idx, v)}>
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto_download">Auto Download PDF</SelectItem>
                        <SelectItem value="print_dialog">Open Print Dialog</SelectItem>
                        <SelectItem value="do_nothing">Do Nothing</SelectItem>
                        <SelectItem value="company_default">Use Company Default</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Company Defaults */}
        <div className="mt-6 border-t border-border pt-6">
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
            Company Defaults (Admin only)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Document Type
                  </th>
                  <th className="pb-2 pl-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    On Save Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {companyPrefs.map((pref, idx) => (
                  <tr key={pref.docType} className="border-b border-border/50 last:border-b-0">
                    <td className="py-3 pr-4 text-sm text-foreground">{pref.docType}</td>
                    <td className="py-3 pl-4">
                      <Select value={pref.action} onValueChange={(v) => updateCompanyPref(idx, v)}>
                        <SelectTrigger className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto_download">Auto Download PDF</SelectItem>
                          <SelectItem value="print_dialog">Open Print Dialog</SelectItem>
                          <SelectItem value="do_nothing">Do Nothing</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
          <Button
            variant="ghost"
            onClick={resetDefaults}
            className="text-muted-foreground hover:text-foreground hover:bg-[#f5f3ff]"
          >
            Reset to Company Defaults
          </Button>
          <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">Save</Button>
        </div>
      </div>
    </div>
  );
}
