'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MemoryCard, type Memory, type MemoryCategory } from '@/components/ai/memory-card';
import {
  Search,
  Brain,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  X,
  Lightbulb,
} from 'lucide-react';

/* ── Mock data ── */
const initialMemories: Memory[] = [
  {
    id: '1',
    content: 'Prefers overdue invoices sorted by amount descending, not by date',
    category: 'PREFERENCE',
    source: 'Explicit',
    date: '3 Feb 2026',
    lastUsed: '2 days ago',
    conversationCount: 8,
  },
  {
    id: '2',
    content: 'Always apply Net 30 payment terms for new customers unless told otherwise',
    category: 'INSTRUCTION',
    source: 'Explicit',
    date: '15 Jan 2026',
    lastUsed: '5 days ago',
    conversationCount: 12,
  },
  {
    id: '3',
    content: 'Prefers weekly cash flow summaries sent on Monday mornings',
    category: 'PREFERENCE',
    source: 'Learned',
    date: '20 Jan 2026',
    lastUsed: '1 week ago',
    conversationCount: 4,
  },
  {
    id: '4',
    content: 'Default VAT rate for services is 20% unless the customer is VAT exempt',
    category: 'PREFERENCE',
    source: 'Explicit',
    date: '28 Jan 2026',
    lastUsed: '3 days ago',
    conversationCount: 6,
  },
  {
    id: '5',
    content:
      'Usually reviews AR aging report on Fridays and chases overdue invoices >30 days first',
    category: 'WORKFLOW',
    source: 'Learned',
    date: '28 Jan 2026',
    lastUsed: 'today',
    conversationCount: 15,
  },
  {
    id: '6',
    content: 'Processes AP invoices in batch on Tuesdays and Thursdays',
    category: 'WORKFLOW',
    source: 'Learned',
    date: '5 Feb 2026',
    lastUsed: 'yesterday',
    conversationCount: 9,
  },
  {
    id: '7',
    content:
      'VAT rate for consulting services is 20%, not 0% \u2014 corrected from AI suggestion on 10 Feb 2026',
    category: 'CORRECTION',
    source: 'Learned',
    date: '10 Feb 2026',
    lastUsed: '1 week ago',
    conversationCount: 3,
  },
  {
    id: '8',
    content: 'Approved 5% discount threshold for orders over \u00A310,000 from repeat customers',
    category: 'DECISION',
    source: 'Explicit',
    date: '22 Jan 2026',
    lastUsed: '3 days ago',
    conversationCount: 7,
  },
];

const allCategories: MemoryCategory[] = [
  'PREFERENCE',
  'INSTRUCTION',
  'WORKFLOW',
  'CORRECTION',
  'DECISION',
];

/* ── Page Component ── */
export default function AIMemoryPage() {
  const [memories, setMemories] = useState(initialMemories);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory[]>([]);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [enabledCategories, setEnabledCategories] = useState<MemoryCategory[]>([...allCategories]);
  const [retention, setRetention] = useState('90');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Dialogs
  const [editDialog, setEditDialog] = useState<Memory | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<Memory | null>(null);
  const [forgetDialog, setForgetDialog] = useState(false);
  const [forgetConfirmText, setForgetConfirmText] = useState('');

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let result = memories;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((m) => m.content.toLowerCase().includes(s));
    }
    if (categoryFilter.length > 0) {
      result = result.filter((m) => categoryFilter.includes(m.category));
    }
    return result;
  }, [memories, search, categoryFilter]);

  /* Group by category */
  const grouped = useMemo(() => {
    const map = new Map<MemoryCategory, Memory[]>();
    for (const m of filtered) {
      const list = map.get(m.category) || [];
      list.push(m);
      map.set(m.category, list);
    }
    return map;
  }, [filtered]);

  /* ── Handlers ── */
  const toggleCategoryFilter = useCallback((cat: MemoryCategory) => {
    setCategoryFilter((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  const toggleSection = useCallback((cat: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const toggleEnabledCategory = useCallback((cat: MemoryCategory) => {
    setEnabledCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  const handleEdit = useCallback((m: Memory) => {
    setEditText(m.content);
    setEditDialog(m);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editDialog) return;
    setMemories((prev) =>
      prev.map((m) => (m.id === editDialog.id ? { ...m, content: editText } : m)),
    );
    setEditDialog(null);
  }, [editDialog, editText]);

  const handleDelete = useCallback(() => {
    if (!deleteDialog) return;
    setMemories((prev) => prev.filter((m) => m.id !== deleteDialog.id));
    setDeleteDialog(null);
  }, [deleteDialog]);

  const handleForgetAll = useCallback(() => {
    if (forgetConfirmText === 'FORGET') {
      setMemories([]);
      setForgetDialog(false);
      setForgetConfirmText('');
    }
  }, [forgetConfirmText]);

  /* ── Empty state ── */
  if (memories.length === 0 && !search && categoryFilter.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Brain className="h-3.5 w-3.5 text-[#7c3aed]" />
          <span>AI &gt; My Memory</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-8 py-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ede9fe]">
            <Lightbulb className="h-8 w-8 text-[#7c3aed]" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-foreground">No memories yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            The AI will learn your preferences as you work. Start a conversation and it will
            remember your instructions and patterns.
          </p>
          <Button className="mt-6 rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            Start a conversation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Brain className="h-3.5 w-3.5 text-[#7c3aed]" />
        <span>AI &gt; My Memory</span>
      </div>

      {/* Settings Panel */}
      <div className="animate-fade-in-up rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <h2 className="font-serif text-lg font-semibold text-foreground">Memory Settings</h2>

        {/* Enable toggle */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-foreground">Enable AI Memory</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The AI remembers your preferences, instructions, and workflow patterns.
            </p>
          </div>
          <Switch
            checked={memoryEnabled}
            onCheckedChange={setMemoryEnabled}
            className="data-[state=checked]:bg-[#7c3aed]"
          />
        </div>

        {/* Category checkboxes */}
        <div className="mt-5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </Label>
          <div className="mt-2 flex flex-wrap gap-3">
            {allCategories.map((cat) => (
              <label key={cat} className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={enabledCategories.includes(cat)}
                  onCheckedChange={() => toggleEnabledCategory(cat)}
                  className="border-border data-[state=checked]:border-[#7c3aed] data-[state=checked]:bg-[#7c3aed]"
                />
                {cat.charAt(0) + cat.slice(1).toLowerCase() + 's'}
              </label>
            ))}
          </div>
        </div>

        {/* Retention */}
        <div className="mt-5 flex items-center gap-3">
          <Label className="shrink-0 text-sm text-foreground">Auto-delete after</Label>
          <Select value={retention} onValueChange={setRetention}>
            <SelectTrigger className="w-32 rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="180">180 days</SelectItem>
              <SelectItem value="never">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Forget Everything */}
        <div className="mt-6 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-[#991b1b]" />
            <div>
              <p className="text-sm font-medium text-[#991b1b]">Forget Everything</p>
              <p className="mt-0.5 text-xs text-[#991b1b]/70">
                Permanently delete all AI memories. This cannot be undone.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setForgetDialog(true)}
                className="mt-3 rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c]"
              >
                Forget Everything
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border-border pl-9 focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategoryFilter(cat)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter.includes(cat)
                  ? 'bg-[#7c3aed] text-white'
                  : 'bg-secondary text-muted-foreground hover:bg-[#f5f3ff] hover:text-[#7c3aed]'
              }`}
            >
              {cat.charAt(0) + cat.slice(1).toLowerCase()}
            </button>
          ))}
          {categoryFilter.length > 0 && (
            <button
              onClick={() => setCategoryFilter([])}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Empty search state */}
      {filtered.length === 0 && (search || categoryFilter.length > 0) && (
        <div className="rounded-xl border border-border bg-card px-8 py-12 text-center">
          <p className="text-sm text-muted-foreground">No memories match your search.</p>
          <button
            onClick={() => {
              setSearch('');
              setCategoryFilter([]);
            }}
            className="mt-2 text-sm font-medium text-[#7c3aed] hover:text-[#5b21b6]"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Grouped memory cards */}
      {Array.from(grouped.entries()).map(([category, items]) => {
        const collapsed = collapsedSections.has(category);
        return (
          <section key={category}>
            <button
              onClick={() => toggleSection(category)}
              className="mb-3 flex w-full items-center gap-2 text-left"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {category + 's'}
              </span>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-medium text-muted-foreground">
                {items.length}
              </span>
            </button>
            {!collapsed && (
              <div className="space-y-3">
                {items.map((m, i) => (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    onEdit={handleEdit}
                    onDelete={setDeleteDialog}
                    delay={i * 60}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="animate-step-in sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Memory</DialogTitle>
            <DialogDescription>
              Update what the AI remembers about your preference.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[120px] w-full resize-y rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#7c3aed]/30"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              className="rounded-lg bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent className="animate-step-in sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Delete this memory?</DialogTitle>
            <DialogDescription>
              This memory helps the AI understand your preferences. Are you sure you want to remove
              it?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c]"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Forget All Dialog ── */}
      <Dialog
        open={forgetDialog}
        onOpenChange={(open) => {
          if (!open) {
            setForgetDialog(false);
            setForgetConfirmText('');
          }
        }}
      >
        <DialogContent className="animate-step-in sm:max-w-sm">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#fee2e2]">
              <AlertTriangle className="h-5 w-5 text-[#dc2626]" />
            </div>
            <DialogTitle className="font-serif text-[#dc2626]">Forget Everything</DialogTitle>
            <DialogDescription>
              This will permanently delete all AI memories. The AI will lose all learned
              preferences, instructions, and patterns. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-sm text-foreground">
              Type <strong>FORGET</strong> to confirm
            </Label>
            <Input
              className="mt-2 rounded-lg border-[#fecaca] font-mono focus-visible:ring-2 focus-visible:ring-[#dc2626]/30"
              value={forgetConfirmText}
              onChange={(e) => setForgetConfirmText(e.target.value)}
              placeholder="FORGET"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setForgetDialog(false);
                setForgetConfirmText('');
              }}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={forgetConfirmText !== 'FORGET'}
              onClick={handleForgetAll}
              className="rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c] disabled:opacity-40"
            >
              Forget Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
