'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SettingsViewsTab } from '@/components/invoices/settings-views-tab';
import { SettingsColumnsTab } from '@/components/invoices/settings-columns-tab';
import { SettingsFiltersTab } from '@/components/invoices/settings-filters-tab';
import { SettingsSortTab } from '@/components/invoices/settings-sort-tab';

const tabs = [
  { id: 'views', label: 'Views' },
  { id: 'columns', label: 'Columns' },
  { id: 'filters', label: 'Filters' },
  { id: 'sort', label: 'Sort' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function TableSettingsSlideOut({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('views');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] p-0 sm:max-w-[340px] flex flex-col">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Settings2 className="h-4 w-4 text-[#7c3aed]" />
            Table Settings
          </SheetTitle>
        </SheetHeader>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 border-b border-border px-4 py-2.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#7c3aed] text-white shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeTab === 'views' && <SettingsViewsTab />}
          {activeTab === 'columns' && <SettingsColumnsTab />}
          {activeTab === 'filters' && <SettingsFiltersTab />}
          {activeTab === 'sort' && <SettingsSortTab />}
        </div>

        <SheetFooter className="border-t border-border px-4 py-3 flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            className="flex-1 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            onClick={() => onOpenChange(false)}
          >
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
