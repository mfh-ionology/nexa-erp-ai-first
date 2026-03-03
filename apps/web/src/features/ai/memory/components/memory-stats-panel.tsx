import { useMemo } from 'react';
import { useI18n } from '@nexa/i18n';

import { CATEGORY_I18N_KEYS, CATEGORY_STYLES } from '../constants';
import type { Memory, MemoryCategory } from '../types';

interface MemoryStatsPanelProps {
  memories: Memory[];
}

export function MemoryStatsPanel({ memories }: MemoryStatsPanelProps) {
  const { t } = useI18n('ai');

  const stats = useMemo(() => {
    const total = memories.length;
    const explicit = memories.filter((m) => m.source === 'EXPLICIT').length;
    const learned = total - explicit;
    const explicitPct = total > 0 ? Math.round((explicit / total) * 100) : 0;
    const learnedPct = total > 0 ? 100 - explicitPct : 0;

    const byCategory = new Map<MemoryCategory, number>();
    for (const m of memories) {
      byCategory.set(m.category, (byCategory.get(m.category) ?? 0) + 1);
    }

    return { total, explicit, learned, explicitPct, learnedPct, byCategory };
  }, [memories]);

  if (stats.total === 0) {
    return null;
  }

  return (
    <div className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <h2 className="font-serif text-lg font-semibold text-foreground">
        {t('memory.stats.total')}
      </h2>

      {/* Total count */}
      <div className="mt-3">
        <span className="text-3xl font-bold text-[#7c3aed]">{stats.total}</span>
      </div>

      {/* Source breakdown: Explicit vs Learned */}
      <div className="mt-4">
        {/* Progress bar */}
        <div className="flex h-2 overflow-hidden rounded-full bg-[#f3f4f6]">
          <div
            className="rounded-l-full bg-[#7c3aed] transition-all"
            style={{ width: `${stats.explicitPct}%` }}
            role="progressbar"
            aria-valuenow={stats.explicitPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${t('memory.stats.explicit')}: ${stats.explicitPct}%`}
          />
          <div
            className="bg-[#d1d5db] transition-all"
            style={{ width: `${stats.learnedPct}%` }}
            role="progressbar"
            aria-valuenow={stats.learnedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${t('memory.stats.learned')}: ${stats.learnedPct}%`}
          />
        </div>

        {/* Labels */}
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#7c3aed]" />
            <span className="font-medium text-foreground">{t('memory.stats.explicit')}</span>
            <span className="text-muted-foreground">
              {stats.explicit} ({stats.explicitPct}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#d1d5db]" />
            <span className="font-medium text-foreground">{t('memory.stats.learned')}</span>
            <span className="text-muted-foreground">
              {stats.learned} ({stats.learnedPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* Per-category breakdown */}
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from(stats.byCategory.entries()).map(([category, count]) => {
          const style = CATEGORY_STYLES[category];
          return (
            <span
              key={category}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}
            >
              {t(CATEGORY_I18N_KEYS[category])}
              <span className="font-semibold">{count}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
