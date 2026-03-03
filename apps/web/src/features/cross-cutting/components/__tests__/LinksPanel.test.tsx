import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { RecordLink } from '../../types';

// --- Test data ---
const testLinks: RecordLink[] = [
  {
    id: 'link-1',
    sourceEntityType: 'CustomerInvoice',
    sourceEntityId: 'inv-123',
    targetEntityType: 'SalesOrder',
    targetEntityId: 'so-456',
    linkType: 'CREATED_FROM',
    isSystemGenerated: true,
    description: null,
    direction: 'outgoing',
    createdBy: 'system',
    createdAt: '2025-06-01T10:00:00Z',
    updatedAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'link-2',
    sourceEntityType: 'CustomerPayment',
    sourceEntityId: 'pay-789',
    targetEntityType: 'CustomerInvoice',
    targetEntityId: 'inv-123',
    linkType: 'PAYMENT_FOR',
    isSystemGenerated: false,
    description: null,
    direction: 'incoming',
    createdBy: 'user-1',
    createdAt: '2025-06-02T14:30:00Z',
    updatedAt: '2025-06-02T14:30:00Z',
  },
  {
    id: 'link-3',
    sourceEntityType: 'CustomerInvoice',
    sourceEntityId: 'inv-123',
    targetEntityType: 'CreditNote',
    targetEntityId: 'cn-111',
    linkType: 'CREATED_FROM',
    isSystemGenerated: false,
    description: null,
    direction: 'outgoing',
    createdBy: 'user-1',
    createdAt: '2025-06-03T09:00:00Z',
    updatedAt: '2025-06-03T09:00:00Z',
  },
];

// --- Mock hooks ---
const mockDeleteMutate = vi.fn();

vi.mock('../../hooks/use-record-links', () => ({
  useRecordLinks: vi.fn(() => ({
    links: testLinks,
    total: testLinks.length,
    isLoading: false,
    error: null,
  })),
  useCreateRecordLink: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useDeleteRecordLink: vi.fn(() => ({
    mutate: mockDeleteMutate,
  })),
}));

// --- Mock permissions ---
vi.mock('@/hooks/use-permissions', () => ({
  usePermission: vi.fn(() => ({
    canAccess: true,
    canNew: true,
    canView: true,
    canEdit: true,
    canDelete: true,
    isSuperAdmin: false,
  })),
}));

// --- Mock @tanstack/react-router ---
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// --- Mock AddLinkForm to avoid rendering the full dialog ---
vi.mock('../AddLinkForm', () => ({
  AddLinkForm: () => null,
}));

// --- Radix UI polyfills ---
beforeEach(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('LinksPanel', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    entityType: 'CustomerInvoice',
    entityId: 'inv-123',
    resourceCode: 'finance.invoices.detail',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders panel title', async () => {
    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    expect(screen.getByText('crossCutting.recordLinks.title')).toBeInTheDocument();
  });

  it('renders link count badge', async () => {
    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders Add Link button', async () => {
    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    expect(screen.getByText('crossCutting.recordLinks.addLink')).toBeInTheDocument();
  });

  it('renders links grouped by type', async () => {
    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    // CREATED_FROM group should have 2 links (link-1 and link-3)
    expect(screen.getByText('crossCutting.recordLinks.typeCreatedFrom')).toBeInTheDocument();
    // PAYMENT_FOR group should have 1 link
    expect(screen.getByText('crossCutting.recordLinks.typePaymentFor')).toBeInTheDocument();
  });

  it('renders direction indicators', async () => {
    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    // Outgoing links have ArrowRight, incoming have ArrowLeft
    const outgoingArrows = screen.getAllByLabelText('crossCutting.recordLinks.directionOutgoing');
    const incomingArrows = screen.getAllByLabelText('crossCutting.recordLinks.directionIncoming');

    expect(outgoingArrows.length).toBeGreaterThan(0);
    expect(incomingArrows.length).toBeGreaterThan(0);
  });

  it('renders display references as truncated IDs', async () => {
    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    // Links show first 8 chars of the linked entity ID
    expect(screen.getByText('so-456')).toBeInTheDocument();
    expect(screen.getByText('pay-789')).toBeInTheDocument();
  });

  it('renders navigation links for known entity types', async () => {
    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    // SalesOrder link should be navigable
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('shows system badge for system-generated links', async () => {
    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    // link-1 is system generated
    expect(screen.getByText('crossCutting.recordLinks.system')).toBeInTheDocument();
  });

  it('shows delete buttons for links when user has permissions', async () => {
    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    const deleteButtons = screen.getAllByLabelText('crossCutting.recordLinks.deleteLink');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no links', async () => {
    const { useRecordLinks } = await import('../../hooks/use-record-links');
    (useRecordLinks as ReturnType<typeof vi.fn>).mockReturnValue({
      links: [],
      total: 0,
      isLoading: false,
      error: null,
    });

    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    expect(screen.getByText('crossCutting.recordLinks.emptyState')).toBeInTheDocument();
  });

  it('does not render when open is false', async () => {
    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} open={false} />);

    expect(screen.queryByText('crossCutting.recordLinks.title')).not.toBeInTheDocument();
  });

  it('hides delete for manual links when user lacks edit permission', async () => {
    const { usePermission } = await import('@/hooks/use-permissions');
    (usePermission as ReturnType<typeof vi.fn>).mockReturnValue({
      canAccess: true,
      canNew: true,
      canView: true,
      canEdit: false,
      canDelete: false,
      isSuperAdmin: false,
    });

    const { LinksPanel } = await import('../LinksPanel');
    render(<LinksPanel {...defaultProps} />);

    expect(screen.queryByLabelText('crossCutting.recordLinks.deleteLink')).not.toBeInTheDocument();
  });
});
