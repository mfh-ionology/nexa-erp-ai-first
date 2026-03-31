import { useI18n } from '@nexa/i18n';

import { cn } from '@/lib/utils';

import type { BriefingScheduleItem } from '../api/use-briefing';

// ---------------------------------------------------------------------------
// Status dot styling
// ---------------------------------------------------------------------------

const statusDot: Record<BriefingScheduleItem['status'], string> = {
  completed: 'bg-emerald-500',
  upcoming: 'bg-amber-500',
  future: 'bg-gray-300',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ScheduleTimelineProps {
  items: BriefingScheduleItem[];
}

export function ScheduleTimeline({ items }: ScheduleTimelineProps) {
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
      <h2 className="mb-4 font-serif text-base font-semibold text-foreground">
        {t('briefing.schedule')}
      </h2>

      {/* Timeline */}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('briefing.noItems')}</p>
      ) : (
        <ol className="relative border-l-2 border-border pl-6" aria-label={t('briefing.schedule')}>
          {items.map((item) => (
            <li key={item.id} className="relative pb-4 last:pb-0">
              {/* Dot on the timeline */}
              <span
                className={cn(
                  'absolute -left-[calc(1.5rem+5px)] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white',
                  statusDot[item.status],
                )}
                aria-hidden="true"
              />

              {/* Time */}
              {item.time && (
                <p className="text-xs font-medium text-muted-foreground">{item.time}</p>
              )}

              {/* Title */}
              <p className="text-sm font-medium text-foreground">{item.title}</p>

              {/* Detail */}
              {item.detail && <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
