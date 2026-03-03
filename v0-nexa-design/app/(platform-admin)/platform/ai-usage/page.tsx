'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Download, Cpu, PoundSterling, TrendingUp, Users, AlertTriangle } from 'lucide-react';

const stats = [
  { label: 'Total', value: '12.4M', sub: 'tokens', icon: Cpu, color: '#7c3aed' },
  { label: 'Cost', value: '\u00a32,340', sub: 'estimate', icon: PoundSterling, color: '#10b981' },
  { label: 'Avg/Day', value: '413K', sub: 'tokens', icon: TrendingUp, color: '#3b82f6' },
  { label: 'Tenants', value: '198', sub: 'active', icon: Users, color: '#f59e0b' },
];

const featureUsage = [
  { name: 'Chat', value: 45, color: '#7c3aed' },
  { name: 'Doc AI', value: 30, color: '#3b82f6' },
  { name: 'Briefing', value: 15, color: '#10b981' },
  { name: 'Other', value: 10, color: '#9ca3af' },
];

const dailyTrend = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  tokens: Math.round(300000 + Math.random() * 250000),
}));

const topConsumers = [
  { tenant: 'Acme Corp', tokens: '1.2M', cost: '\u00a3220', quota: 92, alert: true },
  { tenant: 'Gamma Ltd', tokens: '890K', cost: '\u00a3165', quota: 68, alert: false },
  { tenant: 'Beta Inc', tokens: '450K', cost: '\u00a384', quota: 45, alert: false },
  { tenant: 'Zeta Ltd', tokens: '320K', cost: '\u00a360', quota: 32, alert: false },
];

const alerts = [
  'Acme Corp: Soft quota limit reached (92%)',
  'Delta Co: Usage spike detected (3x average)',
];

export default function AIUsagePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold text-[#1e1b4b]">AI Usage</h1>
        <div className="flex items-center gap-3">
          <Select defaultValue="30d">
            <SelectTrigger className="w-40 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="border-border bg-white text-[#1e1b4b] hover:bg-[#f5f3ff]"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
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
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Usage by Feature */}
        <Card className="border-border bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#1e1b4b]">Usage by Feature</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={featureUsage} layout="vertical">
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  width={70}
                />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {featureUsage.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Daily Trend */}
        <Card className="border-border bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#1e1b4b]">Daily Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={dailyTrend}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip formatter={(v: number) => `${(v / 1000).toFixed(0)}K tokens`} />
                <Line
                  type="monotone"
                  dataKey="tokens"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Consumers */}
      <Card className="mb-6 border-border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#1e1b4b]">Top Consumers</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tenant
                </th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tokens
                </th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cost
                </th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quota %
                </th>
                <th className="pb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">
                  Alert
                </th>
              </tr>
            </thead>
            <tbody>
              {topConsumers.map((tc) => (
                <tr key={tc.tenant} className="border-b border-border/50 last:border-b-0">
                  <td className="py-3 text-sm font-medium text-[#7c3aed]">{tc.tenant}</td>
                  <td className="py-3 text-right font-mono text-sm tabular-nums text-[#1e1b4b]">
                    {tc.tokens}
                  </td>
                  <td className="py-3 text-right font-mono text-sm tabular-nums text-[#1e1b4b]">
                    {tc.cost}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${tc.quota}%`,
                            backgroundColor: tc.quota > 80 ? '#ef4444' : '#7c3aed',
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs tabular-nums text-[#1e1b4b]">
                        {tc.quota}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    {tc.alert && <AlertTriangle className="mx-auto h-4 w-4 text-[#f59e0b]" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card className="border-border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#1e1b4b]">Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {alerts.map((a, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-lg border border-[#f59e0b]/30 bg-[#fef3c7]/30 p-3"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#f59e0b]" />
                <p className="text-sm text-[#1e1b4b]">{a}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
