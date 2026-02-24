import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/erp/status-badge';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { usePermission } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import { PageHeader } from './page-header';
import { RelatedEntities } from './related-entities';
import type { RecordDetailPageProps } from './types';

/**
 * T2: Record Detail Page template.
 *
 * Provides a standardised detail view with status badge, tabbed content,
 * related entities section, and slots for action bar and event flow tracker.
 */
export function RecordDetailPage({
  // BaseTemplateProps
  title,
  subtitle,
  breadcrumbs,
  isLoading = false,
  children,
  // RecordDetailPage-specific props
  entityType,
  resourceCode,
  status,
  tabs,
  activeTab,
  onTabChange,
  actionBarSlot,
  relatedEntities = [],
  eventFlowSlot,
}: RecordDetailPageProps) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();

  // --- Permission gating via resourceCode ---
  // Callers should pass the same resourceCode to their ActionBar in actionBarSlot.
  // The template uses canAccess to conditionally hide the action bar as defense-in-depth.
  const resourcePerms = usePermission(resourceCode ?? '');
  const showActionBar = !resourceCode || resourcePerms.canAccess;

  // Default to first tab if no active tab specified
  const currentTab = activeTab ?? tabs[0]?.key ?? '';

  // Track which accordion panels are open on phone
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(
    () => ({ [currentTab]: true }),
  );

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
    onTabChange?.(key);
  };

  // --- Status badge for header ---
  const statusBadge = status ? (
    <StatusBadge status={status} entityType={entityType} />
  ) : undefined;

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <main className="flex flex-col gap-6" aria-label={title} aria-busy="true">
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          isLoading
        />
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6" aria-label={title}>
      {/* Page header with breadcrumbs, title + status badge */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        statusBadge={statusBadge}
        isLoading={isLoading}
      />

      {/* Action bar slot — rendered below header (hidden if canAccess=false for resourceCode) */}
      {actionBarSlot && showActionBar && (
        <div className="flex items-center gap-2">{actionBarSlot}</div>
      )}

      {/* Tab content area — tabs on desktop/tablet, accordion on phone */}
      {tabs.length > 0 && (
        breakpoint === 'phone' ? (
          // Phone: Accordion layout
          <div className="space-y-2" role="tablist" aria-label={title}>
            {tabs.map((tab) => (
              <Collapsible
                key={tab.key}
                open={openAccordions[tab.key] ?? false}
                onOpenChange={() => toggleAccordion(tab.key)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full justify-between text-left font-medium',
                      openAccordions[tab.key] && 'bg-muted/50',
                    )}
                    role="tab"
                    aria-selected={openAccordions[tab.key] ?? false}
                    aria-controls={`tab-panel-${tab.key}`}
                  >
                    <span>{t(tab.labelKey)}</span>
                    <ChevronDown
                      className={cn(
                        'size-4 transition-transform duration-200',
                        openAccordions[tab.key] && 'rotate-180',
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div
                    id={`tab-panel-${tab.key}`}
                    role="tabpanel"
                    className="px-1 pt-3 pb-4"
                  >
                    {tab.content}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        ) : (
          // Desktop/Tablet: Standard tabs
          <Tabs
            value={currentTab}
            onValueChange={(value) => onTabChange?.(value)}
          >
            <TabsList variant="line">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {t(tab.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent key={tab.key} value={tab.key}>
                {tab.content}
              </TabsContent>
            ))}
          </Tabs>
        )
      )}

      {/* Children slot for additional content */}
      {children}

      {/* Related entities */}
      {relatedEntities.length > 0 && (
        <RelatedEntities entities={relatedEntities} />
      )}

      {/* Event flow tracker slot */}
      {eventFlowSlot}
    </main>
  );
}
