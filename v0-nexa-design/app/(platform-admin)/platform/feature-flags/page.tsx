'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Flag, FlaskConical, Users, Cpu, Plus, History } from 'lucide-react';

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  rollout: number;
  environment: 'production' | 'staging' | 'development';
  category: 'ai' | 'ui' | 'billing' | 'core';
  tenantsEnabled: number;
  tenantsTotal: number;
  lastModified: string;
}

const flags: FeatureFlag[] = [
  {
    id: 'ff-1',
    name: 'AI Co-Pilot V2',
    key: 'ai_copilot_v2',
    description: 'Next-generation AI assistant with entity mentions and memory',
    enabled: true,
    rollout: 65,
    environment: 'production',
    category: 'ai',
    tenantsEnabled: 42,
    tenantsTotal: 65,
    lastModified: '2 hours ago',
  },
  {
    id: 'ff-2',
    name: 'Smart Invoice Matching',
    key: 'smart_invoice_match',
    description: 'AI-powered automatic invoice-to-PO matching',
    enabled: true,
    rollout: 30,
    environment: 'staging',
    category: 'ai',
    tenantsEnabled: 20,
    tenantsTotal: 65,
    lastModified: '1 day ago',
  },
  {
    id: 'ff-3',
    name: 'Dark Mode',
    key: 'dark_mode_ui',
    description: 'System-wide dark mode theme option for all users',
    enabled: false,
    rollout: 0,
    environment: 'development',
    category: 'ui',
    tenantsEnabled: 0,
    tenantsTotal: 65,
    lastModified: '3 days ago',
  },
  {
    id: 'ff-4',
    name: 'Usage-Based Billing',
    key: 'usage_based_billing',
    description: 'Switch from per-seat to usage-based billing model',
    enabled: true,
    rollout: 10,
    environment: 'staging',
    category: 'billing',
    tenantsEnabled: 7,
    tenantsTotal: 65,
    lastModified: '5 days ago',
  },
  {
    id: 'ff-5',
    name: 'Batch Processing V3',
    key: 'batch_processing_v3',
    description: 'Improved batch processing engine with parallel execution',
    enabled: true,
    rollout: 100,
    environment: 'production',
    category: 'core',
    tenantsEnabled: 65,
    tenantsTotal: 65,
    lastModified: '2 weeks ago',
  },
  {
    id: 'ff-6',
    name: 'Predictive Cash Flow',
    key: 'predictive_cashflow',
    description: 'ML-based cash flow forecasting using historical data',
    enabled: true,
    rollout: 45,
    environment: 'production',
    category: 'ai',
    tenantsEnabled: 29,
    tenantsTotal: 65,
    lastModified: '6 hours ago',
  },
  {
    id: 'ff-7',
    name: 'Multi-Currency V2',
    key: 'multi_currency_v2',
    description: 'Enhanced multi-currency support with real-time FX rates',
    enabled: false,
    rollout: 0,
    environment: 'development',
    category: 'core',
    tenantsEnabled: 0,
    tenantsTotal: 65,
    lastModified: '1 week ago',
  },
  {
    id: 'ff-8',
    name: 'Document AI Extraction',
    key: 'doc_ai_extract',
    description: 'AI-powered document data extraction from uploads',
    enabled: true,
    rollout: 80,
    environment: 'production',
    category: 'ai',
    tenantsEnabled: 52,
    tenantsTotal: 65,
    lastModified: '12 hours ago',
  },
];

const envColors: Record<string, string> = {
  production: 'bg-[#d1fae5] text-[#065f46]',
  staging: 'bg-[#fef3c7] text-[#92400e]',
  development: 'bg-[#dbeafe] text-[#1e40af]',
};

const catColors: Record<string, string> = {
  ai: 'bg-[#f5f3ff] text-[#6d28d9]',
  ui: 'bg-[#fce7f3] text-[#be185d]',
  billing: 'bg-[#fff7ed] text-[#c2410c]',
  core: 'bg-[#f3f4f6] text-[#374151]',
};

export default function FeatureFlagsPage() {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [flagState, setFlagState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(flags.map((f) => [f.id, f.enabled])),
  );

  const filtered = useMemo(() => {
    return flags.filter((f) => {
      const matchSearch =
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.key.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCat === 'all' || f.category === filterCat;
      return matchSearch && matchCat;
    });
  }, [search, filterCat]);

  const totalEnabled = Object.values(flagState).filter(Boolean).length;
  const aiFlags = flags.filter((f) => f.category === 'ai').length;
  const prodFlags = flags.filter((f) => f.environment === 'production').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#1e1b4b]">Feature Flags</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Manage feature rollouts and A/B experiments across tenants
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Total Flags',
            value: flags.length,
            icon: Flag,
            bg: 'bg-[#f5f3ff]',
            color: 'text-[#7c3aed]',
          },
          {
            label: 'Enabled',
            value: totalEnabled,
            icon: FlaskConical,
            bg: 'bg-[#d1fae5]',
            color: 'text-[#059669]',
          },
          {
            label: 'AI Flags',
            value: aiFlags,
            icon: Cpu,
            bg: 'bg-[#ede9fe]',
            color: 'text-[#6d28d9]',
          },
          {
            label: 'In Production',
            value: prodFlags,
            icon: Users,
            bg: 'bg-[#fef3c7]',
            color: 'text-[#d97706]',
          },
        ].map((s) => (
          <Card key={s.label} className="border-[#e5e7eb] bg-white shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg p-2.5 ${s.bg} ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-[#6b7280]">{s.label}</p>
                <p className="text-xl font-bold text-[#1e1b4b]">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <Card className="border-[#e5e7eb] bg-white shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search flags..."
              className="border-[#e5e7eb] bg-white pl-9 text-[#1e1b4b] placeholder:text-[#9ca3af]"
            />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-36 border-[#e5e7eb] bg-white text-[#1e1b4b]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
              <SelectItem value="ui">UI</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="core">Core</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-[#7c3aed] text-white hover:bg-[#6d28d9]">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Flag
          </Button>
        </CardContent>
      </Card>

      {/* Flag List */}
      <div className="space-y-3">
        {filtered.map((flag) => {
          const isEnabled = flagState[flag.id];
          return (
            <Card
              key={flag.id}
              className={`border-[#e5e7eb] bg-white shadow-sm transition-all hover:shadow-md ${
                !isEnabled ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-[#1e1b4b]">{flag.name}</h3>
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-semibold ${envColors[flag.environment]}`}
                      >
                        {flag.environment}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] font-semibold ${catColors[flag.category]}`}
                      >
                        {flag.category}
                      </Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-[#9ca3af]">{flag.key}</p>
                    <p className="mt-1 text-sm text-[#6b7280]">{flag.description}</p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-[#9ca3af]">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {flag.tenantsEnabled}/{flag.tenantsTotal} tenants
                      </span>
                      <span className="flex items-center gap-1">
                        <History className="h-3 w-3" />
                        {flag.lastModified}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(v) => setFlagState((p) => ({ ...p, [flag.id]: v }))}
                    />
                    {flag.rollout > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-[#f3f4f6]">
                          <div
                            className="h-full rounded-full bg-[#7c3aed] transition-all"
                            style={{ width: `${flag.rollout}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-[#6b7280]">
                          {flag.rollout}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
