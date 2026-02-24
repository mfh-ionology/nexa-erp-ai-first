import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/erp/status-badge';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { usePermission } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

import { useI18n } from '@nexa/i18n';

import { LineItemsTable } from './line-items-table';
import { PageHeader } from './page-header';
import { TotalsSection } from './totals-section';
import type { HeaderLinesPageProps } from './types';

/**
 * T3: Header + Lines Page template.
 *
 * Provides a standardised document view for header+lines entities such as
 * invoices, sales orders, purchase orders, and journal entries.
 *
 * Layout: PageHeader → Action Bar → Header Tabs → Line Items → Totals → EventFlowTracker
 */
export function HeaderLinesPage<TLine>({
  // BaseTemplateProps
  title,
  subtitle,
  breadcrumbs,
  isLoading = false,
  children,
  // HeaderLinesPage-specific props
  entityType,
  resourceCode,
  status,
  headerTabs,
  activeHeaderTab,
  onHeaderTabChange,
  lineColumns,
  lines,
  onAddLine,
  onRemoveLine,
  onLineChange,
  isEditable = true,
  totals,
  actionBarSlot,
  eventFlowSlot,
  getLineId,
}: HeaderLinesPageProps<TLine>) {
  const { t } = useI18n();
  const breakpoint = useBreakpoint();

  // --- Permission gating via resourceCode ---
  // Callers should pass the same resourceCode to their ActionBar in actionBarSlot.
  // The template uses canAccess to conditionally hide the action bar as defense-in-depth.
  const resourcePerms = usePermission(resourceCode ?? '');
  const showActionBar = !resourceCode || resourcePerms.canAccess;
  const effectiveIsEditable = isEditable && (!resourceCode || resourcePerms.canEdit);

  // Default to first header tab if no active tab specified
  const currentHeaderTab = activeHeaderTab ?? headerTabs[0]?.key ?? '';

  // Track which accordion panels are open on phone
  const [openAccordions, setOpenAccordions] = useState<
    Record<string, boolean>
  >(() => ({ [currentHeaderTab]: true }));

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
    onHeaderTabChange?.(key);
  };

  // --- Status badge for header ---
  const statusBadge = status ? (
    <StatusBadge status={status} entityType={entityType} />
  ) : undefined;

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <main
        className="flex flex-col gap-6"
        aria-label={title}
        aria-busy="true"
      >
        <PageHeader
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          isLoading
        />
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-64 ml-auto" />
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

      {/* === HEADER SECTION === */}
      {headerTabs.length > 0 && (
        <section aria-label={title}>
          {breakpoint === 'phone' ? (
            // Phone: Accordion layout for header tabs
            <div className="space-y-2" role="tablist" aria-label={title}>
              {headerTabs.map((tab) => (
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
                      aria-controls={`header-tab-panel-${tab.key}`}
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
                      id={`header-tab-panel-${tab.key}`}
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
              value={currentHeaderTab}
              onValueChange={(value) => onHeaderTabChange?.(value)}
            >
              <TabsList variant="line">
                {headerTabs.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    {t(tab.labelKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {headerTabs.map((tab) => (
                <TabsContent key={tab.key} value={tab.key}>
                  {tab.content}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </section>
      )}

      <Separator />

      {/* === LINE ITEMS SECTION === */}
      <section aria-label={t('lineItems')}>
        <LineItemsTable
          columns={lineColumns}
          lines={lines}
          onAddLine={effectiveIsEditable ? onAddLine : undefined}
          onRemoveLine={effectiveIsEditable ? onRemoveLine : undefined}
          onLineChange={effectiveIsEditable ? onLineChange : undefined}
          isEditable={effectiveIsEditable}
          getLineId={getLineId}
        />
      </section>

      {/* === TOTALS SECTION === */}
      {totals && (
        <>
          <Separator />
          <TotalsSection totals={totals} />
        </>
      )}

      {/* Children slot for additional content */}
      {children}

      {/* Event flow tracker slot */}
      {eventFlowSlot && (
        <>
          <Separator />
          {eventFlowSlot}
        </>
      )}
    </main>
  );
}
