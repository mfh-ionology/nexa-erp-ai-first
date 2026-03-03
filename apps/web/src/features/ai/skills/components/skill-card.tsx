import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';

import { PATTERN_STYLES } from '../constants';
import type { Skill } from '../types';

interface SkillCardProps {
  skill: Skill;
  isAdmin: boolean;
  onClick: (skill: Skill) => void;
  index?: number;
}

export function SkillCard({ skill, isAdmin: _isAdmin, onClick, index = 0 }: SkillCardProps) {
  const { t } = useI18n('ai');

  const patternStyle = PATTERN_STYLES[skill.orchestrationPattern] ?? {
    bg: 'bg-secondary',
    text: 'text-secondary-foreground',
  };

  const patternKey = `skills.patterns.${skill.orchestrationPattern}` as const;

  return (
    <article
      className="animate-fade-in-up cursor-pointer rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/50"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={() => onClick(skill)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(skill);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${skill.displayName || skill.name}: ${skill.description ?? ''}`}
    >
      {/* Header — name, description, status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-base font-semibold text-foreground">
            {skill.displayName || skill.name}
          </h3>
          {skill.description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{skill.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {skill.hasOverride && (
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {t('skills.overrideApplied')}
            </Badge>
          )}
          <span
            className="flex items-center gap-1.5 text-xs font-medium"
            aria-label={skill.isActive ? t('skills.active') : t('skills.inactive')}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                skill.isActive ? 'bg-[#10b981]' : 'bg-[#9ca3af]'
              }`}
              aria-hidden="true"
            />
            {skill.isActive ? t('skills.active') : t('skills.inactive')}
          </span>
        </div>
      </div>

      {/* Trigger phrases — green pills */}
      {skill.triggerPhrases.length > 0 && (
        <div className="mt-3">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t('skills.triggers')}:
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {skill.triggerPhrases.map((phrase) => (
              <span
                key={phrase}
                className="inline-flex items-center rounded-full bg-[#d1fae5] px-2.5 py-0.5 text-xs font-medium text-[#065f46]"
              >
                {phrase}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Negative triggers — red pills */}
      {skill.negativeTriggers.length > 0 && (
        <div className="mt-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t('skills.blocks')}:
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {skill.negativeTriggers.map((phrase) => (
              <span
                key={phrase}
                className="inline-flex items-center rounded-full bg-[#fee2e2] px-2.5 py-0.5 text-xs font-medium text-[#991b1b]"
              >
                {phrase}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer — pattern badge */}
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${patternStyle.bg} ${patternStyle.text}`}
        >
          {t(patternKey)}
        </span>
      </div>
    </article>
  );
}
