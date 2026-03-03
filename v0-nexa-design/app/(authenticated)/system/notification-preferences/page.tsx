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
import { Checkbox } from '@/components/ui/checkbox';

interface PrefRow {
  event: string;
  inApp: boolean;
  email: boolean;
  push: boolean;
  mandatory?: boolean;
}

interface PrefGroup {
  title: string;
  rows: PrefRow[];
}

const defaultPrefs: PrefGroup[] = [
  {
    title: 'Invoice Events',
    rows: [
      { event: 'Invoice Approved', inApp: true, email: true, push: false },
      { event: 'Invoice Overdue', inApp: true, email: true, push: true },
      { event: 'Payment Received', inApp: true, email: false, push: false },
      { event: 'Credit Note Created', inApp: true, email: false, push: false },
    ],
  },
  {
    title: 'Task Events',
    rows: [
      { event: 'Task Assigned to Me', inApp: true, email: true, push: true },
      { event: 'Task Completed', inApp: true, email: false, push: false },
      { event: 'Task Overdue', inApp: true, email: true, push: false },
    ],
  },
  {
    title: 'System Events',
    rows: [
      { event: 'Permission Changed', inApp: true, email: true, push: false, mandatory: true },
      { event: 'Import Completed', inApp: true, email: false, push: false },
    ],
  },
];

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState(defaultPrefs);

  const toggle = (groupIdx: number, rowIdx: number, channel: 'inApp' | 'email' | 'push') => {
    setPrefs((prev) =>
      prev.map((g, gi) =>
        gi === groupIdx
          ? {
              ...g,
              rows: g.rows.map((r, ri) => (ri === rowIdx ? { ...r, [channel]: !r[channel] } : r)),
            }
          : g,
      ),
    );
  };

  const resetDefaults = () => setPrefs(defaultPrefs);

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings">System</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Notification Preferences</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1
        className="mb-2 font-serif text-3xl font-bold text-foreground animate-fade-in-up"
        style={{ animationDelay: '50ms' }}
      >
        Notification Preferences
      </h1>
      <p
        className="mb-6 text-sm text-muted-foreground animate-fade-in-up"
        style={{ animationDelay: '75ms' }}
      >
        Configure how and when you receive notifications.
      </p>

      <div
        className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        style={{ animationDelay: '100ms' }}
      >
        {prefs.map((group, gi) => (
          <div key={group.title} className={gi > 0 ? 'mt-6 border-t border-border pt-6' : ''}>
            <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">{group.title}</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Event
                    </th>
                    <th className="pb-2 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">
                      In-App
                    </th>
                    <th className="pb-2 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">
                      Email
                    </th>
                    <th className="pb-2 pl-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">
                      Push
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, ri) => (
                    <tr key={row.event} className="border-b border-border/50 last:border-b-0">
                      <td className="py-3 pr-4 text-sm text-foreground">{row.event}</td>
                      <td className="py-3 px-4 text-center">
                        <Checkbox
                          checked={row.inApp}
                          onCheckedChange={() => toggle(gi, ri, 'inApp')}
                          disabled={row.mandatory}
                          className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Checkbox
                          checked={row.email}
                          onCheckedChange={() => toggle(gi, ri, 'email')}
                          className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
                        />
                      </td>
                      <td className="py-3 pl-4 text-center">
                        <Checkbox
                          checked={row.push}
                          onCheckedChange={() => toggle(gi, ri, 'push')}
                          className="data-[state=checked]:bg-[#7c3aed] data-[state=checked]:border-[#7c3aed]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
          <Button
            variant="ghost"
            onClick={resetDefaults}
            className="text-muted-foreground hover:text-foreground hover:bg-[#f5f3ff]"
          >
            Reset to Defaults
          </Button>
          <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">Save</Button>
        </div>
      </div>
    </div>
  );
}
