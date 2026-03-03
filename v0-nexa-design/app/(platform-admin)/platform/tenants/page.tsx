'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  plan: string;
  users: number;
  status: 'active' | 'suspended' | 'provisioning' | 'read_only';
  billing: string;
  billingWarn: boolean;
}

const tenants: Tenant[] = [
  {
    id: 'acme',
    name: 'Acme Corp',
    plan: 'Pro',
    users: 45,
    status: 'active',
    billing: 'Current',
    billingWarn: false,
  },
  {
    id: 'beta',
    name: 'Beta Inc',
    plan: 'Core',
    users: 12,
    status: 'active',
    billing: 'Overdue',
    billingWarn: true,
  },
  {
    id: 'gamma',
    name: 'Gamma Ltd',
    plan: 'Enterprise',
    users: 120,
    status: 'active',
    billing: 'Current',
    billingWarn: false,
  },
  {
    id: 'delta',
    name: 'Delta Co',
    plan: 'Core',
    users: 8,
    status: 'suspended',
    billing: 'Blocked',
    billingWarn: true,
  },
  {
    id: 'epsilon',
    name: 'Epsilon Ltd',
    plan: 'Pro',
    users: 0,
    status: 'provisioning',
    billing: '\u2014',
    billingWarn: false,
  },
  {
    id: 'zeta',
    name: 'Zeta Ltd',
    plan: 'Pro',
    users: 32,
    status: 'active',
    billing: 'Current',
    billingWarn: false,
  },
  {
    id: 'eta',
    name: 'Eta Corp',
    plan: 'Core',
    users: 15,
    status: 'read_only',
    billing: 'Blocked',
    billingWarn: true,
  },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#10b981', bg: '#d1fae5' },
  suspended: { label: 'Suspended', color: '#ef4444', bg: '#fee2e2' },
  provisioning: { label: 'Provisioning', color: '#3b82f6', bg: '#dbeafe' },
  read_only: { label: 'Read-Only', color: '#f59e0b', bg: '#fef3c7' },
};

export default function TenantsListPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');

  const filtered = tenants.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (planFilter !== 'all' && t.plan.toLowerCase() !== planFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold text-[#1e1b4b]">Tenants</h1>
        <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
          <Plus className="h-4 w-4" /> Provision Tenant
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenants..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="read_only">Read-Only</SelectItem>
            <SelectItem value="provisioning">Provisioning</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-36 bg-white">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="core">Core</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-[#f8fafc]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tenant
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Plan
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Users
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Billing
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tenant) => {
              const sc = statusConfig[tenant.status];
              return (
                <tr
                  key={tenant.id}
                  className="border-b border-border/50 transition-colors hover:bg-[#f5f3ff]/50 last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/platform/tenants/${tenant.id}`}
                      className="text-sm font-medium text-[#7c3aed] hover:underline"
                    >
                      {tenant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#1e1b4b]">{tenant.plan}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-[#1e1b4b]">
                    {tenant.users}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: sc.bg, color: sc.color }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: sc.color }}
                      />
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-sm ${tenant.billingWarn ? 'font-semibold text-[#f59e0b]' : 'text-muted-foreground'}`}
                    >
                      {tenant.billing}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
