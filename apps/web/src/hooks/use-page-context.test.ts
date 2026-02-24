import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useCopilotStore } from '@/stores/copilot-store';

// ── Mock TanStack Router ─────────────────────────────────────────────────────

let mockPathname = '/';

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (s: { location: { pathname: string } }) => string;
  }) => select({ location: { pathname: mockPathname } }),
}));

import { usePageContext } from './use-page-context';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('usePageContext', () => {
  beforeEach(() => {
    mockPathname = '/';
    useCopilotStore.setState({ currentContext: null });
  });

  it('parses /ar/invoices correctly (module: ar, entityType: customerInvoice)', () => {
    mockPathname = '/ar/invoices';
    const { result } = renderHook(() => usePageContext());

    expect(result.current.pageRoute).toBe('/ar/invoices');
    expect(result.current.module).toBe('ar');
    expect(result.current.entityType).toBe('customerInvoice');
    expect(result.current.entityId).toBeUndefined();
  });

  it('parses /sales/orders/123 correctly (module: sales, entityType: salesOrder, entityId: 123)', () => {
    mockPathname = '/sales/orders/123';
    const { result } = renderHook(() => usePageContext());

    expect(result.current.pageRoute).toBe('/sales/orders/123');
    expect(result.current.module).toBe('sales');
    expect(result.current.entityType).toBe('salesOrder');
    expect(result.current.entityId).toBe('123');
  });

  it('parses root path correctly', () => {
    mockPathname = '/';
    const { result } = renderHook(() => usePageContext());

    expect(result.current.pageRoute).toBe('/');
    expect(result.current.module).toBeUndefined();
    expect(result.current.entityType).toBeUndefined();
  });

  it('handles unknown module gracefully', () => {
    mockPathname = '/unknown/page';
    const { result } = renderHook(() => usePageContext());

    expect(result.current.module).toBeUndefined();
    expect(result.current.entityType).toBeUndefined();
  });

  it('updates store context on route change', () => {
    mockPathname = '/ar/invoices';
    renderHook(() => usePageContext());

    const context = useCopilotStore.getState().currentContext;
    expect(context).toEqual({
      pageRoute: '/ar/invoices',
      entityType: 'customerInvoice',
      entityId: undefined,
    });
  });

  it('parses /finance/journal-entries correctly', () => {
    mockPathname = '/finance/journal-entries';
    const { result } = renderHook(() => usePageContext());

    expect(result.current.module).toBe('finance');
    expect(result.current.entityType).toBe('journalEntry');
  });

  it('parses /manufacturing/work-orders/456 correctly', () => {
    mockPathname = '/manufacturing/work-orders/456';
    const { result } = renderHook(() => usePageContext());

    expect(result.current.module).toBe('manufacturing');
    expect(result.current.entityType).toBe('workOrder');
    expect(result.current.entityId).toBe('456');
  });

  it('parses /inventory/items correctly', () => {
    mockPathname = '/inventory/items';
    const { result } = renderHook(() => usePageContext());

    expect(result.current.module).toBe('inventory');
    expect(result.current.entityType).toBe('item');
  });

  it('handles trailing slash', () => {
    mockPathname = '/ar/invoices/';
    const { result } = renderHook(() => usePageContext());

    expect(result.current.pageRoute).toBe('/ar/invoices');
    expect(result.current.module).toBe('ar');
    expect(result.current.entityType).toBe('customerInvoice');
  });
});
