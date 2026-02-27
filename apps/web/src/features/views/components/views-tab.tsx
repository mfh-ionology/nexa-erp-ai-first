import { useState } from 'react';
import { ChevronDown, Loader2, Plus } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import type { SavedViewDto, ViewScope } from '../types';
import type { useViewMutations } from '../hooks/use-view-mutations';
import type { ViewState } from '../hooks/use-view-state';
import { ViewItem } from './view-item';
import { SaveViewForm } from './save-view-form';

interface ViewsTabProps {
  viewKey: string;
  viewState: ViewState;
  mutations: ReturnType<typeof useViewMutations>;
  onClose: () => void;
}

interface ScopeSection {
  scope: ViewScope;
  labelKey: string;
  defaultOpen: boolean;
}

const SCOPE_SECTIONS: ScopeSection[] = [
  { scope: 'PERSONAL', labelKey: 'views.scope.personal', defaultOpen: true },
  { scope: 'ROLE', labelKey: 'views.scope.role', defaultOpen: false },
  { scope: 'GLOBAL', labelKey: 'views.scope.global', defaultOpen: false },
];

export function ViewsTab({ viewKey, viewState, mutations, onClose }: ViewsTabProps) {
  const { t } = useI18n();
  const userId = useAuthStore((s) => s.user?.id);
  const isAdmin = useAuthStore((s) => s.permissions?.isSuperAdmin) ?? false;
  const [showSaveForm, setShowSaveForm] = useState(false);

  const savedViews = viewState.savedViews ?? [];

  // Group views by scope
  const viewsByScope: Record<ViewScope, SavedViewDto[]> = {
    PERSONAL: savedViews.filter((v) => v.scope === 'PERSONAL'),
    ROLE: savedViews.filter((v) => v.scope === 'ROLE'),
    GLOBAL: savedViews.filter((v) => v.scope === 'GLOBAL'),
  };

  function handleViewSelect(viewId: string) {
    viewState.setActiveView(viewId);
    onClose();
  }

  function handleSaveSuccess() {
    setShowSaveForm(false);
    toast({ title: t('views.toast.saved') });
  }

  function handleSaveCurrent() {
    if (!viewState.activeViewId) return;

    const columnConfig = viewState.columnState.map((col) => ({
      fieldId: col.fieldId,
      visible: col.visible,
      order: col.order,
      width: col.width,
      pinned: col.pinned,
    }));

    mutations.replaceView.mutate(
      {
        id: viewState.activeViewId,
        data: { columnConfig },
      },
      {
        onSuccess: () => {
          viewState.markClean();
          toast({ title: t('views.toast.saved') });
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Save Current View — only when dirty and an active view is loaded */}
      {viewState.activeViewId && viewState.isDirty && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center"
          onClick={handleSaveCurrent}
          disabled={mutations.replaceView.isPending}
        >
          {mutations.replaceView.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {t('views.actions.saveCurrent')}
        </Button>
      )}

      {/* Scope sections */}
      <ScrollArea className="max-h-[320px]">
        <div className="space-y-2">
          {SCOPE_SECTIONS.map(({ scope, labelKey, defaultOpen }) => {
            const views = viewsByScope[scope];
            const hasViews = views.length > 0;
            // Expand by default if defaultOpen or section has views
            const isOpen = defaultOpen || hasViews;

            return (
              <Collapsible key={scope} defaultOpen={isOpen}>
                <CollapsibleTrigger
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider',
                    'hover:bg-accent/50 transition-colors',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {t(labelKey)}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                      {views.length}
                    </Badge>
                  </span>
                  <ChevronDown className="size-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {hasViews ? (
                    <div className="space-y-0.5 pt-1">
                      {views.map((view) => (
                        <ViewItem
                          key={view.id}
                          view={view}
                          isActive={view.id === viewState.activeViewId}
                          isOwner={view.createdBy === userId}
                          isAdmin={isAdmin}
                          mutations={mutations}
                          viewState={viewState}
                          onSelect={handleViewSelect}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground italic">
                      {t('views.empty')}
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>

      {/* Save as New View */}
      {showSaveForm ? (
        <SaveViewForm
          viewKey={viewKey}
          viewState={viewState}
          mutations={mutations}
          onSuccess={handleSaveSuccess}
          onCancel={() => {
            setShowSaveForm(false);
          }}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center gap-1.5"
          onClick={() => {
            setShowSaveForm(true);
          }}
        >
          <Plus className="size-3.5" />
          {t('views.actions.saveNew')}
        </Button>
      )}
    </div>
  );
}
