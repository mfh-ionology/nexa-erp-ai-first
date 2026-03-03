'use client';

import { cn } from '@/lib/utils';
import { User, Building2, FileText, Package, ClipboardList } from 'lucide-react';

export type EntityType = 'contact' | 'customer' | 'invoice' | 'product' | 'purchase-order';

const entityIcons: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  contact: User,
  customer: Building2,
  invoice: FileText,
  product: Package,
  'purchase-order': ClipboardList,
};

const entityLabels: Record<EntityType, string> = {
  contact: 'Contact',
  customer: 'Customer',
  invoice: 'Invoice',
  product: 'Product',
  'purchase-order': 'PO',
};

export interface EntityMention {
  id: string;
  type: EntityType;
  name: string;
  subtitle?: string;
}

export function EntityChip({
  entity,
  onRemove,
  className,
}: {
  entity: EntityMention;
  onRemove?: () => void;
  className?: string;
}) {
  const Icon = entityIcons[entity.type];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-[#ede9fe] px-2 py-0.5 text-xs font-medium text-[#6d28d9] align-middle',
        onRemove && 'pr-1',
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{entity.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#6d28d9] transition-colors hover:bg-[#6d28d9]/20"
          aria-label={`Remove ${entity.name}`}
        >
          &times;
        </button>
      )}
    </span>
  );
}

export { entityIcons, entityLabels };
