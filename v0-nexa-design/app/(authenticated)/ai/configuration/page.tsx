'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Cpu, Search, Plus, Check, Circle, Eye, EyeOff, X } from 'lucide-react';

/* ── Types ── */
interface AIModel {
  id: string;
  name: string;
  provider: string;
  status: 'Active' | 'Standby' | 'Disabled';
  isDefault: boolean;
  isFallback: boolean;
  temperature: number;
  maxTokens: number;
  rateLimit: string;
  apiKeyMasked: string;
  fallbackChain: string[];
}

interface PromptTemplate {
  id: string;
  name: string;
  type: 'SYSTEM' | 'EXTRACT' | 'GENERATE' | 'CLASSIFY';
  model: string;
  updated: string;
}

/* ── Data ── */
const models: AIModel[] = [
  {
    id: 'claude',
    name: 'Claude Opus 4.6',
    provider: 'Anthropic',
    status: 'Active',
    isDefault: true,
    isFallback: false,
    temperature: 0.3,
    maxTokens: 4096,
    rateLimit: '60 req/min',
    apiKeyMasked: 'sk-ant-****...8f3d',
    fallbackChain: ['GPT-4o', 'Gemini Pro 2'],
  },
  {
    id: 'gpt4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    status: 'Standby',
    isDefault: false,
    isFallback: true,
    temperature: 0.5,
    maxTokens: 4096,
    rateLimit: '40 req/min',
    apiKeyMasked: 'sk-****...2a1b',
    fallbackChain: ['Gemini Pro 2'],
  },
  {
    id: 'gemini',
    name: 'Gemini Pro 2',
    provider: 'Google',
    status: 'Standby',
    isDefault: false,
    isFallback: false,
    temperature: 0.4,
    maxTokens: 8192,
    rateLimit: '30 req/min',
    apiKeyMasked: 'AIza****...9xQp',
    fallbackChain: [],
  },
];

const templates: PromptTemplate[] = [
  {
    id: 'system-prompt',
    name: 'System Prompt',
    type: 'SYSTEM',
    model: 'Claude',
    updated: '2h ago',
  },
  {
    id: 'invoice-extractor',
    name: 'Invoice Extractor',
    type: 'EXTRACT',
    model: 'GPT-4o',
    updated: '1d ago',
  },
  {
    id: 'daily-briefing',
    name: 'Daily Briefing',
    type: 'GENERATE',
    model: 'Claude',
    updated: '3d ago',
  },
  { id: 'email-draft', name: 'Email Draft', type: 'GENERATE', model: 'Claude', updated: '5d ago' },
  {
    id: 'payment-classifier',
    name: 'Payment Classifier',
    type: 'CLASSIFY',
    model: 'Claude',
    updated: '1w ago',
  },
  {
    id: 'vendor-matcher',
    name: 'Vendor Matcher',
    type: 'EXTRACT',
    model: 'GPT-4o',
    updated: '2w ago',
  },
];

const typeColors: Record<string, string> = {
  SYSTEM: 'bg-[#dbeafe] text-[#1e40af]',
  EXTRACT: 'bg-[#ede9fe] text-[#5b21b6]',
  GENERATE: 'bg-[#d1fae5] text-[#065f46]',
  CLASSIFY: 'bg-[#fef3c7] text-[#92400e]',
};

/* ── Model Card ── */
function ModelCard({ model, onClick }: { model: AIModel; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start rounded-xl border border-border bg-card p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] hover:border-[#c4b5fd]"
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{model.provider}</span>
        {model.status === 'Active' ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-[#065f46]">
            <Check className="h-3 w-3" /> Active
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Circle className="h-3 w-3" /> {model.status}
          </span>
        )}
      </div>
      <h3 className="mt-2 font-serif text-base font-semibold text-foreground">{model.name}</h3>
      <div className="mt-2 flex gap-1.5">
        {model.isDefault && (
          <Badge
            variant="secondary"
            className="rounded-md bg-[#ede9fe] text-[#5b21b6] text-[10px] px-1.5 py-0"
          >
            Default
          </Badge>
        )}
        {model.isFallback && (
          <Badge
            variant="secondary"
            className="rounded-md bg-[#fef3c7] text-[#92400e] text-[10px] px-1.5 py-0"
          >
            Fallback
          </Badge>
        )}
      </div>
    </button>
  );
}

/* ── Model Config Sheet ── */
function ModelConfigSheet({
  model,
  open,
  onClose,
}: {
  model: AIModel | null;
  open: boolean;
  onClose: () => void;
}) {
  const [showKey, setShowKey] = useState(false);

  if (!model) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif">{model.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Provider
            </Label>
            <p className="mt-1 text-sm text-foreground">{model.provider}</p>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              API Key
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-secondary px-3 py-2 font-mono text-xs text-foreground">
                {showKey ? 'sk-ant-api03-real-key-here-xxxx' : model.apiKeyMasked}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowKey(!showKey)}
                className="h-8 w-8 p-0"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Temperature
              </Label>
              <Input
                type="number"
                step={0.1}
                min={0}
                max={2}
                defaultValue={model.temperature}
                className="mt-1 rounded-md font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Max Tokens
              </Label>
              <Input
                type="number"
                step={256}
                defaultValue={model.maxTokens}
                className="mt-1 rounded-md font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rate Limit
            </Label>
            <Input defaultValue={model.rateLimit} className="mt-1 rounded-md text-sm" />
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </Label>
            <Select defaultValue={model.status}>
              <SelectTrigger className="mt-1 rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Standby">Standby</SelectItem>
                <SelectItem value="Disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fallback Chain
            </Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {model.fallbackChain.length > 0 ? (
                model.fallbackChain.map((f) => (
                  <Badge key={f} variant="secondary" className="rounded-md bg-secondary text-xs">
                    {f}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No fallback models configured</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button className="flex-1 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
              Save Changes
            </Button>
            <Button variant="outline" onClick={onClose} className="rounded-lg">
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Page ── */
export default function AIConfigurationPage() {
  const [search, setSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);

  const filteredTemplates = useMemo(() => {
    if (!search) return templates;
    const s = search.toLowerCase();
    return templates.filter(
      (t) => t.name.toLowerCase().includes(s) || t.type.toLowerCase().includes(s),
    );
  }, [search]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Cpu className="h-3.5 w-3.5 text-[#7c3aed]" />
          <span>AI &gt; Configuration</span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">AI Configuration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage AI models, prompt templates, and agent configuration.
        </p>
      </div>

      {/* Model Registry */}
      <section className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Model Registry
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {models.map((m) => (
            <ModelCard key={m.id} model={m} onClick={() => setSelectedModel(m)} />
          ))}
          <button className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/50 p-5 text-muted-foreground transition-colors hover:border-[#c4b5fd] hover:bg-[#f5f3ff] hover:text-[#7c3aed]">
            <Plus className="mb-2 h-5 w-5" />
            <span className="text-sm font-medium">Add Model</span>
          </button>
        </div>
      </section>

      {/* Prompt Templates */}
      <section className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prompt Templates
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search prompts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-56 rounded-lg border-border pl-9 text-sm"
              />
            </div>
            <Button size="sm" className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Template
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Template Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                  Model
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-[#f5f3ff]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/ai/configuration/prompts/${t.id}`}
                      className="text-sm font-medium text-foreground hover:text-[#7c3aed]"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${typeColors[t.type] || 'bg-secondary text-muted-foreground'}`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-muted-foreground sm:table-cell">
                    {t.model}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                    {t.updated}
                  </td>
                </tr>
              ))}
              {filteredTemplates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No templates match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Model Config Sheet */}
      <ModelConfigSheet
        model={selectedModel}
        open={!!selectedModel}
        onClose={() => setSelectedModel(null)}
      />
    </div>
  );
}
