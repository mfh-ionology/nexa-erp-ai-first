/* eslint-disable i18next/no-literal-string */
/**
 * Prompt Version History Sidebar — shows version list with diff view and restore.
 *
 * AC-5d: Version history sidebar with version number, change reason, created by, date.
 *        Active version has purple left border. Click loads diff.
 * AC-7:  "Restore This Version" button creates a new version copying old content.
 *
 * Uses an LCS-based line diff algorithm (no external dependency).
 */

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { History, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { AiPromptVersionItem } from '../api/types';
import {
  useAiPromptVersions,
  useAiPromptVersion,
  useRestoreAiPromptVersion,
} from '../api/use-ai-prompts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromptVersionSidebarProps {
  promptId: string | undefined;
  activeVersion: number;
  /** Current system prompt content (for diffing against selected version) */
  currentSystemPrompt: string;
  /** Current user template content (for diffing against selected version) */
  currentUserTemplate: string;
}

// ─── Simple line-by-line diff ────────────────────────────────────────────────

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'unchanged', content: oldLines[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      result.push({ type: 'added', content: newLines[j - 1]! });
      j--;
    } else {
      result.push({ type: 'removed', content: oldLines[i - 1]! });
      i--;
    }
  }

  return result.reverse();
}

// ─── Diff View Component ─────────────────────────────────────────────────────

function DiffView({
  title,
  oldText,
  newText,
}: {
  title: string;
  oldText: string;
  newText: string;
}) {
  const lines = computeLineDiff(oldText, newText);
  const hasChanges = lines.some((l) => l.type !== 'unchanged');

  if (!hasChanges) {
    return (
      <div className="space-y-1.5">
        <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
        <p className="text-xs italic text-muted-foreground">No changes</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <div className="max-h-48 overflow-y-auto rounded-md border text-xs">
        {lines.map((line, i) => (
          <div
            key={`${line.type}-${i}-${line.content.slice(0, 32)}`}
            className={cn(
              'flex gap-1 px-2 py-0.5 font-mono',
              line.type === 'added' && 'bg-green-50 text-green-800',
              line.type === 'removed' && 'bg-red-50 text-red-800',
            )}
          >
            <span
              className="w-3 shrink-0 select-none text-right opacity-60"
              aria-label={
                line.type === 'added'
                  ? 'Added line'
                  : line.type === 'removed'
                    ? 'Removed line'
                    : undefined
              }
            >
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            <span className="break-all">{line.content || '\u00A0'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Version Item ────────────────────────────────────────────────────────────

function VersionItem({
  version,
  isActive,
  isSelected,
  onSelect,
}: {
  version: AiPromptVersionItem;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="listitem"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'cursor-pointer border-l-2 px-3 py-2.5 transition-colors',
        isActive
          ? 'border-l-[#7c3aed] bg-[#f5f3ff]'
          : isSelected
            ? 'border-l-[#7c3aed]/50 bg-muted/50'
            : 'border-l-transparent hover:bg-muted/30',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold">v{version.version}</span>
        {isActive && (
          <Badge className="bg-[#7c3aed] text-white text-[10px] px-1.5 py-0 hover:bg-[#5b21b6]">
            Active
          </Badge>
        )}
      </div>
      {version.changeReason && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{version.changeReason}</p>
      )}
      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
        {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
      </p>
    </div>
  );
}

// ─── Sidebar Component ───────────────────────────────────────────────────────

export function PromptVersionSidebar({
  promptId,
  activeVersion,
  currentSystemPrompt,
  currentUserTemplate,
}: PromptVersionSidebarProps) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const { data: versions, isLoading: versionsLoading } = useAiPromptVersions(promptId);
  const { data: selectedVersionData, isLoading: versionDetailLoading } = useAiPromptVersion(
    promptId,
    selectedVersion ?? undefined,
  );
  const restoreMutation = useRestoreAiPromptVersion();

  const handleRestore = async () => {
    if (!promptId || selectedVersion === null) return;
    try {
      await restoreMutation.mutateAsync({ promptId, version: selectedVersion });
      setSelectedVersion(null);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message ?? 'Failed to restore version');
    }
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <History className="size-4 text-[#7c3aed]" />
        <h3 className="font-serif text-sm font-semibold">Version History</h3>
        {versions && (
          <Badge variant="secondary" className="bg-muted text-xs">
            {versions.length}
          </Badge>
        )}
      </div>

      {/* Version List */}
      <div
        className="max-h-[calc(100vh-200px)] overflow-y-auto"
        role="list"
        aria-label="Version history"
      >
        {versionsLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : versions && versions.length > 0 ? (
          versions.map((v) => (
            <VersionItem
              key={v.id}
              version={v}
              isActive={v.version === activeVersion}
              isSelected={v.version === selectedVersion}
              onSelect={() => setSelectedVersion(v.version === selectedVersion ? null : v.version)}
            />
          ))
        ) : (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">No versions yet</p>
        )}
      </div>

      {/* Diff View (shown when a non-active version is selected) */}
      {selectedVersion !== null && selectedVersion !== activeVersion && (
        <div className="border-t p-3 space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground">
            Changes: v{selectedVersion} vs current
          </h4>

          {versionDetailLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : selectedVersionData ? (
            <>
              <DiffView
                title="System Prompt"
                oldText={selectedVersionData.systemPrompt}
                newText={currentSystemPrompt}
              />
              <DiffView
                title="User Template"
                oldText={selectedVersionData.userTemplate}
                newText={currentUserTemplate}
              />

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={handleRestore}
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Restore This Version
              </Button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
