import { cn } from '@/lib/utils';

interface AiChipProps {
  label?: string;
  className?: string;
}

/**
 * AiChip — small inline indicator for AI-suggested or AI-generated values.
 *
 * Concept D styling: purple-tinted background with sparkle emoji prefix.
 * Used next to field values, table cells, or badge-like contexts where
 * the system wants to indicate "this was AI-suggested".
 */
export function AiChip({ label = 'AI Suggested', className }: AiChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-medium text-[#6d28d9]',
        className,
      )}
    >
      <span className="text-[10px]" aria-hidden="true">
        ✨
      </span>
      {label}
    </span>
  );
}
