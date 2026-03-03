import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Notification } from '@/stores/notification-store';

// ── Mock Sonner ────────────────────────────────────────────────────────────

const mockToast = vi.fn();
vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// ── Mock i18n singleton (used by notification-toast.ts directly) ──────────

vi.mock('@nexa/i18n', () => ({
  i18n: { t: (key: string) => (key === 'notifications:toastAction' ? 'View' : key) },
  useI18n: () => ({ t: (key: string) => key }),
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { showNotificationToast } from './notification-toast';

// ── Fixture ───────────────────────────────────────────────────────────────

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'notif-1',
  title: 'Invoice Approved',
  body: 'Invoice INV-0042 has been approved.',
  priority: 'NORMAL',
  actionUrl: '/ar/invoices/inv-0042',
  entityType: 'customerInvoice',
  entityId: 'inv-0042',
  status: 'DELIVERED',
  createdAt: '2026-03-03T10:00:00Z',
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('showNotificationToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a toast for URGENT priority with 8s duration', () => {
    const notification = makeNotification({ priority: 'URGENT' });
    showNotificationToast(notification);

    expect(mockToast).toHaveBeenCalledOnce();
    expect(mockToast).toHaveBeenCalledWith(
      'Invoice Approved',
      expect.objectContaining({
        description: 'Invoice INV-0042 has been approved.',
        duration: 8_000,
      }),
    );
  });

  it('shows a toast for HIGH priority with 5s duration', () => {
    const notification = makeNotification({ priority: 'HIGH' });
    showNotificationToast(notification);

    expect(mockToast).toHaveBeenCalledOnce();
    expect(mockToast).toHaveBeenCalledWith(
      'Invoice Approved',
      expect.objectContaining({
        description: 'Invoice INV-0042 has been approved.',
        duration: 5_000,
      }),
    );
  });

  it('does NOT show a toast for NORMAL priority', () => {
    const notification = makeNotification({ priority: 'NORMAL' });
    showNotificationToast(notification);

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does NOT show a toast for LOW priority', () => {
    const notification = makeNotification({ priority: 'LOW' });
    showNotificationToast(notification);

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('includes action that navigates to actionUrl when onNavigate is provided', () => {
    const onNavigate = vi.fn();
    const notification = makeNotification({
      priority: 'URGENT',
      actionUrl: '/sales/orders/so-001',
    });

    showNotificationToast(notification, onNavigate);

    expect(mockToast).toHaveBeenCalledOnce();
    const [, options] = mockToast.mock.calls[0] as [string, Record<string, unknown>];
    expect(options.action).toBeDefined();

    // Invoke the action callback
    const action = options.action as { label: string; onClick: () => void };
    expect(action.label).toBe('View');
    action.onClick();
    expect(onNavigate).toHaveBeenCalledWith('/sales/orders/so-001');
  });

  it('does not include action when actionUrl is null', () => {
    const onNavigate = vi.fn();
    const notification = makeNotification({
      priority: 'HIGH',
      actionUrl: null,
    });

    showNotificationToast(notification, onNavigate);

    expect(mockToast).toHaveBeenCalledOnce();
    const [, options] = mockToast.mock.calls[0] as [string, Record<string, unknown>];
    expect(options.action).toBeUndefined();
  });

  it('does not include action when onNavigate is not provided', () => {
    const notification = makeNotification({ priority: 'HIGH' });

    showNotificationToast(notification);

    expect(mockToast).toHaveBeenCalledOnce();
    const [, options] = mockToast.mock.calls[0] as [string, Record<string, unknown>];
    expect(options.action).toBeUndefined();
  });
});
