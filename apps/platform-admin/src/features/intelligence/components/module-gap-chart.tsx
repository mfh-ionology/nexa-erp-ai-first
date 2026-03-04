import { useMemo } from 'react';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModuleGapChartProps {
  /** Record of module name → gap count */
  data: Record<string, number>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Purple palette for bars — darkest first, lighter for secondary */
const BAR_COLORS = [
  'bg-[#7c3aed]',
  'bg-[#8b5cf6]',
  'bg-[#a78bfa]',
  'bg-[#c4b5fd]',
  'bg-[#ddd6fe]',
  'bg-[#ede9fe]',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModuleGapChart({ data, className }: ModuleGapChartProps) {
  // Sort entries by count descending
  const sortedEntries = useMemo(() => {
    return Object.entries(data).sort(([, a], [, b]) => b - a);
  }, [data]);

  const maxCount = sortedEntries.length > 0 ? sortedEntries[0]![1] : 0;

  if (sortedEntries.length === 0 || maxCount === 0) return null;

  return (
    <div
      className={cn('space-y-2', className)}
      role="img"
      aria-label="Feature gaps by module — horizontal bar chart"
    >
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Gaps by Module
      </h3>

      <div className="space-y-1.5">
        {sortedEntries.map(([module, count], idx) => {
          const widthPercent = Math.max((count / maxCount) * 100, 2); // min 2% for visibility
          const barColor = BAR_COLORS[idx % BAR_COLORS.length];

          return (
            <div key={module} className="group flex items-center gap-2">
              {/* Module label */}
              <span className="w-24 shrink-0 truncate text-right text-xs font-medium text-muted-foreground">
                {module}
              </span>

              {/* Bar container */}
              <div className="relative flex-1 h-5 rounded bg-muted/30">
                <div
                  className={cn(
                    'h-full rounded transition-all duration-300',
                    barColor,
                    'motion-reduce:transition-none',
                  )}
                  style={{ width: `${widthPercent}%` }}
                  role="presentation"
                />

                {/* Tooltip on hover */}
                <div
                  className={cn(
                    'pointer-events-none absolute left-0 top-0 flex h-full items-center pl-2',
                    'opacity-0 transition-opacity group-hover:opacity-100',
                    'motion-reduce:transition-none',
                  )}
                >
                  <span className="rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-medium text-background">
                    {module}: {count}
                  </span>
                </div>
              </div>

              {/* Count label */}
              <span className="mono-amount w-8 shrink-0 text-right text-xs text-muted-foreground">
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Screen reader summary */}
      <div className="sr-only">
        Feature gaps by module: {sortedEntries.map(([mod, count]) => `${mod}: ${count}`).join(', ')}
      </div>
    </div>
  );
}
