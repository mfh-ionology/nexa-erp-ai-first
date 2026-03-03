'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, PoundSterling, Cpu, AlertTriangle } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const stats = [
  {
    label: 'Tenants',
    value: '247',
    sub: 'Active',
    delta: '+12 MTD',
    icon: Building2,
    color: '#7c3aed',
  },
  {
    label: 'Revenue',
    value: '\u00a342,800',
    sub: 'MRR',
    delta: '+8% MoM',
    icon: PoundSterling,
    color: '#10b981',
  },
  {
    label: 'AI Usage',
    value: '2.1M tkn',
    sub: 'today',
    delta: '+15%',
    icon: Cpu,
    color: '#3b82f6',
  },
  {
    label: 'Alerts',
    value: '3',
    sub: 'active',
    delta: '2 critical',
    icon: AlertTriangle,
    color: '#f59e0b',
  },
];

const tenantHealth = [
  { name: 'Active', value: 232, color: '#10b981' },
  { name: 'Suspended', value: 8, color: '#ef4444' },
  { name: 'Read-Only', value: 5, color: '#f59e0b' },
  { name: 'Provisioning', value: 2, color: '#3b82f6' },
];

const revenueData = [
  { month: 'Apr', value: 31000 },
  { month: 'May', value: 32500 },
  { month: 'Jun', value: 33000 },
  { month: 'Jul', value: 34200 },
  { month: 'Aug', value: 35100 },
  { month: 'Sep', value: 36800 },
  { month: 'Oct', value: 37500 },
  { month: 'Nov', value: 38200 },
  { month: 'Dec', value: 39500 },
  { month: 'Jan', value: 40800 },
  { month: 'Feb', value: 41500 },
  { month: 'Mar', value: 42800 },
];

const alerts = [
  { level: 'warning', text: 'Acme Corp \u2014 AI quota 92% used (soft limit)' },
  { level: 'warning', text: 'Beta Inc \u2014 Payment overdue (Dunning Level 2)' },
  { level: 'info', text: 'Gamma Ltd \u2014 New tenant provisioned' },
];

export default function PlatformDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="mb-6 font-serif text-3xl font-bold text-[#1e1b4b]">Dashboard</h1>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="border-border bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-[#1e1b4b]">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.sub}</p>
                  </div>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${s.color}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                </div>
                <p className="mt-2 text-xs font-medium" style={{ color: s.color }}>
                  {s.delta}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#1e1b4b]">Tenant Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={tenantHealth}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    strokeWidth={2}
                  >
                    {tenantHealth.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="white" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2">
                {tenantHealth.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {item.name}:{' '}
                      <span className="font-semibold text-[#1e1b4b]">{item.value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#1e1b4b]">
              Revenue Trend (12mo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={revenueData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  tickFormatter={(v) => `\u00a3${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v: number) => `\u00a3${v.toLocaleString()}`} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#7c3aed"
                  fill="#7c3aed"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="border-border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#1e1b4b]">Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 rounded-lg border p-3 ${alert.level === 'warning' ? 'border-[#f59e0b]/30 bg-[#fef3c7]/30' : 'border-border bg-secondary/30'}`}
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0"
                  style={{ color: alert.level === 'warning' ? '#f59e0b' : '#3b82f6' }}
                />
                <p className="text-sm text-[#1e1b4b]">{alert.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
