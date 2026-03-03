import { Check, X } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';

const accessGroups = [
  { code: 'SALES_MGR', name: 'Sales Manager', assignedBy: 'Mohammed Hussein', date: '12 Jan 2026' },
  { code: 'REPORTS_VIEW', name: 'Reports Viewer', assignedBy: 'System', date: '1 Mar 2024' },
];

const permissions = [
  { resource: 'Invoices', access: true, new_: true, view: true, edit: true, delete: false },
  { resource: 'Customers', access: true, new_: true, view: true, edit: true, delete: false },
  { resource: 'Purchase Orders', access: true, new_: false, view: true, edit: true, delete: false },
  { resource: 'Reports', access: true, new_: false, view: true, edit: false, delete: false },
  { resource: 'Settings', access: false, new_: false, view: false, edit: false, delete: false },
];

const activityTimeline = [
  { action: 'Approved PO-2026-0031', time: '2 hours ago' },
  { action: 'Viewed Invoice INV-2026-0055', time: '3 hours ago' },
  { action: 'Updated customer Acme Corp', time: 'Yesterday' },
  { action: 'Logged in', time: '17 Feb 2026, 09:42' },
];

function PermIcon({ granted }: { granted: boolean }) {
  return granted ? (
    <Check className="h-4 w-4 text-[#10b981]" aria-label="Granted" />
  ) : (
    <X className="h-4 w-4 text-[#ef4444]" aria-label="Denied" />
  );
}

export default function UserDetailPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb className="mb-4 animate-fade-in-up">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">System</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/users">Users</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Sarah Chen</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Profile Card */}
      <div
        className="animate-fade-in-up mb-6 rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
        style={{ animationDelay: '50ms' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-lg font-bold text-white">
              SC
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-3xl font-bold text-foreground">Sarah Chen</h1>
                <span className="inline-flex items-center rounded-full border border-[#93c5fd] bg-[#dbeafe] px-2.5 py-0.5 text-xs font-semibold text-[#3b82f6]">
                  Admin
                </span>
              </div>
              <p className="text-sm text-muted-foreground">sarah.chen@meridian.co.uk</p>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                  Active
                </span>
                <span>Last login: 17 Feb 2026, 09:42</span>
                <span>Member since: March 2024</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 self-start">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-foreground hover:bg-[#f5f3ff]"
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-[#ef4444] hover:bg-[#fee2e2] hover:text-[#dc2626]"
            >
              Deactivate
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Access Groups Card */}
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
          style={{ animationDelay: '100ms' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-sm font-semibold text-foreground">Access Groups</h3>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#ede9fe] text-xs font-semibold text-[#7c3aed]">
                {accessGroups.length}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-border text-foreground hover:bg-[#f5f3ff]"
            >
              + Add
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {accessGroups.map((group) => (
              <div
                key={group.code}
                className="group flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-[#f5f3ff]/50"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {group.code}
                    </span>
                    <span className="text-sm text-muted-foreground">{group.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {'Assigned by '}
                    {group.assignedBy}
                    {' \u00B7 '}
                    {group.date}
                  </p>
                </div>
                <button
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-[#fee2e2] hover:text-[#ef4444] group-hover:opacity-100"
                  aria-label={`Remove ${group.code}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Timeline Card */}
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
          style={{ animationDelay: '150ms' }}
        >
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">Recent Activity</h3>
          <div className="relative flex flex-col gap-0">
            {activityTimeline.map((item, idx) => (
              <div key={idx} className="relative flex gap-3 pb-6 last:pb-0">
                {idx < activityTimeline.length - 1 && (
                  <div className="absolute left-[7px] top-4 h-full w-px bg-[#ede9fe]" />
                )}
                <div className="relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#7c3aed] bg-card" />
                <div className="flex flex-col">
                  <span className="text-sm text-foreground">{item.action}</span>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Permissions Summary Card */}
      <div
        className="animate-fade-in-up mt-6 rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
        style={{ animationDelay: '200ms' }}
      >
        <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
          Effective Permissions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Resource
                </th>
                <th className="pb-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Access
                </th>
                <th className="pb-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New
                </th>
                <th className="pb-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  View
                </th>
                <th className="pb-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Edit
                </th>
                <th className="pb-3 pl-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Delete
                </th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm, idx) => (
                <tr key={perm.resource} className={idx % 2 === 1 ? 'bg-[#f5f3ff]/30' : ''}>
                  <td className="py-3 pr-4 text-sm font-medium text-foreground">{perm.resource}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <PermIcon granted={perm.access} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <PermIcon granted={perm.new_} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <PermIcon granted={perm.view} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <PermIcon granted={perm.edit} />
                    </div>
                  </td>
                  <td className="py-3 pl-4 text-center">
                    <div className="flex justify-center">
                      <PermIcon granted={perm.delete} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
