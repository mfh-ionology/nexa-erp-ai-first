'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PoundSterling, Users, AlertTriangle, TrendingDown } from 'lucide-react';

const stats = [
  { label: 'MRR', value: '\u00a342,800', delta: '+8% MoM', icon: PoundSterling, color: '#10b981' },
  { label: 'Active', value: '232', sub: 'tenants', icon: Users, color: '#3b82f6' },
  { label: 'Overdue', value: '8', sub: 'tenants', icon: AlertTriangle, color: '#f59e0b' },
  { label: 'Churn', value: '1.2%', sub: 'monthly', icon: TrendingDown, color: '#ef4444' },
];

const revenueByPlan = [
  { month: 'Apr', Core: 8000, Pro: 14000, Enterprise: 10000 },
  { month: 'May', Core: 8200, Pro: 14500, Enterprise: 10500 },
  { month: 'Jun', Core: 8500, Pro: 15000, Enterprise: 11000 },
  { month: 'Jul', Core: 8800, Pro: 15200, Enterprise: 11200 },
  { month: 'Aug', Core: 9000, Pro: 15800, Enterprise: 11500 },
  { month: 'Sep', Core: 9200, Pro: 16200, Enterprise: 12000 },
  { month: 'Oct', Core: 9400, Pro: 16500, Enterprise: 12200 },
  { month: 'Nov', Core: 9500, Pro: 16800, Enterprise: 12500 },
  { month: 'Dec', Core: 9800, Pro: 17200, Enterprise: 12800 },
  { month: 'Jan', Core: 10000, Pro: 17500, Enterprise: 13000 },
  { month: 'Feb', Core: 10200, Pro: 17800, Enterprise: 13500 },
  { month: 'Mar', Core: 10400, Pro: 18200, Enterprise: 14200 },
];

const enforcement = [
  { label: 'None (Current)', count: 218, color: '#10b981', pct: 94 },
  { label: 'Warning', count: 8, color: '#f59e0b', pct: 3.5 },
  { label: 'Read-Only', count: 4, color: '#f97316', pct: 1.7 },
  { label: 'Suspended', count: 2, color: '#ef4444', pct: 0.8 },
];

const overdue = [
  { tenant: 'Beta Inc', plan: 'Core', dunning: 'Level 2', grace: '5 days', action: 'Enforce' },
  { tenant: 'Zeta Ltd', plan: 'Pro', dunning: 'Level 1', grace: '12 days', action: 'Warn' },
  { tenant: 'Eta Corp', plan: 'Core', dunning: 'Level 3', grace: '0 days', action: 'Enforce' },
];

export default function BillingPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="mb-6 font-serif text-3xl font-bold text-[#1e1b4b]">Billing</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
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
                  <p className="text-2xl font-bold text-[#1e1b4b]">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.delta || s.sub}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue by Plan chart */}
      <Card className="mb-6 border-border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#1e1b4b]">
            Revenue by Plan (12 months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByPlan}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                tickFormatter={(v) => `\u00a3${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v: number) => `\u00a3${v.toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Core" stackId="a" fill="#9ca3af" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Pro" stackId="a" fill="#7c3aed" />
              <Bar dataKey="Enterprise" stackId="a" fill="#1e1b4b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Enforcement Distribution */}
      <Card className="mb-6 border-border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#1e1b4b]">
            Enforcement Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {enforcement.map((e) => (
              <div key={e.label} className="flex items-center gap-3">
                <span className="w-32 text-sm text-[#1e1b4b]">{e.label}</span>
                <div className="flex-1">
                  <div className="h-5 overflow-hidden rounded bg-border">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${e.pct}%`,
                        backgroundColor: e.color,
                        minWidth: e.pct > 0 ? '8px' : '0',
                      }}
                    />
                  </div>
                </div>
                <span className="w-10 text-right font-mono text-sm tabular-nums text-[#1e1b4b]">
                  {e.count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overdue Tenants */}
      <Card className="border-border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#1e1b4b]">Overdue Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tenant
                </th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Plan
                </th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dunning
                </th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Grace
                </th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((o) => (
                <tr key={o.tenant} className="border-b border-border/50 last:border-b-0">
                  <td className="py-3 text-sm font-medium text-[#7c3aed]">{o.tenant}</td>
                  <td className="py-3 text-sm text-[#1e1b4b]">{o.plan}</td>
                  <td className="py-3 text-sm text-[#1e1b4b]">{o.dunning}</td>
                  <td className="py-3 text-sm text-[#1e1b4b]">{o.grace}</td>
                  <td className="py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-border hover:bg-[#f5f3ff]"
                    >
                      {o.action}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
