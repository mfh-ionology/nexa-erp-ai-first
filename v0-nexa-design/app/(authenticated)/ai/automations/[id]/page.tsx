'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ArrowLeft,
  Play,
  Save,
  GripVertical,
  Database,
  Sparkles,
  Bell,
  Plus,
  Pencil,
  X,
  ArrowDown,
} from 'lucide-react';

/* ── Types ── */
interface Step {
  id: string;
  type: 'query' | 'ai-generate' | 'notification' | 'http' | 'transform' | 'condition';
  title: string;
  config: Record<string, string>;
  outputVar: string;
}

interface Variable {
  name: string;
  source: 'SYSTEM' | 'PREVIOUS' | 'INPUT';
  description: string;
}

/* ── Data ── */
const initialSteps: Step[] = [
  {
    id: 'step-1',
    type: 'query',
    title: 'Query Database',
    config: {
      query: "SELECT invoices WHERE dueDate < NOW() AND status = 'POSTED'",
    },
    outputVar: 'step1.results',
  },
  {
    id: 'step-2',
    type: 'ai-generate',
    title: 'AI Generate',
    config: {
      prompt: 'Summarize overdue invoices for the daily reminder email...',
      model: 'Claude Opus',
      variables: '{{step1.results}}, {{company_name}}',
    },
    outputVar: 'step2.summary',
  },
  {
    id: 'step-3',
    type: 'notification',
    title: 'Send Notification',
    config: {
      channel: 'Email + In-App',
      to: '{{role:ADMIN}}',
      body: '{{step2.summary}}',
    },
    outputVar: 'step3.result',
  },
];

const variableBindings: Variable[] = [
  { name: 'company_name', source: 'SYSTEM', description: 'Company Profile -> name' },
  { name: 'today', source: 'SYSTEM', description: 'Current Date' },
  { name: 'step1.results', source: 'PREVIOUS', description: 'Step 1 output' },
  { name: 'step2.summary', source: 'PREVIOUS', description: 'Step 2 output' },
];

const stepIcons: Record<string, React.ReactNode> = {
  query: <Database className="h-4 w-4" />,
  'ai-generate': <Sparkles className="h-4 w-4" />,
  notification: <Bell className="h-4 w-4" />,
};

const sourceColors: Record<string, string> = {
  SYSTEM: 'bg-[#dbeafe] text-[#1e40af]',
  PREVIOUS: 'bg-[#ede9fe] text-[#5b21b6]',
  INPUT: 'bg-[#fef3c7] text-[#92400e]',
};

/* ── Step Card ── */
function StepCard({
  step,
  index,
  onEdit,
  onRemove,
}: {
  step: Step;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-secondary/30 rounded-t-xl">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
          <span className="text-[#7c3aed]">{stepIcons[step.type]}</span>
          <span className="text-xs font-semibold text-foreground">
            Step {index + 1}: {step.title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={onRemove}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-[#fee2e2] hover:text-[#991b1b]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="space-y-1.5 px-4 py-3">
        {Object.entries(step.config).map(([key, val]) => (
          <div key={key} className="flex gap-2 text-xs">
            <span className="shrink-0 font-medium text-muted-foreground capitalize">{key}:</span>
            <code className="font-mono text-foreground break-all">{val}</code>
          </div>
        ))}
        <div className="flex gap-2 text-xs pt-1 border-t border-border mt-2">
          <span className="shrink-0 font-medium text-muted-foreground">Output:</span>
          <code className="font-mono text-[#7c3aed]">{`{{${step.outputVar}}}`}</code>
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function AutomationBuilderPage() {
  const [name] = useState('Daily Invoice Reminder');
  const [trigger] = useState('schedule');
  const [cron] = useState('0 8 * * 1-5');
  const [status] = useState('active');
  const [steps, setSteps] = useState(initialSteps);
  const [editStep, setEditStep] = useState<Step | null>(null);
  const [running, setRunning] = useState(false);

  const handleRunNow = useCallback(() => {
    setRunning(true);
    setTimeout(() => setRunning(false), 2000);
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addStep = useCallback(() => {
    const newStep: Step = {
      id: `step-${Date.now()}`,
      type: 'query',
      title: 'New Step',
      config: { query: 'SELECT * FROM ...' },
      outputVar: `step${steps.length + 1}.results`,
    };
    setSteps((prev) => [...prev, newStep]);
  }, [steps.length]);

  return (
    <div className="flex h-full flex-col -m-6">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/ai/automations"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs text-muted-foreground">Automation</p>
            <h1 className="font-serif text-base font-semibold text-foreground">{name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunNow}
            disabled={running}
            className="rounded-lg"
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {running ? 'Running...' : 'Run Now'}
          </Button>
          <Button size="sm" className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Config strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </Label>
              <Input defaultValue={name} className="mt-1 rounded-md text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Trigger
              </Label>
              <Select defaultValue={trigger}>
                <SelectTrigger className="mt-1 rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cron
              </Label>
              <Input defaultValue={cron} className="mt-1 rounded-md font-mono text-sm" />
              <p className="mt-1 text-[10px] text-muted-foreground">Every weekday at 8:00 AM</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </Label>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#065f46]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              Active
            </span>
          </div>

          {/* Steps */}
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Steps
            </h2>
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div key={step.id}>
                  <StepCard
                    step={step}
                    index={i}
                    onEdit={() => setEditStep(step)}
                    onRemove={() => removeStep(step.id)}
                  />
                  {i < steps.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="h-4 w-4 text-[#c4b5fd]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addStep}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/50 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-[#c4b5fd] hover:bg-[#f5f3ff] hover:text-[#7c3aed]"
            >
              <Plus className="h-4 w-4" />
              Add Step
            </button>
          </section>

          {/* Variable Bindings */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Variable Bindings
            </h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Variable
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Source
                    </th>
                    <th className="hidden px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {variableBindings.map((v) => (
                    <tr key={v.name} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs text-foreground">{v.name}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${sourceColors[v.source]}`}
                        >
                          {v.source}
                        </span>
                      </td>
                      <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">
                        {v.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* Step Editor Sheet */}
      <Sheet open={!!editStep} onOpenChange={(o) => !o && setEditStep(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif">Edit Step: {editStep?.title}</SheetTitle>
          </SheetHeader>
          {editStep && (
            <div className="mt-6 space-y-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Step Type
                </Label>
                <Select defaultValue={editStep.type}>
                  <SelectTrigger className="mt-1 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="query">Query Database</SelectItem>
                    <SelectItem value="ai-generate">AI Generate</SelectItem>
                    <SelectItem value="notification">Send Notification</SelectItem>
                    <SelectItem value="http">HTTP Request</SelectItem>
                    <SelectItem value="transform">Transform Data</SelectItem>
                    <SelectItem value="condition">Condition Branch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {Object.entries(editStep.config).map(([key, val]) => (
                <div key={key}>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                    {key}
                  </Label>
                  <textarea
                    defaultValue={val}
                    className="mt-1 min-h-[80px] w-full rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-[#7c3aed]/30"
                  />
                </div>
              ))}
              <Button className="w-full rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
                Apply
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
