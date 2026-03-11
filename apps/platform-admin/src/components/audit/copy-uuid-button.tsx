// ---------------------------------------------------------------------------
// Copy UUID Button — Truncated UUID with click-to-copy
// Used by audit-log page and audit tab
// Story: E13b.6
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyUuidButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        },
        () => {
          // Clipboard API unavailable or permission denied — no-op
        },
      );
    },
    [value],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
      title={value}
      aria-label={`Copy ${value}`}
    >
      <span>{value.slice(0, 8)}…</span>
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
