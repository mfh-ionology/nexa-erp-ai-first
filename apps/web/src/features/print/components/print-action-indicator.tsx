/**
 * Inline spinner shown next to save buttons during PDF generation.
 *
 * Non-intrusive: small icon that fades in/out with animation.
 * Respects `prefers-reduced-motion` by disabling animation.
 */

import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface PrintActionIndicatorProps {
  isPrinting: boolean;
}

export function PrintActionIndicator({ isPrinting }: PrintActionIndicatorProps) {
  return (
    <span
      data-testid="print-action-indicator"
      className={cn(
        'inline-flex items-center transition-opacity duration-200 motion-reduce:transition-none',
        isPrinting ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!isPrinting}
    >
      <Loader2
        className={cn(
          'size-4 text-primary',
          isPrinting && 'animate-spin motion-reduce:animate-none',
        )}
      />
    </span>
  );
}
