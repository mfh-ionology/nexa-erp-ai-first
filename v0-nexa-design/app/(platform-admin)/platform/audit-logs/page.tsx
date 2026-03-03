'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Download, Filter, Shield, AlertTriangle, Clock, Eye } from 'lucide-react';

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  tenantName: string;
  action: string;
  resource: string;
  severity: 'info' | 'warning' | 'critical';
  ip: string;
  details: string;
}

const entries: AuditEntry[] = [
  {
    id: 'al-1',
    timestamp: '2026-02-17 09:45:12',
    actor: 'sarah.chen@acme.co.uk',
    tenantName: 'Acme Ltd',
    action: 'user.login',
    resource: 'Auth',
    severity: 'info',
    ip: '82.132.45.12',
    details: 'Successful login via SSO',
  },
  {
    id: 'al-2',
    timestamp: '2026-02-17 09:32:05',
    actor: 'platform-admin',
    tenantName: 'Platform',
    action: 'tenant.suspend',
    resource: 'Tenant:Nexus Digital',
    severity: 'critical',
    ip: '10.0.0.1',
    details: 'Tenant suspended for non-payment',
  },
  {
    id: 'al-3',
    timestamp: '2026-02-17 09:15:22',
    actor: 'j.smith@globex.co.uk',
    tenantName: 'Globex Corp',
    action: 'invoice.delete',
    resource: 'Invoice:INV-2026-0089',
    severity: 'warning',
    ip: '51.140.12.88',
    details: 'Deleted draft invoice',
  },
  {
    id: 'al-4',
    timestamp: '2026-02-17 08:55:47',
    actor: 'system',
    tenantName: 'Platform',
    action: 'backup.complete',
    resource: 'Database',
    severity: 'info',
    ip: 'internal',
    details: 'Daily backup completed successfully',
  },
  {
    id: 'al-5',
    timestamp: '2026-02-17 08:41:33',
    actor: 'm.jones@sterling.co.uk',
    tenantName: 'Sterling & Co',
    action: 'permission.escalate',
    resource: 'User:m.jones',
    severity: 'critical',
    ip: '86.17.22.105',
    details: 'Self-assigned admin role (flagged)',
  },
  {
    id: 'al-6',
    timestamp: '2026-02-17 08:30:11',
    actor: 'a.patel@brightside.io',
    tenantName: 'Brightside',
    action: 'export.data',
    resource: 'Contacts',
    severity: 'warning',
    ip: '92.25.14.77',
    details: 'Exported 2,400 contact records',
  },
  {
    id: 'al-7',
    timestamp: '2026-02-17 08:12:09',
    actor: 'system',
    tenantName: 'Platform',
    action: 'ai.model_update',
    resource: 'GPT-4o',
    severity: 'info',
    ip: 'internal',
    details: 'Model updated to latest version',
  },
  {
    id: 'al-8',
    timestamp: '2026-02-17 07:55:44',
    actor: 'r.wilson@apex.co.uk',
    tenantName: 'Apex Industries',
    action: 'user.create',
    resource: 'User:new-hire@apex.co.uk',
    severity: 'info',
    ip: '78.86.91.23',
    details: 'New user provisioned',
  },
  {
    id: 'al-9',
    timestamp: '2026-02-17 07:30:18',
    actor: 'platform-admin',
    tenantName: 'Platform',
    action: 'feature_flag.toggle',
    resource: 'Flag:ai_copilot_v2',
    severity: 'warning',
    ip: '10.0.0.1',
    details: 'Enabled AI Co-Pilot V2 for 65% rollout',
  },
  {
    id: 'al-10',
    timestamp: '2026-02-17 07:15:02',
    actor: 'c.davis@primo.co.uk',
    tenantName: 'Primo Group',
    action: 'api_key.rotate',
    resource: 'API Keys',
    severity: 'warning',
    ip: '94.11.45.62',
    details: 'Production API key rotated',
  },
];

const sevColors: Record<string, string> = {
  info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};
const sevIcons: Record<string, typeof Shield> = {
  info: Eye,
  warning: AlertTriangle,
  critical: Shield,
};

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [filterSev, setFilterSev] = useState<string>('all');

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const matchSearch =
        e.actor.toLowerCase().includes(search.toLowerCase()) ||
        e.action.toLowerCase().includes(search.toLowerCase()) ||
        e.details.toLowerCase().includes(search.toLowerCase());
      const matchSev = filterSev === 'all' || e.severity === filterSev;
      return matchSearch && matchSev;
    });
  }, [search, filterSev]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1e1b4b]">Audit Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable activity trail across all tenants and platform operations
          </p>
        </div>
        <Button
          variant="outline"
          className="border-border bg-white text-[#1e1b4b] hover:bg-[#f5f3ff]"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Total Events (24h)', value: '1,247', color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Warnings', value: '23', color: '#f59e0b', bg: '#fef3c7' },
          { label: 'Critical', value: '4', color: '#ef4444', bg: '#fee2e2' },
        ].map((s) => (
          <Card key={s.label} className="border-border bg-white shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <Card className="mb-6 border-border bg-white shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actors, actions, details..."
              className="pl-9"
            />
          </div>
          <Select value={filterSev} onValueChange={setFilterSev}>
            <SelectTrigger className="w-36 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-border text-[#1e1b4b] hover:bg-[#f5f3ff]">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Advanced
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Timestamp
                    </div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actor
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tenant
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Action
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Severity
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => {
                  const SevIcon = sevIcons[entry.severity];
                  return (
                    <TableRow key={entry.id} className="border-border/50 hover:bg-[#f5f3ff]/50">
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {entry.timestamp}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm text-[#1e1b4b]">{entry.actor}</span>
                          <span className="ml-1.5 text-xs text-muted-foreground">{entry.ip}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[#1e1b4b]">{entry.tenantName}</TableCell>
                      <TableCell>
                        <code className="rounded bg-[#f5f3ff] px-1.5 py-0.5 text-xs text-[#7c3aed]">
                          {entry.action}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge className={`gap-1 ${sevColors[entry.severity]}`}>
                          <SevIcon className="h-3 w-3" />
                          {entry.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                        {entry.details}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
