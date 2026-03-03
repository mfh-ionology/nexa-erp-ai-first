'use client';

import { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Zap, ChevronDown, ChevronRight, Sparkles, X } from 'lucide-react';

/* ── Types ── */
type Pattern = 'CONTEXT_AWARE' | 'ITERATIVE' | 'REQUIRES_APPROVAL' | 'AUTONOMOUS';

interface Skill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  negativeTriggers: string[];
  pattern: Pattern;
  active: boolean;
  module: string;
  usedThisWeek: number;
  instruction?: string;
  createdDate: string;
  modifiedDate: string;
}

const patternStyles: Record<Pattern, { bg: string; text: string }> = {
  CONTEXT_AWARE: { bg: 'bg-[#dbeafe]', text: 'text-[#1e40af]' },
  ITERATIVE: { bg: 'bg-[#e0e7ff]', text: 'text-[#3730a3]' },
  REQUIRES_APPROVAL: { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]' },
  AUTONOMOUS: { bg: 'bg-[#d1fae5]', text: 'text-[#065f46]' },
};

/* ── Mock data ── */
const skillsData: Skill[] = [
  {
    id: 's1',
    name: 'Open Entity List',
    description: 'Navigate to an entity list page and display records',
    triggers: ['show', 'open', 'view', 'list', 'display'],
    negativeTriggers: ['create', 'new', 'edit', 'delete'],
    pattern: 'CONTEXT_AWARE',
    active: true,
    module: 'Views & Navigation',
    usedThisWeek: 34,
    instruction:
      'Navigate user to the appropriate entity list view. Infer the entity type from context. Apply any mentioned filters automatically.',
    createdDate: '15 Jan 2026',
    modifiedDate: '20 Feb 2026',
  },
  {
    id: 's2',
    name: 'Apply Data Filter',
    description: 'Apply an ad-hoc filter or saved view to a list page',
    triggers: ['filter', 'show only', 'where', 'with'],
    negativeTriggers: ['create filter', 'save filter'],
    pattern: 'ITERATIVE',
    active: true,
    module: 'Views & Navigation',
    usedThisWeek: 22,
    instruction:
      'Parse the natural language filter criteria and translate to structured filter conditions. Apply iteratively if multiple conditions are specified.',
    createdDate: '15 Jan 2026',
    modifiedDate: '18 Feb 2026',
  },
  {
    id: 's3',
    name: 'Sort Data',
    description: 'Sort current list view by a specified column and direction',
    triggers: ['sort', 'order by', 'arrange', 'rank'],
    negativeTriggers: ['filter', 'group'],
    pattern: 'CONTEXT_AWARE',
    active: true,
    module: 'Views & Navigation',
    usedThisWeek: 15,
    instruction:
      'Identify the sort column from context. Default to descending for amounts and dates, ascending for names.',
    createdDate: '15 Jan 2026',
    modifiedDate: '15 Feb 2026',
  },
  {
    id: 's4',
    name: 'Export Data',
    description: 'Export the current view or filtered data to CSV or PDF',
    triggers: ['export', 'download', 'csv', 'pdf', 'spreadsheet'],
    negativeTriggers: ['import', 'upload'],
    pattern: 'CONTEXT_AWARE',
    active: true,
    module: 'Views & Navigation',
    usedThisWeek: 8,
    instruction: 'Export the currently visible data respecting active filters and sort order.',
    createdDate: '20 Jan 2026',
    modifiedDate: '20 Feb 2026',
  },
  {
    id: 's5',
    name: 'Search Records',
    description: 'Perform a global or scoped search across entity records',
    triggers: ['search', 'find', 'look up', 'locate'],
    negativeTriggers: ['replace', 'update'],
    pattern: 'CONTEXT_AWARE',
    active: true,
    module: 'Views & Navigation',
    usedThisWeek: 41,
    instruction:
      'Search across the inferred entity type. If no type is specified, perform a global search.',
    createdDate: '15 Jan 2026',
    modifiedDate: '22 Feb 2026',
  },
  {
    id: 's6',
    name: 'Post Journal Entry',
    description: 'Create and post a manual journal entry',
    triggers: ['post journal', 'create journal', 'manual entry', 'journal entry'],
    negativeTriggers: ['reverse', 'void', 'delete journal'],
    pattern: 'REQUIRES_APPROVAL',
    active: true,
    module: 'Finance',
    usedThisWeek: 5,
    instruction:
      'Collect debit/credit lines, validate balance, and present for approval before posting.',
    createdDate: '18 Jan 2026',
    modifiedDate: '25 Feb 2026',
  },
  {
    id: 's7',
    name: 'Generate Financial Report',
    description: 'Run P&L, Balance Sheet, or Trial Balance',
    triggers: ['P&L', 'profit and loss', 'balance sheet', 'trial balance', 'financial report'],
    negativeTriggers: ['budget', 'forecast'],
    pattern: 'CONTEXT_AWARE',
    active: true,
    module: 'Finance',
    usedThisWeek: 12,
    instruction:
      'Determine report type from context. Default period is current month. Allow date range specification.',
    createdDate: '18 Jan 2026',
    modifiedDate: '24 Feb 2026',
  },
  {
    id: 's8',
    name: 'Reconcile Bank Statement',
    description: 'Match bank transactions against ledger entries',
    triggers: ['reconcile', 'bank rec', 'match transactions', 'bank statement'],
    negativeTriggers: ['post', 'journal'],
    pattern: 'ITERATIVE',
    active: true,
    module: 'Finance',
    usedThisWeek: 3,
    instruction:
      'Load unreconciled transactions and suggest matches based on amount, date proximity, and reference.',
    createdDate: '20 Jan 2026',
    modifiedDate: '20 Feb 2026',
  },
  {
    id: 's9',
    name: 'VAT Return Preparation',
    description: 'Calculate and prepare VAT return for HMRC submission',
    triggers: ['VAT return', 'VAT calculation', 'HMRC', 'tax return'],
    negativeTriggers: ['VAT rate', 'VAT exempt'],
    pattern: 'REQUIRES_APPROVAL',
    active: false,
    module: 'Finance',
    usedThisWeek: 0,
    instruction:
      'Calculate VAT boxes 1-9 for the specified period. Present summary for review before generating MTD submission.',
    createdDate: '25 Jan 2026',
    modifiedDate: '15 Feb 2026',
  },
  {
    id: 's10',
    name: 'Chase Overdue Invoice',
    description: 'Send payment reminder for overdue customer invoices',
    triggers: ['chase', 'remind', 'payment reminder', 'overdue', 'follow up'],
    negativeTriggers: ['credit note', 'write off'],
    pattern: 'REQUIRES_APPROVAL',
    active: true,
    module: 'Accounts Receivable',
    usedThisWeek: 9,
    instruction:
      'Select appropriate reminder template based on days overdue. Preview email before sending.',
    createdDate: '15 Jan 2026',
    modifiedDate: '26 Feb 2026',
  },
  {
    id: 's11',
    name: 'Apply Customer Payment',
    description: 'Record and allocate incoming customer payment to invoices',
    triggers: ['payment received', 'apply payment', 'allocate payment', 'customer paid'],
    negativeTriggers: ['refund', 'credit'],
    pattern: 'CONTEXT_AWARE',
    active: true,
    module: 'Accounts Receivable',
    usedThisWeek: 7,
    instruction:
      'Match payment to oldest outstanding invoices by default. Allow manual allocation override.',
    createdDate: '18 Jan 2026',
    modifiedDate: '22 Feb 2026',
  },
  {
    id: 's12',
    name: 'Create Purchase Order',
    description: 'Generate a new purchase order from requisition or manual input',
    triggers: ['create PO', 'purchase order', 'order from', 'buy'],
    negativeTriggers: ['receive', 'goods in', 'invoice'],
    pattern: 'REQUIRES_APPROVAL',
    active: true,
    module: 'Purchasing',
    usedThisWeek: 6,
    instruction:
      'Validate against budget and approval limits. Auto-populate supplier details from master data.',
    createdDate: '20 Jan 2026',
    modifiedDate: '25 Feb 2026',
  },
  {
    id: 's13',
    name: 'Create Sales Quote',
    description: 'Generate a quotation for a customer',
    triggers: ['quote', 'quotation', 'price for', 'estimate'],
    negativeTriggers: ['invoice', 'order', 'credit'],
    pattern: 'CONTEXT_AWARE',
    active: true,
    module: 'Sales',
    usedThisWeek: 11,
    instruction:
      'Pull customer and product details. Apply standard pricing with any agreed discounts.',
    createdDate: '18 Jan 2026',
    modifiedDate: '24 Feb 2026',
  },
  {
    id: 's14',
    name: 'Check Stock Level',
    description: 'Query current stock availability for a product or SKU',
    triggers: ['stock', 'inventory', 'available', 'how many', 'quantity'],
    negativeTriggers: ['order', 'purchase', 'adjust'],
    pattern: 'AUTONOMOUS',
    active: true,
    module: 'Inventory',
    usedThisWeek: 18,
    instruction:
      'Return current stock level, allocated quantity, and available-to-promise across all warehouses.',
    createdDate: '15 Jan 2026',
    modifiedDate: '20 Feb 2026',
  },
  {
    id: 's15',
    name: 'Log Customer Interaction',
    description: 'Record a phone call, email, or meeting note against a contact',
    triggers: ['log call', 'note', 'meeting', 'interaction', 'spoke to'],
    negativeTriggers: ['delete', 'remove'],
    pattern: 'AUTONOMOUS',
    active: true,
    module: 'CRM',
    usedThisWeek: 14,
    instruction: 'Create activity record linked to the contact and any related opportunities.',
    createdDate: '20 Jan 2026',
    modifiedDate: '26 Feb 2026',
  },
];

/* ── Group skills by module ── */
function groupByModule(skills: Skill[]): Map<string, Skill[]> {
  const map = new Map<string, Skill[]>();
  for (const s of skills) {
    const list = map.get(s.module) || [];
    list.push(s);
    map.set(s.module, list);
  }
  return map;
}

/* ── Module order ── */
const moduleOrder = [
  'Views & Navigation',
  'Finance',
  'Accounts Receivable',
  'Purchasing',
  'Sales',
  'Inventory',
  'CRM',
];

/* ── Page Component ── */
export default function AISkillsPage() {
  const [skills, setSkills] = useState(skillsData);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(['Views & Navigation', 'Finance']),
  );
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [testPhrase, setTestPhrase] = useState('');
  const [testResult, setTestResult] = useState<{
    skill: Skill;
    confidence: number;
  } | null>(null);

  const modules = useMemo(() => {
    const mods = new Set<string>();
    for (const s of skills) mods.add(s.module);
    return Array.from(mods).sort((a, b) => moduleOrder.indexOf(a) - moduleOrder.indexOf(b));
  }, [skills]);

  const filtered = useMemo(() => {
    let result = skills;
    if (moduleFilter !== 'all') {
      result = result.filter((s) => s.module === moduleFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (sk) =>
          sk.name.toLowerCase().includes(s) ||
          sk.triggers.some((t) => t.toLowerCase().includes(s)) ||
          sk.description.toLowerCase().includes(s),
      );
    }
    return result;
  }, [skills, search, moduleFilter]);

  const grouped = useMemo(() => groupByModule(filtered), [filtered]);

  const toggleModule = useCallback((mod: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  }, []);

  const toggleSkillActive = useCallback((id: string) => {
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  }, []);

  const handleTestPhrase = useCallback(() => {
    if (!testPhrase.trim()) {
      setTestResult(null);
      return;
    }
    const lower = testPhrase.toLowerCase();
    let bestMatch: Skill | null = null;
    let bestScore = 0;
    for (const sk of skills) {
      if (!sk.active) continue;
      // Check negative triggers first
      const negMatch = sk.negativeTriggers.some((t) => lower.includes(t.toLowerCase()));
      if (negMatch) continue;
      const matchCount = sk.triggers.filter((t) => lower.includes(t.toLowerCase())).length;
      const score = matchCount / sk.triggers.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = sk;
      }
    }
    if (bestMatch && bestScore > 0) {
      setTestResult({
        skill: bestMatch,
        confidence: Math.min(Math.round(bestScore * 100 + 20), 98),
      });
    } else {
      setTestResult(null);
    }
  }, [testPhrase, skills]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="h-3.5 w-3.5 text-[#7c3aed]" />
        <span>AI &gt; Skills</span>
      </div>

      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="font-serif text-2xl font-bold text-foreground">AI Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your AI co-pilot has these skills. Skills are grouped by module and can be activated or
          deactivated.
        </p>
      </div>

      {/* Test a phrase */}
      <div
        className="animate-fade-in-up rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        style={{ animationDelay: '60ms' }}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-[#7c3aed]" />
          Test a phrase
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            placeholder={'Try "show overdue invoices" or "create a PO"...'}
            value={testPhrase}
            onChange={(e) => {
              setTestPhrase(e.target.value);
              if (!e.target.value) setTestResult(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleTestPhrase()}
            className="flex-1 rounded-lg border-border focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30"
          />
          <Button
            onClick={handleTestPhrase}
            size="sm"
            className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
          >
            Test
          </Button>
        </div>
        {testResult && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-[#f5f3ff] px-3 py-2">
            <Sparkles className="h-4 w-4 shrink-0 text-[#7c3aed]" />
            <div className="flex-1 text-sm">
              <span className="font-medium text-foreground">{testResult.skill.name}</span>
              <span className="ml-2 text-muted-foreground">would match with</span>
              <span
                className={`ml-1 font-mono font-semibold ${
                  testResult.confidence > 80
                    ? 'text-[#10b981]'
                    : testResult.confidence > 50
                      ? 'text-[#f59e0b]'
                      : 'text-[#ef4444]'
                }`}
              >
                {testResult.confidence}% confidence
              </span>
            </div>
          </div>
        )}
        {testPhrase && !testResult && (
          <p className="mt-2 text-xs text-muted-foreground">
            No skill matched this phrase. Try different wording.
          </p>
        )}
      </div>

      {/* Search + Module filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills or trigger phrases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border-border pl-9 focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30"
          />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-52 rounded-lg">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-8 py-12 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No skills found</p>
          <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filter.</p>
        </div>
      )}

      {/* Skill groups (accordions) */}
      {moduleOrder
        .filter((mod) => grouped.has(mod))
        .map((mod) => {
          const items = grouped.get(mod)!;
          const expanded = expandedModules.has(mod);
          return (
            <section key={mod} className="animate-fade-in-up">
              {/* Module header */}
              <button
                onClick={() => toggleModule(mod)}
                className="mb-3 flex w-full items-center gap-2 text-left"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-semibold text-foreground">{mod}</span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-muted-foreground">
                  {items.length} skill{items.length !== 1 ? 's' : ''}
                </span>
              </button>

              {/* Skill cards */}
              {expanded && (
                <div className="space-y-3">
                  {items.map((skill, i) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      search={search}
                      onToggle={() => toggleSkillActive(skill.id)}
                      onClick={() => setSelectedSkill(skill)}
                      delay={i * 50}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

      {/* ── Skill Detail Sheet ── */}
      <Sheet open={!!selectedSkill} onOpenChange={(open) => !open && setSelectedSkill(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[400px]">
          {selectedSkill && (
            <>
              <SheetHeader>
                <SheetTitle className="font-serif text-lg">{selectedSkill.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selectedSkill.description}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Trigger Phrases
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedSkill.triggers.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full bg-[#d1fae5] px-2.5 py-1 text-xs font-medium text-[#065f46]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {selectedSkill.negativeTriggers.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {"Won't match"}
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedSkill.negativeTriggers.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center rounded-full bg-[#fee2e2] px-2.5 py-1 text-xs font-medium text-[#991b1b]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Instruction
                  </span>
                  <div className="mt-2 rounded-lg bg-secondary p-3">
                    <p className="font-mono text-xs leading-relaxed text-foreground">
                      {selectedSkill.instruction || 'No instruction defined.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pattern
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      patternStyles[selectedSkill.pattern].bg
                    } ${patternStyles[selectedSkill.pattern].text}`}
                  >
                    {selectedSkill.pattern.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Active
                  </span>
                  <Switch
                    checked={selectedSkill.active}
                    onCheckedChange={() => {
                      toggleSkillActive(selectedSkill.id);
                      setSelectedSkill({
                        ...selectedSkill,
                        active: !selectedSkill.active,
                      });
                    }}
                    className="data-[state=checked]:bg-[#7c3aed]"
                  />
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Used this week</span>
                    <span className="font-medium text-foreground">
                      {selectedSkill.usedThisWeek} times
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-foreground">{selectedSkill.createdDate}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Last modified</span>
                    <span className="text-foreground">{selectedSkill.modifiedDate}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── SkillCard sub-component ── */
function SkillCard({
  skill,
  search,
  onToggle,
  onClick,
  delay = 0,
}: {
  skill: Skill;
  search: string;
  onToggle: () => void;
  onClick: () => void;
  delay?: number;
}) {
  const searchLower = search.toLowerCase();
  const ps = patternStyles[skill.pattern];

  return (
    <div
      className="animate-fade-in-up cursor-pointer rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-base font-semibold text-foreground">{skill.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{skill.description}</p>
        </div>
        <div
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Switch
            checked={skill.active}
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-[#7c3aed]"
          />
        </div>
      </div>

      {/* Trigger phrases */}
      <div className="mt-3">
        <span className="text-[11px] font-medium text-muted-foreground">Triggers:</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {skill.triggers.map((t) => {
            const highlighted = searchLower && t.toLowerCase().includes(searchLower);
            return (
              <span
                key={t}
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  highlighted
                    ? 'border-2 border-[#10b981] bg-[#d1fae5] text-[#065f46]'
                    : 'bg-[#d1fae5] text-[#065f46]'
                }`}
              >
                {t}
              </span>
            );
          })}
        </div>
      </div>

      {/* Negative triggers */}
      {skill.negativeTriggers.length > 0 && (
        <div className="mt-2">
          <span className="text-[11px] font-medium text-muted-foreground">{"Won't match:"}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {skill.negativeTriggers.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full bg-[#fee2e2] px-2.5 py-0.5 text-xs font-medium text-[#991b1b]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer: pattern badge + usage */}
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ps.bg} ${ps.text}`}
        >
          {skill.pattern.replace(/_/g, ' ')}
        </span>
        <span className="text-xs text-muted-foreground">
          Used {skill.usedThisWeek} times this week
        </span>
      </div>
    </div>
  );
}
