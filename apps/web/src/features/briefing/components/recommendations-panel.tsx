import { Sparkles } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { cn } from '@/lib/utils';

import type { BriefingRecommendation } from '../api/use-briefing';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RecommendationsPanelProps {
  recommendations: BriefingRecommendation[];
}

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        'rounded-xl bg-white p-5',
        'shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        'transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.1)]',
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#7c3aed]" aria-hidden="true" />
        <h2 className="font-serif text-base font-semibold text-foreground">
          {t('briefing.recommendations')}
        </h2>
      </div>

      {/* Recommendation list */}
      {recommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('briefing.noItems')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {recommendations.map((rec) => (
            <li
              key={rec.id}
              className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{rec.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{rec.detail}</p>
              </div>
              {rec.actions.length > 0 && (
                <button
                  className={cn(
                    'shrink-0 rounded-lg border border-[#7c3aed] px-3 py-1.5',
                    'text-xs font-medium text-[#7c3aed]',
                    'transition-colors hover:bg-[#7c3aed] hover:text-white',
                  )}
                  onClick={() => {
                    const action = rec.actions[0];
                    if (action?.route) {
                      window.location.href = action.route;
                    }
                  }}
                >
                  {rec.actions[0]?.label ?? t('briefing.review')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
