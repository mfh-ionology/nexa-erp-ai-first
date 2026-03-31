import { useI18n } from '@nexa/i18n';

import { cn } from '@/lib/utils';

import type { UrgencyCard as UrgencyCardType } from '../api/use-briefing';

// ---------------------------------------------------------------------------
// Border + badge colour map
// ---------------------------------------------------------------------------

const typeStyles: Record<
  UrgencyCardType['type'],
  { border: string; badge: string; badgeBg: string }
> = {
  overdue: {
    border: 'border-l-red-500',
    badge: 'text-red-700',
    badgeBg: 'bg-red-50',
  },
  approval: {
    border: 'border-l-amber-500',
    badge: 'text-amber-700',
    badgeBg: 'bg-amber-50',
  },
  insight: {
    border: 'border-l-[#7c3aed]',
    badge: 'text-[#7c3aed]',
    badgeBg: 'bg-purple-50',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface UrgencyCardProps {
  card: UrgencyCardType;
}

export function UrgencyCard({ card }: UrgencyCardProps) {
  const { t } = useI18n();
  const styles = typeStyles[card.type];

  return (
    <div
      className={cn(
        'rounded-xl border-l-4 bg-white p-4',
        'shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        'transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.1)]',
        styles.border,
      )}
      role="article"
      aria-label={card.title}
    >
      {/* Header row: title + count badge */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
        <span
          className={cn(
            'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-medium',
            styles.badgeBg,
            styles.badge,
          )}
          aria-label={`${card.count} ${t(`briefing.urgency.${card.type}`)}`}
        >
          {card.count}
        </span>
      </div>

      {/* Description */}
      <p className="mb-3 text-sm text-muted-foreground">{card.detail}</p>

      {/* Action buttons */}
      {card.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {card.actions.map((action, idx) => {
            const isPrimary = idx === 0;
            return (
              <button
                key={action.label}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  isPrimary
                    ? 'bg-[#7c3aed] text-white hover:bg-[#5b21b6]'
                    : 'border border-border bg-white text-foreground hover:bg-accent',
                )}
                onClick={() => {
                  if (action.route) {
                    window.location.href = action.route;
                  }
                }}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
