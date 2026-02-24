import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import type { RelatedEntityConfig } from './types';

export interface RelatedEntitiesProps {
  /** Related entity configurations */
  entities: RelatedEntityConfig[];
}

/**
 * Renders a section of related entity links with counts.
 * Collapsible on mobile, inline list on desktop/tablet.
 */
export function RelatedEntities({ entities }: RelatedEntitiesProps) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();
  const [isOpen, setIsOpen] = useState(false);

  if (entities.length === 0) return null;

  const content = (
    <div
      className={cn(
        'flex gap-3',
        breakpoint === 'phone' ? 'flex-col' : 'flex-row flex-wrap items-center',
      )}
      role="list"
      aria-label={t('relatedEntities')}
    >
      {entities.map((entity, index) => (
        <div key={entity.key} className="flex items-center gap-3" role="listitem">
          {index > 0 && breakpoint !== 'phone' && (
            <Separator orientation="vertical" className="h-4" />
          )}
          {entity.path ? (
            <Link
              to={entity.path}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            >
              <span>{t(entity.labelKey)}</span>
              <span className="text-muted-foreground">({entity.count})</span>
              <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>{t(entity.labelKey)}</span>
              <span>({entity.count})</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );

  // On phone: render as collapsible section
  if (breakpoint === 'phone') {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t('relatedEntities')}
          </h3>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={t('relatedEntities')}>
              <ChevronDown
                className={cn(
                  'size-4 transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="pt-2">{content}</CollapsibleContent>
      </Collapsible>
    );
  }

  // On desktop/tablet: inline section
  return (
    <section aria-label={t('relatedEntities')}>
      <Separator className="my-4" />
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t('relatedEntities')}
        </h3>
        {content}
      </div>
    </section>
  );
}
