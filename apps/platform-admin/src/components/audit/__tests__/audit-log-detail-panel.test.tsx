// ---------------------------------------------------------------------------
// Component Tests — Audit Log Detail Panel
// Story: E13b.6 Task 4.3
// Sections rendering, JSON display, close button, loading state
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AuditLogDetailPanel, type AuditLogDetailPanelProps } from '../audit-log-detail-panel';
import type { AuditLogDetail } from '@/hooks/use-audit-log';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/lib/audit-log-utils', () => ({
  formatAuditTimestamp: (iso: string) => {
    try {
      const d = new Date(iso);
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const minutes = String(d.getUTCMinutes()).padStart(2, '0');
      const seconds = String(d.getUTCSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch {
      return iso;
    }
  },
  actionBadgeClass: (action: string) => {
    if (action.startsWith('tenant.')) return 'bg-blue-100 text-blue-700';
    if (action.startsWith('auth.')) return 'bg-green-100 text-green-700';
    return 'bg-slate-100 text-slate-700';
  },
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_DETAIL: AuditLogDetail = {
  id: 'entry-1',
  platformUser: {
    id: 'admin-1',
    email: 'admin@nexa.io',
    displayName: 'Admin User',
  },
  action: 'tenant.create',
  targetType: 'tenant',
  targetId: '550e8400-e29b-41d4-a716-446655440001',
  ipAddress: '192.168.1.1',
  timestamp: '2026-03-11T14:30:00.000Z',
  details: {
    tenantName: 'Acme Corp',
    planCode: 'STARTER',
    before: null,
    after: { status: 'ACTIVE' },
  },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  createdAt: '2026-03-11T14:30:00.500Z',
};

const MOCK_DETAIL_MINIMAL: AuditLogDetail = {
  id: 'entry-2',
  platformUser: {
    id: 'admin-2',
    email: 'viewer@nexa.io',
    displayName: 'Viewer User',
  },
  action: 'auth.login',
  targetType: null,
  targetId: null,
  ipAddress: '10.0.0.5',
  timestamp: '2026-03-11T13:00:00.000Z',
  details: null,
  userAgent: null,
  createdAt: '2026-03-11T13:00:00.200Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPanel(overrides?: Partial<AuditLogDetailPanelProps>) {
  const defaultProps: AuditLogDetailPanelProps = {
    detail: MOCK_DETAIL,
    isLoading: false,
    isOpen: true,
    onClose: vi.fn(),
    ...overrides,
  };
  return {
    ...render(<AuditLogDetailPanel {...defaultProps} />),
    onClose: defaultProps.onClose as ReturnType<typeof vi.fn>,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditLogDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering when closed
  // -------------------------------------------------------------------------

  it('renders nothing when isOpen is false', () => {
    renderPanel({ isOpen: false });
    expect(screen.queryByTestId('audit-detail-panel')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // All sections rendered (AC#4)
  // -------------------------------------------------------------------------

  it('renders all sections: admin user, action, details, request info, timestamps', () => {
    renderPanel();

    // Admin User section
    expect(screen.getByText('Admin User', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('admin@nexa.io')).toBeInTheDocument();

    // Action section
    expect(screen.getByText('Action', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('tenant')).toBeInTheDocument();

    // Details section
    expect(screen.getByText('Details', { selector: 'h3' })).toBeInTheDocument();

    // Request Info section
    expect(screen.getByText('Request Info', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument();

    // Timestamps section
    expect(screen.getByText('Timestamps', { selector: 'h3' })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Header
  // -------------------------------------------------------------------------

  it('renders action as title and timestamp as subtitle in the header', () => {
    renderPanel();

    const panel = screen.getByTestId('audit-detail-panel');
    expect(panel).toBeInTheDocument();

    // Action title in the header
    expect(screen.getByText('tenant.create', { selector: 'h2' })).toBeInTheDocument();
    // Formatted timestamp appears in header subtitle and in Timestamps section
    const timestamps = screen.getAllByText('11/03/2026 14:30:00');
    expect(timestamps.length).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // JSON details rendered in readable format
  // -------------------------------------------------------------------------

  it('renders JSON details in formatted pre block', () => {
    renderPanel();

    const jsonBlock = screen.getByTestId('audit-detail-json');
    expect(jsonBlock).toBeInTheDocument();
    expect(jsonBlock.textContent).toContain('"tenantName": "Acme Corp"');
    expect(jsonBlock.textContent).toContain('"planCode": "STARTER"');
  });

  it('shows "No additional details" when details is null', () => {
    renderPanel({ detail: MOCK_DETAIL_MINIMAL });

    expect(screen.getByText('No additional details recorded.')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Target ID with copy button
  // -------------------------------------------------------------------------

  it('renders full target ID with copy button', () => {
    renderPanel();

    expect(screen.getByText('550e8400-e29b-41d4-a716-446655440001')).toBeInTheDocument();
    expect(screen.getByLabelText('Copy target ID')).toBeInTheDocument();
  });

  it('renders dash for null targetType and targetId', () => {
    renderPanel({ detail: MOCK_DETAIL_MINIMAL });

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // User agent
  // -------------------------------------------------------------------------

  it('renders user agent string', () => {
    renderPanel();

    expect(screen.getByText(/Mozilla\/5\.0.*AppleWebKit/)).toBeInTheDocument();
  });

  it('renders dash for null user agent', () => {
    renderPanel({ detail: MOCK_DETAIL_MINIMAL });

    // Multiple dashes for null fields
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  // -------------------------------------------------------------------------
  // Close button dismisses the panel
  // -------------------------------------------------------------------------

  it('close button calls onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();

    const closeBtn = screen.getByTestId('audit-detail-close');
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking backdrop calls onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();

    const backdrop = screen.getByTestId('audit-detail-backdrop');
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pressing Escape calls onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('shows loading spinner when isLoading is true', () => {
    renderPanel({ isLoading: true, detail: undefined });

    expect(screen.getByTestId('audit-detail-loading')).toBeInTheDocument();
  });

  it('shows loading placeholder in header when isLoading is true', () => {
    renderPanel({ isLoading: true, detail: undefined });

    // Should not show action title
    expect(screen.queryByText('tenant.create', { selector: 'h2' })).not.toBeInTheDocument();
  });
});
