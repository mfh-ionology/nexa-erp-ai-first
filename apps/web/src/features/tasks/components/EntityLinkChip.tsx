/**
 * EntityLinkChip — read-only chip showing entity type + entity code.
 *
 * Used in the CreateTaskDialog when a linked record is pre-filled from
 * a panel context (e.g. "Invoice INV-2026-0042").
 *
 * Displays a purple-bordered pill that is non-interactive when pre-filled.
 */

import { FileText, ShoppingCart, Package, Users, Receipt, Landmark } from 'lucide-react';

import { getEntityDisplayName } from '../utils/entity-routes';

// Simple icon mapping for common entity types
const ENTITY_ICONS: Record<string, typeof FileText> = {
  CustomerInvoice: FileText,
  SalesOrder: ShoppingCart,
  PurchaseOrder: ShoppingCart,
  InventoryItem: Package,
  Customer: Users,
  Employee: Users,
  SupplierBill: Receipt,
  JournalEntry: Landmark,
};

interface EntityLinkChipProps {
  entityType: string;
  entityId: string;
  label?: string;
}

export function EntityLinkChip({ entityType, entityId, label }: EntityLinkChipProps) {
  const Icon = ENTITY_ICONS[entityType] ?? FileText;
  const displayName = getEntityDisplayName(entityType);
  const displayLabel = label ?? `${displayName} ${entityId}`;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7c3aed]/30 bg-[#f5f3ff] px-3 py-1.5 text-sm text-foreground">
      <Icon className="h-3.5 w-3.5 text-[#7c3aed]" />
      <span>{displayLabel}</span>
    </span>
  );
}
