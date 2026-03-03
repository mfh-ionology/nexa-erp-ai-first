/* eslint-disable i18next/no-literal-string */
/**
 * Prompt Test Panel — slide-in Sheet for testing prompt rendering with sample variables.
 *
 * AC-5e: "Test Prompt" button renders the prompt with sample variables via PromptRenderer.
 * Shows input fields for each bound variable and displays rendered output.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Play } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

import type { AiPromptVariable, TestRenderResult } from '../api/types';
import { useTestAiPrompt } from '../api/use-ai-prompts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromptTestPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptId: string | undefined;
  variables: AiPromptVariable[];
}

// ─── Source type label helper ────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  system: 'System',
  db_field: 'DB Field',
  page_field: 'Page Field',
  constant: 'Constant',
  expression: 'Expression',
  custom: 'Custom',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function PromptTestPanel({ open, onOpenChange, promptId, variables }: PromptTestPanelProps) {
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<TestRenderResult | null>(null);

  const testMutation = useTestAiPrompt();

  // Initialize sample values from variables
  const variableList = useMemo(() => variables ?? [], [variables]);

  const handleValueChange = (variableName: string, value: string) => {
    setSampleValues((prev) => ({ ...prev, [variableName]: value }));
  };

  const handleRender = async () => {
    if (!promptId) return;

    try {
      const data = await testMutation.mutateAsync({
        promptId,
        sampleVariables: sampleValues,
      });
      setResult(data);
    } catch {
      // Error rendered via testMutation.isError UI below
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif">Test Prompt</SheetTitle>
          <SheetDescription>
            Provide sample values for variables and render the prompt to see the resolved output.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          {/* Variable Inputs */}
          {variableList.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Sample Variables</h4>
              {variableList.map((v) => (
                <div key={v.variableName} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`var-${v.variableName}`}
                      className="text-xs font-mono font-medium"
                    >
                      {v.variableName}
                    </label>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {SOURCE_LABELS[v.sourceType] ?? v.sourceType}
                    </Badge>
                  </div>
                  <Input
                    id={`var-${v.variableName}`}
                    placeholder={v.displayName}
                    value={sampleValues[v.variableName] ?? ''}
                    onChange={(e) => handleValueChange(v.variableName, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No bound variables found for this prompt.
            </p>
          )}

          {/* Render Button */}
          <Button
            onClick={handleRender}
            disabled={!promptId || testMutation.isPending}
            className="w-full gap-1.5"
          >
            {testMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Render
          </Button>

          {/* Loading State */}
          {testMutation.isPending && (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {/* Error State */}
          {testMutation.isError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">
                Failed to render prompt. Check the template syntax.
              </p>
            </div>
          )}

          {/* Rendered Output */}
          {result && !testMutation.isPending && (
            <div className="space-y-4">
              {/* Unresolved Warning */}
              {result.unresolvedCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-700">
                    {result.unresolvedCount} variable{result.unresolvedCount > 1 ? 's' : ''} could
                    not be resolved
                  </p>
                </div>
              )}

              {/* Rendered System Prompt */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground">
                  Rendered System Prompt
                </h4>
                <div className="rounded-lg border-l-4 border-l-green-500 bg-muted/30 p-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {result.systemPrompt}
                  </pre>
                </div>
              </div>

              {/* Rendered User Template */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground">
                  Rendered User Template
                </h4>
                <div className="rounded-lg border-l-4 border-l-green-500 bg-muted/30 p-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {result.userTemplate}
                  </pre>
                </div>
              </div>

              {/* Resolved Variables */}
              {Object.keys(result.resolvedVariables).length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-muted-foreground">Resolved Variables</h4>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <dl className="space-y-1 text-xs">
                      {Object.entries(result.resolvedVariables).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <dt className="shrink-0 font-mono font-medium text-muted-foreground">
                            {key}:
                          </dt>
                          <dd className="truncate">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
