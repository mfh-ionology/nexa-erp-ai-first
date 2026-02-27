import { useMemo, useState } from 'react';
import { Check, ChevronDown, Star, X } from 'lucide-react';
import { useI18n } from '@nexa/i18n';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { SavedViewDto, ViewScope } from '../types';
import type { ViewState } from '../hooks/use-view-state';

interface SavedViewSelectorProps {
  viewState: ViewState;
}

const SCOPE_ORDER: ViewScope[] = ['PERSONAL', 'ROLE', 'GLOBAL'];

const SCOPE_LABEL_KEYS: Record<ViewScope, string> = {
  PERSONAL: 'views.scope.personal',
  ROLE: 'views.scope.role',
  GLOBAL: 'views.scope.global',
};

export function SavedViewSelector({ viewState }: SavedViewSelectorProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const { savedViews, activeViewId, setActiveView } = viewState;

  // Group views by scope
  const grouped = useMemo(() => {
    const map = new Map<ViewScope, SavedViewDto[]>();
    for (const scope of SCOPE_ORDER) {
      map.set(scope, []);
    }
    if (savedViews) {
      for (const view of savedViews) {
        map.get(view.scope)?.push(view);
      }
    }
    return map;
  }, [savedViews]);

  // Find active view name for trigger label
  const activeView = useMemo(() => {
    if (!activeViewId || !savedViews) return null;
    return savedViews.find((v) => v.id === activeViewId) ?? null;
  }, [activeViewId, savedViews]);

  const triggerLabel = activeView?.name ?? t('views.selector.defaultView');

  const hasViews = savedViews && savedViews.length > 0;

  function handleSelect(viewId: string | null) {
    setActiveView(viewId);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="max-w-[200px] justify-between gap-1.5"
          aria-label={triggerLabel}
        >
          <span className="truncate text-sm">{triggerLabel}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[260px] p-0">
        <Command>
          <CommandInput placeholder={t('views.columns.searchColumns')} />
          <CommandList>
            <CommandEmpty>{t('views.empty')}</CommandEmpty>

            {/* Clear view option */}
            {activeViewId && (
              <>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      handleSelect(null);
                    }}
                    className="gap-2 text-muted-foreground"
                  >
                    <X className="size-3.5" />
                    {t('views.selector.clearView')}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Grouped views by scope */}
            {hasViews &&
              SCOPE_ORDER.map((scope) => {
                const views = grouped.get(scope);
                if (!views || views.length === 0) return null;

                return (
                  <CommandGroup
                    key={scope}
                    // eslint-disable-next-line i18next/no-literal-string
                    heading={`${t(SCOPE_LABEL_KEYS[scope])} (${String(views.length)})`}
                  >
                    {views.map((view) => {
                      const isActive = view.id === activeViewId;

                      return (
                        <CommandItem
                          key={view.id}
                          value={view.name}
                          onSelect={() => {
                            handleSelect(view.id);
                          }}
                          className={cn('gap-2 rounded-lg', isActive && 'bg-[#f5f3ff]')}
                        >
                          {isActive ? (
                            <Check className="size-3.5 shrink-0 text-primary" />
                          ) : (
                            <span className="size-3.5 shrink-0" />
                          )}
                          <span className="flex-1 truncate">{view.name}</span>
                          <span className="flex shrink-0 items-center gap-1">
                            {view.isFavourite && (
                              <Star className="size-3 fill-amber-400 text-amber-400" />
                            )}
                            {view.isDefault && (
                              <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                                {t('views.badge.default')}
                              </Badge>
                            )}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
