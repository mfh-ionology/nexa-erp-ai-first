'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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

export function TableSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('views');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] gap-0 p-0 rounded-xl overflow-hidden">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Settings2 className="h-4 w-4 text-[#7c3aed]" />
            Table Settings
          </DialogTitle>
        </DialogHeader>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 border-b border-border px-5 py-2.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
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
        <div className="min-h-[360px] max-h-[440px] overflow-y-auto px-5 py-4">
          {activeTab === 'views' && <SettingsViewsTab />}
          {activeTab === 'columns' && <SettingsColumnsTab />}
          {activeTab === 'filters' && <SettingsFiltersTab />}
          {activeTab === 'sort' && <SettingsSortTab />}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <Button variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            onClick={() => onOpenChange(false)}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
