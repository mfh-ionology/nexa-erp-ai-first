/* eslint-disable i18next/no-literal-string */
/**
 * Test Trigger Panel — slide-in Sheet for testing L0→L1→L2 skill routing simulation.
 *
 * AC-5: Admin types a phrase and sees the routing chain results:
 *  - L0: matched module with confidence score
 *  - L1: matched skill with confidence score
 *  - L2: required tools + skill content preview
 *  - No match: warning with suggestions
 */

import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Eye, Loader2, Wand2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

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
import { cn } from '@/lib/utils';

import type { TestTriggerResult } from '../api/types';
import { useTestTrigger } from '../api/use-ai-skills';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestTriggerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Confidence bar ─────────────────────────────────────────────────────────

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const percentage = Math.round(value * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-xs font-medium">{percentage}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            percentage >= 70 ? 'bg-green-500' : percentage >= 40 ? 'bg-amber-500' : 'bg-red-400',
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${percentage}%`}
        />
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TestTriggerPanel({ open, onOpenChange }: TestTriggerPanelProps) {
  const [phrase, setPhrase] = useState('');
  const [result, setResult] = useState<TestTriggerResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const testMutation = useTestTrigger();

  const handleTest = useCallback(async () => {
    if (!phrase.trim()) return;

    try {
      const data = await testMutation.mutateAsync(phrase.trim());
      setResult(data);
    } catch {
      // Error rendered via testMutation.isError UI below
    }
  }, [phrase, testMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && phrase.trim()) {
        e.preventDefault();
        void handleTest();
      }
    },
    [handleTest, phrase],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-[480px]"
        aria-modal="true"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-serif">
            <Wand2 className="size-5 text-[#7c3aed]" />
            Test Trigger Phrase
          </SheetTitle>
          <SheetDescription>
            Type a phrase to simulate the L0→L1→L2 routing chain and see which skill would be
            activated.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          {/* Input + Test button */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 'show me overdue invoices'"
                className="flex-1 rounded-lg font-mono text-sm"
                aria-label="Trigger phrase input"
                autoFocus
              />
              <Button
                onClick={() => void handleTest()}
                disabled={!phrase.trim() || testMutation.isPending}
                className="shrink-0 gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
              >
                {testMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                Test
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {testMutation.isPending && (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          )}

          {/* Error State */}
          {testMutation.isError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">
                Failed to test trigger phrase. Please try again.
              </p>
            </div>
          )}

          {/* Results */}
          {result && !testMutation.isPending && (
            <div className="space-y-4 animate-fade-in-up">
              {result.noMatch ? (
                /* ─── No Match ──────────────────────────────────────── */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle className="size-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">No matching skill found</p>
                      <p className="mt-0.5 text-xs text-amber-600">
                        The phrase didn't match any active skill trigger patterns.
                      </p>
                    </div>
                  </div>

                  {/* Suggestions */}
                  {result.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Available modules:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.suggestions.map((mod) => (
                          <Badge
                            key={mod}
                            variant="secondary"
                            className="border border-[#6d28d9]/20 bg-[#ede9fe] font-mono text-xs uppercase text-[#6d28d9]"
                          >
                            {mod}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ─── Match Found ────────────────────────────────── */
                <div className="space-y-4">
                  {/* L0 — Module routing */}
                  <div className="rounded-xl border bg-background p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-md bg-[#f5f3ff] px-2 py-0.5 font-mono text-xs font-bold text-[#7c3aed]">
                        L0
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        Module Routing
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="border border-[#6d28d9]/20 bg-[#ede9fe] font-mono text-sm uppercase text-[#6d28d9]"
                      >
                        {result.matchedModule}
                      </Badge>
                      <ArrowRight className="size-3 text-muted-foreground" />
                    </div>
                    <div className="mt-2">
                      <ConfidenceBar value={result.l0Confidence} label="Confidence" />
                    </div>
                  </div>

                  {/* L1 — Skill selection */}
                  {result.matchedSkill && (
                    <div className="rounded-xl border bg-background p-4 shadow-sm">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-md bg-[#f5f3ff] px-2 py-0.5 font-mono text-xs font-bold text-[#7c3aed]">
                          L1
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          Skill Selection
                        </span>
                      </div>
                      <div>
                        <p className="font-mono text-sm font-bold">{result.matchedSkill.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {result.matchedSkill.displayName}
                        </p>
                      </div>
                      <div className="mt-2">
                        <ConfidenceBar value={result.l1Confidence} label="Confidence" />
                      </div>
                    </div>
                  )}

                  {/* L2 — Skill details */}
                  <div className="rounded-xl border bg-background p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-md bg-[#f5f3ff] px-2 py-0.5 font-mono text-xs font-bold text-[#7c3aed]">
                        L2
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        Skill Details
                      </span>
                    </div>

                    {/* Required Tools */}
                    {result.requiredTools.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Required Tools</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.requiredTools.map((tool) => (
                            <Badge
                              key={tool}
                              variant="secondary"
                              className="border border-[#7c3aed]/20 bg-[#f5f3ff] font-mono text-xs text-[#7c3aed]"
                            >
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skill content preview */}
                    {result.skillContentPreview && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Content Preview</p>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                            {result.skillContentPreview}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* View Skill link */}
                    {result.matchedSkill && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-1.5"
                        onClick={() => {
                          onOpenChange(false);
                          void navigate({
                            to: `/ai/admin/skills/${result.matchedSkill!.id}` as string,
                          });
                        }}
                      >
                        <Eye className="size-3.5" />
                        View Skill
                      </Button>
                    )}
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
