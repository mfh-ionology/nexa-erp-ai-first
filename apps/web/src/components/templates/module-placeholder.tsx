/* eslint-disable @typescript-eslint/naming-convention */
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

interface ModulePlaceholderProps {
  moduleKey: string;
  icon: LucideIcon;
  descriptionKey: string;
  features: string[];
}

export function ModulePlaceholder({
  moduleKey,
  icon: Icon,
  descriptionKey,
  features,
}: ModulePlaceholderProps) {
  const { t } = useI18n();

  return (
    <section className="flex flex-col items-center justify-center px-4 py-16">
      <div
        className="animate-fade-in-up flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: '#ede9fe' }}
      >
        <Icon className="h-8 w-8 text-[#7c3aed]" />
      </div>

      <h1
        className="animate-fade-in-up mt-6 text-center font-serif text-3xl font-bold text-foreground"
        style={{ animationDelay: '50ms' }}
      >
        {t(`navigation:${moduleKey}`)}
      </h1>

      <p
        className="animate-fade-in-up mt-3 max-w-md text-center text-muted-foreground"
        style={{ animationDelay: '100ms' }}
      >
        {t(descriptionKey)}
      </p>

      <p
        className="animate-fade-in-up mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60"
        style={{ animationDelay: '100ms' }}
      >
        {t('modules.comingSoon')}
      </p>

      <div
        className="animate-fade-in-up mt-8 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
        style={{ animationDelay: '150ms' }}
      >
        <h2 className="mb-3 font-serif text-sm font-semibold text-foreground">
          {t('modules.plannedFeatures')}
        </h2>
        <ul className="space-y-2.5">
          {features.map((featureKey) => (
            <li
              key={featureKey}
              className="flex items-center gap-2.5 text-sm text-muted-foreground"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10b981]" />
              {t(featureKey)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
