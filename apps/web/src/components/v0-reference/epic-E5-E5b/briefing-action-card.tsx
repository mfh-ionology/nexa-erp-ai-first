'use client';

import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface BriefingAction {
  label: string;
  variant: 'primary' | 'outline';
}

interface BriefingActionCardProps {
  icon: React.ReactNode;
  title: string;
  entities: { name: string; amount?: string }[];
  aiRecommendation: string;
  actions: BriefingAction[];
  delay?: number;
}

export function BriefingActionCard({
  icon,
  title,
  entities,
  aiRecommendation,
  actions,
  delay = 0,
}: BriefingActionCardProps) {
  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ede9fe] text-[#7c3aed]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-base font-semibold text-foreground">{title}</h3>
        </div>
      </div>

      {/* Entity preview */}
      {entities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {entities.map((entity) => (
            <span key={entity.name} className="text-sm text-muted-foreground">
              {entity.name}
              {entity.amount && (
                <span className="ml-1 font-mono text-sm font-medium text-foreground">
                  {entity.amount}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* AI Recommendation */}
      <div className="mt-4 rounded-lg border-l-2 border-[#7c3aed] bg-[#f5f3ff] px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#7c3aed]" />
          <p className="text-sm leading-relaxed text-[#6d28d9]">{aiRecommendation}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) =>
          action.variant === 'primary' ? (
            <Button
              key={action.label}
              size="sm"
              className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            >
              {action.label}
            </Button>
          ) : (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="rounded-lg border-border hover:bg-[#f5f3ff] hover:text-[#7c3aed]"
            >
              {action.label}
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
