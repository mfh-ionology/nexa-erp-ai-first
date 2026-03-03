/* eslint-disable i18next/no-literal-string */
/**
 * JsonViewer — Collapsible JSON display component with copy-to-clipboard.
 *
 * Used in the step timeline to show step input/output data.
 * AC-3: Step expandable details — collapsible JSON viewer with syntax highlighting
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface JsonViewerProps {
  /** JSON data to display */
  data: unknown;
  /** Label shown next to the collapse toggle */
  label: string;
  /** Whether the viewer starts expanded */
  defaultExpanded?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JsonViewer({ data, label, defaultExpanded = false }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (data === null || data === undefined) {
    return <div className="text-sm text-muted-foreground italic">{label}: No data</div>;
  }

  const jsonStr = JSON.stringify(data, null, 2);

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-[#7c3aed] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        {label}
      </button>
      {expanded && (
        <div className="relative mt-2 rounded-lg bg-[#f8f7ff] border border-border/50">
          <div className="absolute right-2 top-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={() => void copyJsonToClipboard(jsonStr)}
              aria-label="Copy JSON"
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
          <pre className="max-h-64 overflow-auto p-4 pr-10 font-mono text-xs leading-relaxed text-foreground/80">
            {jsonStr}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function copyJsonToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  } catch {
    toast.error('Failed to copy');
  }
}
