'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2, ExternalLink, Lock, Plus, ClipboardList, Package, CreditCard } from 'lucide-react';

interface RecordLink {
  id: string;
  group: string;
  entityIcon: typeof ClipboardList;
  entityType: string;
  entityCode: string;
  value: string;
  systemCreated: boolean;
}

const initialLinks: RecordLink[] = [
  {
    id: '1',
    group: 'Created From',
    entityIcon: ClipboardList,
    entityType: 'Sales Quote',
    entityCode: 'SQ-00012',
    value: '\u00a38,500',
    systemCreated: true,
  },
  {
    id: '2',
    group: 'Fulfils',
    entityIcon: Package,
    entityType: 'Delivery Note',
    entityCode: 'DN-00003',
    value: 'Delivered',
    systemCreated: true,
  },
  {
    id: '3',
    group: 'Payment',
    entityIcon: CreditCard,
    entityType: 'Payment',
    entityCode: 'PAY-00091',
    value: '\u00a34,250',
    systemCreated: true,
  },
  {
    id: '4',
    group: 'Payment',
    entityIcon: CreditCard,
    entityType: 'Payment',
    entityCode: 'PAY-00098',
    value: '\u00a34,250',
    systemCreated: true,
  },
];

const groupOrder = [
  'Created From',
  'Fulfils',
  'Payment For',
  'Payment',
  'Credit For',
  'Related',
  'Parent',
  'Child',
];

export function RecordLinksPanel() {
  const [links, setLinks] = useState(initialLinks);
  const [dialogOpen, setDialogOpen] = useState(false);

  const grouped = groupOrder.reduce<Record<string, RecordLink[]>>((acc, group) => {
    const items = links.filter((l) => l.group === group);
    if (items.length > 0) acc[group] = items;
    return acc;
  }, {});

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground"
        >
          <Link2 className="h-4 w-4" />
          <span className="sr-only">Record Links</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] p-0 sm:max-w-[400px]">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-sm font-semibold">Record Links ({links.length})</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {/* Add link button */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-fit gap-1.5 border-border text-foreground hover:bg-[#f5f3ff]"
              >
                <Plus className="h-3.5 w-3.5" /> Link Record
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Link a Record</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 pt-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Entity Type
                  </label>
                  <Select defaultValue="invoice">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="quote">Sales Quote</SelectItem>
                      <SelectItem value="order">Sales Order</SelectItem>
                      <SelectItem value="delivery">Delivery Note</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="credit">Credit Note</SelectItem>
                      <SelectItem value="po">Purchase Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Search
                  </label>
                  <Input placeholder="Search by code or name..." />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Link Type
                  </label>
                  <Select defaultValue="relates_to">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relates_to">Relates To</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => setDialogOpen(false)}
                    className="text-muted-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setDialogOpen(false)}
                    className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
                  >
                    Link Record
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Grouped links */}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              <div className="flex flex-col gap-1">
                {items.map((link) => {
                  const Icon = link.entityIcon;
                  return (
                    <div
                      key={link.id}
                      className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-[#f5f3ff]/50"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[#7c3aed]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {link.entityType}{' '}
                          <span className="font-mono text-xs text-[#7c3aed]">
                            {link.entityCode}
                          </span>
                        </p>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-muted-foreground">
                        {link.value}
                      </span>
                      {link.systemCreated && (
                        <Lock className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                      )}
                      <button
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-[#7c3aed] group-hover:opacity-100"
                        aria-label="Open record"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
