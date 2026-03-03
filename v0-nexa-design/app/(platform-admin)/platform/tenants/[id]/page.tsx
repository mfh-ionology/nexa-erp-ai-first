'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Building2, Users, Cpu } from 'lucide-react';

const tabs = ['Overview', 'Modules', 'Users', 'AI Usage', 'Billing', 'Audit'];

const modules = [
  { name: 'Finance', planDefault: true, override: null as string | null },
  { name: 'Manufacturing', planDefault: false, override: null },
  { name: 'HR/Payroll', planDefault: true, override: null },
  { name: 'CRM', planDefault: true, override: null },
  { name: 'Inventory', planDefault: true, override: null },
];

const featureFlags = [
  { name: 'AI Co-Pilot', enabled: true },
  { name: 'Document AI', enabled: true },
  { name: 'Beta: Voice Input', enabled: false },
];

export default function TenantDetailPage() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [flags, setFlags] = useState(featureFlags);

  const toggleFlag = (idx: number) => {
    setFlags((prev) => prev.map((f, i) => (i === idx ? { ...f, enabled: !f.enabled } : f)));
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/platform/tenants"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white hover:text-[#1e1b4b]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1e1b4b]">Acme Corp</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#10b981]" /> Active
            </span>
            <span>Plan: Pro</span>
            <span>Since: Jan 2025</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-[#7c3aed] text-[#7c3aed]'
                : 'text-muted-foreground hover:text-[#1e1b4b]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Companies', value: '3', icon: Building2, color: '#7c3aed' },
              { label: 'Users', value: '45/50', icon: Users, color: '#3b82f6' },
              { label: 'AI Tokens', value: '180K/250K', icon: Cpu, color: '#f59e0b' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="border-border bg-white shadow-sm">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${s.color}15` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: s.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {s.label}
                      </p>
                      <p className="text-xl font-bold text-[#1e1b4b]">{s.value}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="mb-6 border-border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Connection
                  </p>
                  <p className="mt-1 font-mono text-[#1e1b4b]">db-prod-01:5432/acme_corp</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Created
                  </p>
                  <p className="mt-1 text-[#1e1b4b]">15 Jan 2025</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Last Login
                  </p>
                  <p className="mt-1 text-[#1e1b4b]">2h ago</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-[#ef4444] text-[#ef4444] hover:bg-[#fee2e2]"
            >
              Suspend Tenant
            </Button>
            <Button variant="outline" className="border-border text-[#1e1b4b] hover:bg-[#f5f3ff]">
              Change Plan
            </Button>
            <Button className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">Impersonate</Button>
          </div>
        </div>
      )}

      {activeTab === 'Modules' && (
        <div className="space-y-6">
          <Card className="border-border bg-white shadow-sm">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-[#1e1b4b]">Modules</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Module
                    </th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Plan Default
                    </th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Override
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m.name} className="border-b border-border/50 last:border-b-0">
                      <td className="py-3 text-sm text-[#1e1b4b]">{m.name}</td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {m.planDefault ? 'Included' : 'Not in plan'}
                      </td>
                      <td className="py-3">
                        {!m.planDefault ? (
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            Enable
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{'\u2014'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="border-border bg-white shadow-sm">
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-[#1e1b4b]">Feature Flags</h3>
              <div className="flex flex-col gap-3">
                {flags.map((f, idx) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <span className="text-sm text-[#1e1b4b]">{f.name}</span>
                    <Switch checked={f.enabled} onCheckedChange={() => toggleFlag(idx)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab !== 'Overview' && activeTab !== 'Modules' && (
        <Card className="border-border bg-white shadow-sm">
          <CardContent className="flex items-center justify-center p-12">
            <p className="text-sm text-muted-foreground">{activeTab} tab content coming soon.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
