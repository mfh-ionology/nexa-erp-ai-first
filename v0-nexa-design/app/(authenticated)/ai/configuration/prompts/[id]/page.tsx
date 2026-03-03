'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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
import { ArrowLeft, Play, Save, Hash, DollarSign, Clock, ChevronRight } from 'lucide-react';

/* ── Data ── */
const variables = [
  { name: 'company_name', type: 'DB_FIELD' },
  { name: 'document_type', type: 'DB_FIELD' },
  { name: 'currency_code', type: 'DB_FIELD' },
  { name: 'invoice_lines', type: 'DB_FIELD' },
  { name: 'today', type: 'SYSTEM' },
  { name: 'user_name', type: 'SYSTEM' },
  { name: 'tenant_id', type: 'SYSTEM' },
  { name: 'vat_rate', type: 'CONSTANT' },
  { name: 'base_currency', type: 'CONSTANT' },
];

const versions = [
  { version: 'v3', time: '2h ago', isCurrent: true },
  { version: 'v2', time: '1d ago', isCurrent: false },
  { version: 'v1', time: '5d ago', isCurrent: false },
];

const defaultPromptText = `Extract the following fields from the document:

Company: {{company_name}}
Document Type: {{document_type}}
Currency: {{currency_code}}

Return as JSON:
{
  "invoice_no": "",
  "date": "",
  "line_items": [],
  "subtotal": 0,
  "vat": 0,
  "total": 0
}

Rules:
- Parse all line items with description, quantity, unit price
- Calculate VAT at {{vat_rate}}% unless exempt
- Amounts in {{currency_code}} with 2 decimal places`;

/* ── Variable Dropdown ── */
function VariableDropdown({
  show,
  filter,
  onSelect,
  position,
}: {
  show: boolean;
  filter: string;
  onSelect: (name: string) => void;
  position: { top: number; left: number };
}) {
  if (!show) return null;

  const filtered = variables.filter((v) => v.name.toLowerCase().includes(filter.toLowerCase()));

  const typeColor: Record<string, string> = {
    DB_FIELD: 'bg-[#ede9fe] text-[#5b21b6]',
    SYSTEM: 'bg-[#dbeafe] text-[#1e40af]',
    CONSTANT: 'bg-[#fef3c7] text-[#92400e]',
  };

  return (
    <div
      className="absolute z-50 w-64 rounded-lg border border-border bg-card shadow-lg animate-fade-in-up"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-2">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Insert Variable
        </p>
        {filtered.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">No matching variables</p>
        )}
        {filtered.map((v) => (
          <button
            key={v.name}
            onClick={() => onSelect(v.name)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[#f5f3ff]"
          >
            <code className="font-mono text-xs text-foreground">{`{{${v.name}}}`}</code>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${typeColor[v.type]}`}>
              {v.type}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Page ── */
export default function PromptEditorPage() {
  const [name, setName] = useState('Invoice Extractor');
  const [type, setType] = useState('EXTRACT');
  const [model, setModel] = useState('claude');
  const [promptText, setPromptText] = useState(defaultPromptText);
  const [showVarDropdown, setShowVarDropdown] = useState(false);
  const [varFilter, setVarFilter] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [testOutput, setTestOutput] = useState('');
  const [testing, setTesting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Token count estimate */
  const tokenCount = Math.ceil(promptText.length / 4);
  const estCost = (tokenCount * 0.000008).toFixed(4);

  /* Variable detection on {{ */
  const handlePromptChange = useCallback((value: string) => {
    setPromptText(value);
    const cursorPos = textareaRef.current?.selectionStart ?? 0;
    const textBefore = value.slice(0, cursorPos);
    const match = textBefore.match(/\{\{([a-z_]*)$/);
    if (match) {
      setVarFilter(match[1]);
      setShowVarDropdown(true);
      setDropdownPos({ top: 300, left: 16 });
    } else {
      setShowVarDropdown(false);
    }
  }, []);

  const handleInsertVar = useCallback(
    (varName: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const cursorPos = ta.selectionStart;
      const textBefore = promptText.slice(0, cursorPos);
      const textAfter = promptText.slice(cursorPos);
      const match = textBefore.match(/\{\{([a-z_]*)$/);
      if (match) {
        const start = cursorPos - match[0].length;
        const replacement = `{{${varName}}}`;
        const newText = textBefore.slice(0, start) + replacement + textAfter;
        setPromptText(newText);
      }
      setShowVarDropdown(false);
    },
    [promptText],
  );

  /* Used variables */
  const usedVars = useMemo(() => {
    const matches = promptText.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
  }, [promptText]);

  /* Test handler */
  const handleTest = useCallback(() => {
    setTesting(true);
    setTestOutput('');
    const sampleOutput = `{
  "invoice_no": "INV-2026-0042",
  "date": "2026-02-15",
  "line_items": [
    { "description": "Cloud Hosting (Feb)", "qty": 1, "unit_price": 2400.00 },
    { "description": "Support Hours", "qty": 12, "unit_price": 85.00 }
  ],
  "subtotal": 3420.00,
  "vat": 684.00,
  "total": 4104.00
}`;
    let idx = 0;
    const interval = setInterval(() => {
      setTestOutput(sampleOutput.slice(0, idx + 3));
      idx += 3;
      if (idx >= sampleOutput.length) {
        clearInterval(interval);
        setTesting(false);
      }
    }, 15);
  }, []);

  return (
    <div className="flex h-full flex-col -m-6">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/ai/configuration"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs text-muted-foreground">Prompt</p>
            <h1 className="font-serif text-base font-semibold text-foreground">{name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            className="rounded-lg"
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {testing ? 'Running...' : 'Test'}
          </Button>
          <Button size="sm" className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor */}
        <div className="flex flex-1 flex-col border-r border-border overflow-y-auto">
          <div className="space-y-4 p-6">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 rounded-md text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYSTEM">SYSTEM</SelectItem>
                    <SelectItem value="EXTRACT">EXTRACT</SelectItem>
                    <SelectItem value="GENERATE">GENERATE</SelectItem>
                    <SelectItem value="CLASSIFY">CLASSIFY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Model
                </Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="mt-1 rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude">Claude Opus 4.6</SelectItem>
                    <SelectItem value="gpt4o">GPT-4o</SelectItem>
                    <SelectItem value="gemini">Gemini Pro 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Code editor area */}
            <div className="relative">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Prompt Template
              </Label>
              <textarea
                ref={textareaRef}
                value={promptText}
                onChange={(e) => handlePromptChange(e.target.value)}
                className="mt-1 min-h-[320px] w-full resize-y rounded-lg border border-border bg-[#1e1b4b] p-4 font-mono text-xs leading-relaxed text-[#e2e8f0] outline-none focus:ring-2 focus:ring-[#7c3aed]/30"
                spellCheck={false}
              />
              <VariableDropdown
                show={showVarDropdown}
                filter={varFilter}
                onSelect={handleInsertVar}
                position={dropdownPos}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Type{' '}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px]">{'{{'}</code>{' '}
              to insert a variable.
            </p>
          </div>
        </div>

        {/* Right: Preview + History */}
        <div className="hidden w-[360px] flex-col overflow-y-auto lg:flex">
          <div className="space-y-6 p-6">
            {/* Test output */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Test Output
              </h3>
              <div className="mt-2 min-h-[200px] rounded-lg border border-border bg-[#1e1b4b] p-4">
                {testOutput ? (
                  <pre className="font-mono text-xs leading-relaxed text-[#a5f3fc] whitespace-pre-wrap">
                    {testOutput}
                    {testing && (
                      <span className="inline-block h-3 w-1.5 animate-pulse bg-[#a5f3fc]" />
                    )}
                  </pre>
                ) : (
                  <p className="text-xs text-[#64748b]">
                    Click &quot;Test&quot; to run this prompt with sample data.
                  </p>
                )}
              </div>
            </div>

            {/* Variables used */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Variables Used
              </h3>
              <div className="mt-2 space-y-1.5">
                {usedVars.map((v) => {
                  const def = variables.find((vr) => vr.name === v);
                  return (
                    <div
                      key={v}
                      className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-1.5"
                    >
                      <code className="font-mono text-xs text-foreground">{v}</code>
                      <span className="text-[10px] font-medium text-[#065f46]">
                        {def ? 'Resolved' : 'Unknown'}
                      </span>
                    </div>
                  );
                })}
                {usedVars.length === 0 && (
                  <p className="text-xs text-muted-foreground">No variables detected yet.</p>
                )}
              </div>
            </div>

            {/* Version History */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Version History
              </h3>
              <div className="mt-2 space-y-1">
                {versions.map((v) => (
                  <button
                    key={v.version}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-[#f5f3ff]"
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">{v.version}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{v.time}</span>
                    </div>
                    {v.isCurrent ? (
                      <Badge
                        variant="secondary"
                        className="bg-[#ede9fe] text-[10px] text-[#5b21b6]"
                      >
                        current
                      </Badge>
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-center text-xs text-[#7c3aed] hover:text-[#5b21b6] hover:bg-[#f5f3ff]"
              >
                View Diff
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-card px-6 py-2">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {tokenCount} tokens
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ~${estCost}/run
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last run: 2s ago
          </span>
        </div>
      </div>
    </div>
  );
}
