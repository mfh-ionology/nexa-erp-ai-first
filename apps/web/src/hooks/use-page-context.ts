import { useEffect, useMemo } from 'react';
import { useRouterState } from '@tanstack/react-router';

import { useCopilotStore } from '@/stores/copilot-store';
import type { CopilotPageContext } from '@/stores/copilot-store';

// ── Route segment → entity type mapping ──────────────────────────────────────
// Maps the second-level route segment (e.g., "invoices") under a module to an
// entity type name used by the AI context and quick prompts.

const ROUTE_SEGMENT_TO_ENTITY: Record<string, Record<string, string>> = {
  ar: {
    invoices: 'customerInvoice',
    'credit-notes': 'creditNote',
    receipts: 'receipt',
    customers: 'customer',
  },
  ap: {
    invoices: 'supplierInvoice',
    'debit-notes': 'debitNote',
    payments: 'payment',
    suppliers: 'supplier',
  },
  sales: {
    orders: 'salesOrder',
    quotes: 'quote',
    'delivery-notes': 'deliveryNote',
  },
  purchasing: {
    orders: 'purchaseOrder',
    'goods-receipts': 'goodsReceipt',
  },
  inventory: {
    items: 'item',
    'stock-movements': 'stockMovement',
    warehouses: 'warehouse',
  },
  finance: {
    'journal-entries': 'journalEntry',
    accounts: 'account',
    'bank-reconciliations': 'bankReconciliation',
  },
  crm: {
    leads: 'lead',
    opportunities: 'opportunity',
    activities: 'activity',
  },
  hr: {
    employees: 'employee',
    'pay-runs': 'payRun',
  },
  manufacturing: {
    'work-orders': 'workOrder',
    boms: 'bom',
  },
  system: {
    users: 'user',
    companies: 'company',
    'number-series': 'numberSeries',
  },
};

// ── Known top-level modules ──────────────────────────────────────────────────

const KNOWN_MODULES = new Set([
  'ar',
  'ap',
  'sales',
  'purchasing',
  'inventory',
  'finance',
  'crm',
  'hr',
  'manufacturing',
  'reporting',
  'system',
]);

// ── Return type ──────────────────────────────────────────────────────────────

export interface PageContext extends CopilotPageContext {
  /** Top-level module extracted from the first route segment */
  module: string | undefined;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Reads the current route from TanStack Router and derives page context
 * (module, entity type, entity ID) for the Co-Pilot's context awareness.
 *
 * Updates `useCopilotStore.setCurrentContext()` on every route change.
 * Returns the current context for convenience.
 */
export function usePageContext(): PageContext {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const context = useMemo<PageContext>(() => {
    // Remove trailing slash and split into segments
    const cleaned = pathname.replace(/\/+$/, '') || '/';
    const segments = cleaned.split('/').filter(Boolean);
    // segments for "/ar/invoices/123" → ["ar", "invoices", "123"]

    const pageRoute = cleaned;

    // Extract module from first segment
    const firstSegment = segments[0];
    const module = firstSegment && KNOWN_MODULES.has(firstSegment)
      ? firstSegment
      : undefined;

    // Extract entity type from second segment (if within a known module)
    let entityType: string | undefined;
    let entityId: string | undefined;

    if (module && segments.length >= 2) {
      const moduleMap = ROUTE_SEGMENT_TO_ENTITY[module];
      const entitySegment = segments[1];
      if (moduleMap && entitySegment) {
        entityType = moduleMap[entitySegment];
      }

      // Extract entity ID from third segment (detail page)
      if (segments.length >= 3 && entityType) {
        entityId = segments[2];
      }
    }

    return { pageRoute, entityType, entityId, module };
  }, [pathname]);

  // Sync to copilot store whenever context changes
  const setCurrentContext = useCopilotStore((s) => s.setCurrentContext);

  useEffect(() => {
    setCurrentContext({
      pageRoute: context.pageRoute,
      entityType: context.entityType,
      entityId: context.entityId,
    });
  }, [context.pageRoute, context.entityType, context.entityId, setCurrentContext]);

  return context;
}
