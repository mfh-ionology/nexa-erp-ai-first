import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DataCard as DataCardType } from '@/stores/copilot-store';

import { useI18n } from '@nexa/i18n';

// ── Trend icon ──────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  const Icon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
  return (
    <Icon
      className={cn(
        'size-3',
        trend === 'up' && 'text-green-600',
        trend === 'down' && 'text-red-600',
        trend === 'neutral' && 'text-muted-foreground',
      )}
    />
  );
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * DataCard — compact inline card for AI message data summaries.
 *
 * Renders a title and a list of key metrics with optional trend
 * indicators (up/down/neutral arrow + value).
 *
 * Used inside CopilotChat when the AI returns structured data
 * (revenue comparisons, overdue summaries, stock levels, etc.).
 */
export function DataCard({ card }: { card: DataCardType }) {
  const { t } = useI18n();

  const title = card.titleKey ? t(card.titleKey) : card.title;

  return (
    <Card className="mt-2 gap-0 py-0 shadow-none">
      <CardHeader className="gap-0 px-3 py-2">
        <CardTitle className="text-xs font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 pb-2">
        {card.metrics.map((metric, idx) => {
          const label = metric.labelKey ? t(metric.labelKey) : metric.label;
          return (
            <div key={idx} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium">{metric.value}</span>
                {metric.trend && <TrendIcon trend={metric.trend} />}
                {metric.trendValue && (
                  <span
                    className={cn(
                      'text-[10px]',
                      metric.trend === 'up' && 'text-green-600',
                      metric.trend === 'down' && 'text-red-600',
                      metric.trend === 'neutral' && 'text-muted-foreground',
                    )}
                  >
                    {metric.trendValue}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
