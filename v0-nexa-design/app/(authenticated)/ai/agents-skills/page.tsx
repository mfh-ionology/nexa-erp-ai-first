'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Bot, Play, ChevronDown, ChevronRight, Edit2, Check } from 'lucide-react';

/* ── Types ── */
interface Agent {
  id: string;
  name: string;
  level: string;
  skills: number;
  status: 'Active' | 'Draft' | 'Disabled';
  description: string;
  assignedSkills: string[];
  routingRules: string;
}

interface SkillPack {
  id: string;
  name: string;
  module: string;
  version: string;
  skillCount: number;
  enabled: boolean;
  skills: string[];
}

interface Skill {
  id: string;
  name: string;
  pack: string;
  trigger: string;
  level: string;
  status: 'Active' | 'Draft';
}

/* ── Data ── */
const agents: Agent[] = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    level: 'L0',
    skills: 3,
    status: 'Active',
    description: 'Routes all user requests to the appropriate L1 agent',
    assignedSkills: ['Intent Classification', 'Agent Routing', 'Fallback Handler'],
    routingRules: 'Classify intent -> route to matching L1 agent -> fallback to general',
  },
  {
    id: 'finance',
    name: 'Finance Agent',
    level: 'L1',
    skills: 8,
    status: 'Active',
    description: 'Handles all finance, AR, AP, and cash flow queries',
    assignedSkills: [
      'Invoice Lookup',
      'Payment Status',
      'Cash Flow Forecast',
      'AR Aging',
      'AP Processing',
      'VAT Calc',
      'Budget Check',
      'Expense Review',
    ],
    routingRules: 'Match finance keywords -> select skill by sub-intent -> execute',
  },
  {
    id: 'sales',
    name: 'Sales Agent',
    level: 'L1',
    skills: 6,
    status: 'Active',
    description: 'Handles sales pipeline, quotes, and customer queries',
    assignedSkills: [
      'Pipeline Query',
      'Quote Generator',
      'Customer Lookup',
      'Win/Loss Analysis',
      'Forecast',
      'Commission Calc',
    ],
    routingRules: 'Match sales keywords -> select skill -> execute with CRM context',
  },
  {
    id: 'hr',
    name: 'HR Agent',
    level: 'L1',
    skills: 4,
    status: 'Draft',
    description: 'Handles HR, payroll, and employee queries',
    assignedSkills: ['Leave Balance', 'Payslip Query', 'Policy Lookup', 'Org Chart'],
    routingRules: 'Match HR keywords -> check permissions -> execute',
  },
];

const skillPacks: SkillPack[] = [
  {
    id: 'finance-core',
    name: 'Finance Core',
    module: 'Finance',
    version: '2.1.0',
    skillCount: 8,
    enabled: true,
    skills: [
      'Invoice Lookup',
      'Payment Status',
      'Cash Flow Forecast',
      'AR Aging',
      'AP Processing',
      'VAT Calc',
      'Budget Check',
      'Expense Review',
    ],
  },
  {
    id: 'sales-core',
    name: 'Sales Core',
    module: 'Sales',
    version: '1.4.0',
    skillCount: 6,
    enabled: true,
    skills: [
      'Pipeline Query',
      'Quote Generator',
      'Customer Lookup',
      'Win/Loss Analysis',
      'Forecast',
      'Commission Calc',
    ],
  },
  {
    id: 'hr-core',
    name: 'HR Core',
    module: 'HR',
    version: '1.0.0',
    skillCount: 4,
    enabled: false,
    skills: ['Leave Balance', 'Payslip Query', 'Policy Lookup', 'Org Chart'],
  },
  {
    id: 'inventory-core',
    name: 'Inventory Core',
    module: 'Inventory',
    version: '1.2.0',
    skillCount: 5,
    enabled: true,
    skills: ['Stock Check', 'Reorder Alert', 'Warehouse Lookup', 'BOM Query', 'Transfer Request'],
  },
];

const skills: Skill[] = [
  {
    id: 's1',
    name: 'Invoice Lookup',
    pack: 'Finance Core',
    trigger: 'invoice, payment, amount',
    level: 'L2',
    status: 'Active',
  },
  {
    id: 's2',
    name: 'Cash Flow Forecast',
    pack: 'Finance Core',
    trigger: 'cash flow, forecast, liquidity',
    level: 'L2',
    status: 'Active',
  },
  {
    id: 's3',
    name: 'AR Aging',
    pack: 'Finance Core',
    trigger: 'overdue, aging, receivables',
    level: 'L2',
    status: 'Active',
  },
  {
    id: 's4',
    name: 'Pipeline Query',
    pack: 'Sales Core',
    trigger: 'pipeline, deals, opportunities',
    level: 'L2',
    status: 'Active',
  },
  {
    id: 's5',
    name: 'Quote Generator',
    pack: 'Sales Core',
    trigger: 'quote, proposal, pricing',
    level: 'L2',
    status: 'Active',
  },
  {
    id: 's6',
    name: 'Leave Balance',
    pack: 'HR Core',
    trigger: 'leave, holiday, PTO',
    level: 'L2',
    status: 'Draft',
  },
  {
    id: 's7',
    name: 'Stock Check',
    pack: 'Inventory Core',
    trigger: 'stock, inventory, quantity',
    level: 'L2',
    status: 'Active',
  },
];

/* ── Test Trigger Panel ── */
function TestTriggerPanel() {
  const [testInput, setTestInput] = useState('');
  const [result, setResult] = useState<{
    steps: { label: string; agent: string; time: string }[];
  } | null>(null);
  const [running, setRunning] = useState(false);

  const runTest = useCallback(() => {
    if (!testInput.trim()) return;
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setResult({
        steps: [
          { label: 'Route decision', agent: 'L0 Orchestrator', time: '12ms' },
          { label: 'Skill match', agent: 'L1 Finance Agent', time: '8ms' },
          { label: 'Execute', agent: 'L2 AR Aging', time: '340ms' },
        ],
      });
      setRunning(false);
    }, 800);
  }, [testInput]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Test Trigger Panel
      </h3>
      <div className="flex gap-2">
        <Input
          placeholder={'Simulate: "Show me overdue invoices"'}
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          className="rounded-lg text-sm"
          onKeyDown={(e) => e.key === 'Enter' && runTest()}
        />
        <Button
          onClick={runTest}
          disabled={running}
          className="shrink-0 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
          size="sm"
        >
          <Play className="mr-1.5 h-3.5 w-3.5" />
          {running ? 'Running...' : 'Run Test'}
        </Button>
      </div>

      {result && (
        <div className="mt-5">
          {/* Horizontal flow */}
          <div className="flex items-center gap-0 overflow-x-auto py-2">
            {result.steps.map((step, i) => (
              <div key={step.label} className="flex items-center">
                {i > 0 && <div className="mx-1 h-0.5 w-8 bg-[#c4b5fd] shrink-0" />}
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-sm">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">
                    {step.agent}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {step.label} ({step.time})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page ── */
export default function AgentsSkillsPage() {
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set(['finance-core']));

  const togglePack = (id: string) => {
    setExpandedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="h-3.5 w-3.5 text-[#7c3aed]" />
          <span>AI &gt; Agents & Skills</span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Agents & Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage AI agents, skill packs, and routing configuration.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="agents">
        <TabsList className="mb-4 rounded-lg border border-border bg-secondary/50 p-1">
          <TabsTrigger
            value="agents"
            className="rounded-md text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Agents
          </TabsTrigger>
          <TabsTrigger
            value="packs"
            className="rounded-md text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Skill Packs
          </TabsTrigger>
          <TabsTrigger
            value="skills"
            className="rounded-md text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            Skills
          </TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Agent Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Level
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                    Skills
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-[#f5f3ff]"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{a.name}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className="rounded-md bg-[#ede9fe] text-[10px] font-bold text-[#5b21b6]"
                      >
                        {a.level}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                      {a.skills}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          a.status === 'Active'
                            ? 'text-[#065f46]'
                            : a.status === 'Draft'
                              ? 'text-muted-foreground'
                              : 'text-[#991b1b]'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            a.status === 'Active'
                              ? 'bg-[#10b981]'
                              : a.status === 'Draft'
                                ? 'bg-[#9ca3af]'
                                : 'bg-[#ef4444]'
                          }`}
                        />
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditAgent(a)}
                        className="h-7 rounded-md text-xs text-[#7c3aed] hover:bg-[#f5f3ff] hover:text-[#5b21b6]"
                      >
                        <Edit2 className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Test Trigger */}
          <TestTriggerPanel />
        </TabsContent>

        {/* Skill Packs Tab */}
        <TabsContent value="packs" className="space-y-3">
          {skillPacks.map((pack) => {
            const expanded = expandedPacks.has(pack.id);
            return (
              <div
                key={pack.id}
                className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden"
              >
                <button
                  onClick={() => togglePack(pack.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#f5f3ff]"
                >
                  <div className="flex items-center gap-3">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{pack.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {pack.module} &middot; v{pack.version} &middot; {pack.skillCount} skills
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={pack.enabled}
                    onCheckedChange={(e) => e}
                    onClick={(e) => e.stopPropagation()}
                    className="data-[state=checked]:bg-[#7c3aed]"
                  />
                </button>
                {expanded && (
                  <div className="border-t border-border px-5 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {pack.skills.map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="rounded-md bg-secondary text-xs"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Skill
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                    Pack
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                    Triggers
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Level
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {skills.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-[#f5f3ff]"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{s.name}</td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                      {s.pack}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {s.trigger.split(', ').map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-[#d1fae5] px-2 py-0.5 text-[10px] font-medium text-[#065f46]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className="rounded-md bg-[#ede9fe] text-[10px] font-bold text-[#5b21b6]"
                      >
                        {s.level}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          s.status === 'Active' ? 'text-[#065f46]' : 'text-muted-foreground'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            s.status === 'Active' ? 'bg-[#10b981]' : 'bg-[#9ca3af]'
                          }`}
                        />
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Agent Edit Sheet */}
      <Sheet open={!!editAgent} onOpenChange={(o) => !o && setEditAgent(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif">{editAgent?.name}</SheetTitle>
          </SheetHeader>
          {editAgent && (
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </p>
                <p className="mt-1 text-sm text-foreground">{editAgent.description}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Level
                </p>
                <Badge className="mt-1 rounded-md bg-[#ede9fe] text-[#5b21b6]">
                  {editAgent.level}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned Skills
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {editAgent.assignedSkills.map((s) => (
                    <Badge key={s} variant="secondary" className="rounded-md bg-secondary text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Routing Rules
                </p>
                <p className="mt-1 rounded-lg bg-secondary/50 p-3 font-mono text-xs text-muted-foreground">
                  {editAgent.routingRules}
                </p>
              </div>
              <Button className="w-full rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
                Save Changes
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
