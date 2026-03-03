'use client';

import { Star, Pencil, X, Lock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SavedView {
  id: string;
  name: string;
  starred: boolean;
  isDefault?: boolean;
  scope: 'starred' | 'personal' | 'team' | 'global';
  icon?: 'lock' | 'globe';
}

const views: SavedView[] = [
  { id: 'v1', name: 'High Value Invoices', starred: true, isDefault: true, scope: 'starred' },
  { id: 'v2', name: 'Overdue Items', starred: true, scope: 'starred' },
  { id: 'v3', name: 'My Draft Invoices', starred: false, scope: 'personal' },
  { id: 'v4', name: 'This Quarter Summary', starred: false, scope: 'personal' },
  { id: 'v5', name: 'AP Team View', starred: false, scope: 'team', icon: 'lock' },
  { id: 'v6', name: 'All Active Invoices', starred: false, scope: 'global', icon: 'globe' },
];

function ViewItem({ view }: { view: SavedView }) {
  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#f5f3ff] cursor-pointer">
      <span className="shrink-0">
        {view.starred ? (
          <Star className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
        ) : view.icon === 'lock' ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : view.icon === 'globe' ? (
          <Globe className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Star className="h-4 w-4 text-muted-foreground/40" />
        )}
      </span>
      <span className="flex-1 text-sm font-medium text-foreground">{view.name}</span>
      {view.isDefault && (
        <span className="shrink-0 rounded-full bg-[#ede9fe] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#7c3aed]">
          default
        </span>
      )}
      {view.scope === 'personal' && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-[#ede9fe] hover:text-[#7c3aed]"
            aria-label="Edit view"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fee2e2] hover:text-[#ef4444]"
            aria-label="Delete view"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function ViewSection({ title, items }: { title: string; items: SavedView[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <h4 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <div className="flex flex-col">
        {items.map((view) => (
          <ViewItem key={view.id} view={view} />
        ))}
      </div>
    </div>
  );
}

export function SettingsViewsTab() {
  const starred = views.filter((v) => v.scope === 'starred');
  const personal = views.filter((v) => v.scope === 'personal');
  const team = views.filter((v) => v.scope === 'team');
  const global = views.filter((v) => v.scope === 'global');

  return (
    <div className="flex flex-col">
      <div className="flex-1 overflow-y-auto px-1 py-2">
        <ViewSection title="Starred Views" items={starred} />
        <ViewSection title="My Views" items={personal} />
        <ViewSection title="Team Views" items={team} />
        <ViewSection title="Global Views" items={global} />
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3 pt-4">
        <Button
          variant="outline"
          className="flex-1 rounded-lg border-[#c4b5fd] text-[#7c3aed] hover:bg-[#f5f3ff] hover:text-[#5b21b6] text-sm"
        >
          Save Current View
        </Button>
        <Button className="flex-1 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6] text-sm">
          Create New View
        </Button>
      </div>
    </div>
  );
}
