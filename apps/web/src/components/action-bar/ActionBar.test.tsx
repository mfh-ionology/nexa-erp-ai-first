import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useAuthStore } from '@/stores/auth-store';
import { ActionBar } from './ActionBar';

// Mock useBreakpoint — default to desktop
const mockUseBreakpoint = vi.fn((): 'desktop' | 'tablet' | 'phone' => 'desktop');
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: () => mockUseBreakpoint(),
}));

// Helper to set up auth store with SUPER_ADMIN (all perms bypass)
function setSuperAdmin() {
  useAuthStore.setState({
    permissions: {
      userId: 'u1',
      companyId: 'c1',
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      accessGroups: [],
      modules: {},
      fieldOverrides: {},
      enabledModules: [],
    },
  });
}

// Helper to set up auth store with specific module permissions
function setPermissions(
  modules: Record<
    string,
    { canAccess: boolean; canNew: boolean; canView: boolean; canEdit: boolean; canDelete: boolean }
  >,
) {
  useAuthStore.setState({
    permissions: {
      userId: 'u1',
      companyId: 'c1',
      role: 'USER',
      isSuperAdmin: false,
      accessGroups: [{ id: 'ag1', code: 'default', name: 'Default' }],
      modules,
      fieldOverrides: {},
      enabledModules: [],
    },
  });
}

const defaultProps = {
  entityType: 'customerInvoice',
  status: 'DRAFT',
  entityName: 'INV-2026-0001',
};

describe('ActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreakpoint.mockReturnValue('desktop');
    setSuperAdmin();
  });

  // --- Rendering tests ---

  it('renders primary action buttons with correct labels', () => {
    render(<ActionBar {...defaultProps} />);

    // customerInvoice DRAFT has "Approve" and "Save Draft" as primary
    expect(screen.getByText('actionBar.approve')).toBeInTheDocument();
    expect(screen.getByText('actionBar.saveDraft')).toBeInTheDocument();
  });

  it('renders up to 2 primary action buttons', () => {
    render(<ActionBar {...defaultProps} />);

    // DRAFT customerInvoice has exactly 2 primary actions
    // Primary buttons + persistent tools (Attachments, Links) + overflow trigger
    // Approve, Save Draft, Attachments, Links, Overflow = at least 5 buttons
    const approveBtn = screen.getByText('actionBar.approve').closest('button');
    const saveDraftBtn = screen.getByText('actionBar.saveDraft').closest('button');
    expect(approveBtn).toBeInTheDocument();
    expect(saveDraftBtn).toBeInTheDocument();
  });

  it('renders persistent tools buttons (Attachments, Links)', () => {
    render(<ActionBar {...defaultProps} attachmentCount={3} linkCount={2} />);

    expect(screen.getByRole('button', { name: 'actionBar.attachments (3)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'actionBar.links (2)' })).toBeInTheDocument();
  });

  it('renders overflow menu trigger button', () => {
    render(<ActionBar {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'actionBar.moreActions' })).toBeInTheDocument();
  });

  it('does not render persistent tools when showPersistentTools={false}', () => {
    render(<ActionBar {...defaultProps} showPersistentTools={false} />);

    expect(screen.queryByRole('button', { name: 'actionBar.attachments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'actionBar.links' })).not.toBeInTheDocument();
  });

  it('persistent tool buttons are disabled when callbacks are not provided', () => {
    render(<ActionBar {...defaultProps} />);

    const attachBtn = screen.getByRole('button', { name: 'actionBar.attachments' });
    const linksBtn = screen.getByRole('button', { name: 'actionBar.links' });
    expect(attachBtn).toBeDisabled();
    expect(linksBtn).toBeDisabled();
  });

  // --- Status-driven action tests ---

  it('DRAFT status: renders Approve as primary action', () => {
    render(<ActionBar {...defaultProps} status="DRAFT" />);

    expect(screen.getByText('actionBar.approve')).toBeInTheDocument();
  });

  it('DRAFT status: Delete available in overflow', async () => {
    const user = userEvent.setup();
    render(<ActionBar {...defaultProps} status="DRAFT" />);

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));
    expect(screen.getByText('actionBar.delete')).toBeInTheDocument();
  });

  it('POSTED status: does not render Approve', () => {
    render(<ActionBar {...defaultProps} status="POSTED" />);

    // POSTED status has no primary actions for customerInvoice
    expect(screen.queryByText('actionBar.approve')).not.toBeInTheDocument();
  });

  it('different entity statuses show different primary actions', () => {
    const { unmount } = render(<ActionBar {...defaultProps} status="APPROVED" />);
    // APPROVED: Email to Customer
    expect(screen.getByText('actionBar.emailToCustomer')).toBeInTheDocument();
    expect(screen.queryByText('actionBar.approve')).not.toBeInTheDocument();
    unmount();

    render(<ActionBar {...defaultProps} entityType="journalEntry" status="DRAFT" />);
    // journalEntry DRAFT: Post + Save Draft
    expect(screen.getByText('actionBar.post')).toBeInTheDocument();
  });

  // --- Count badge tests ---

  it('attachments badge shows count when attachmentCount > 0', () => {
    render(<ActionBar {...defaultProps} attachmentCount={3} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('links badge shows count when linkCount > 0', () => {
    render(<ActionBar {...defaultProps} linkCount={2} />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('badges hidden when count is 0 (but buttons still visible)', () => {
    render(<ActionBar {...defaultProps} attachmentCount={0} linkCount={0} />);

    // Buttons still rendered
    expect(screen.getByRole('button', { name: 'actionBar.attachments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'actionBar.links' })).toBeInTheDocument();

    // No badge numbers
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  // --- Responsive tests ---

  it('phone breakpoint: only first primary action rendered', () => {
    mockUseBreakpoint.mockReturnValue('phone');
    render(<ActionBar {...defaultProps} />);

    // DRAFT customerInvoice: first primary is Approve
    expect(screen.getByText('actionBar.approve')).toBeInTheDocument();
    // Second primary (Save Draft) should NOT be visible on phone
    expect(screen.queryByText('actionBar.saveDraft')).not.toBeInTheDocument();
  });

  it('phone breakpoint: persistent tools hidden from main bar', () => {
    mockUseBreakpoint.mockReturnValue('phone');
    render(<ActionBar {...defaultProps} attachmentCount={3} />);

    // Persistent tool buttons should NOT appear in the toolbar directly
    expect(screen.queryByRole('button', { name: 'actionBar.attachments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'actionBar.links' })).not.toBeInTheDocument();
  });

  it('phone breakpoint: persistent tools moved to overflow menu', async () => {
    const user = userEvent.setup();
    mockUseBreakpoint.mockReturnValue('phone');
    render(<ActionBar {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));

    // Attachments and Links should appear in the overflow menu on phone
    expect(screen.getByText('actionBar.attachments')).toBeInTheDocument();
    expect(screen.getByText('actionBar.links')).toBeInTheDocument();
  });

  it('desktop breakpoint: full layout rendered', () => {
    mockUseBreakpoint.mockReturnValue('desktop');
    render(<ActionBar {...defaultProps} attachmentCount={1} linkCount={1} />);

    // Primary actions
    expect(screen.getByText('actionBar.approve')).toBeInTheDocument();
    expect(screen.getByText('actionBar.saveDraft')).toBeInTheDocument();
    // Persistent tools (aria-label includes count when > 0)
    expect(screen.getByRole('button', { name: 'actionBar.attachments (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'actionBar.links (1)' })).toBeInTheDocument();
    // Overflow trigger
    expect(screen.getByRole('button', { name: 'actionBar.moreActions' })).toBeInTheDocument();
  });

  // --- Accessibility tests ---

  it('has role="toolbar" on container', () => {
    render(<ActionBar {...defaultProps} />);

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('has aria-label on toolbar', () => {
    render(<ActionBar {...defaultProps} />);

    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'actionBar.ariaLabel');
  });

  it('implements roving tabindex — only first button has tabIndex=0', () => {
    render(<ActionBar {...defaultProps} onAttachmentsClick={vi.fn()} onLinksClick={vi.fn()} />);

    const toolbar = screen.getByRole('toolbar');
    const buttons = toolbar.querySelectorAll('button:not([disabled])');
    // First button should have tabIndex 0
    expect(buttons[0]).toHaveAttribute('tabindex', '0');
    // Remaining buttons should have tabIndex -1
    for (let i = 1; i < buttons.length; i++) {
      expect(buttons[i]).toHaveAttribute('tabindex', '-1');
    }
  });

  it('ArrowRight moves focus to the next toolbar button', async () => {
    const user = userEvent.setup();
    render(<ActionBar {...defaultProps} onAttachmentsClick={vi.fn()} onLinksClick={vi.fn()} />);

    const toolbar = screen.getByRole('toolbar');
    const buttons = Array.from(
      toolbar.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
    );

    // Focus the first button and press ArrowRight
    buttons[0]!.focus();
    await user.keyboard('{ArrowRight}');

    expect(document.activeElement).toBe(buttons[1]);
  });

  it('all buttons have accessible names', () => {
    render(<ActionBar {...defaultProps} attachmentCount={1} linkCount={1} />);

    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      // Each button should have text content or aria-label
      const hasName = btn.textContent!.trim().length > 0 || btn.getAttribute('aria-label') !== null;
      expect(hasName).toBe(true);
    }
  });

  // --- Permission filtering ---

  it('hides actions when user lacks required permission', () => {
    setPermissions({
      'finance.invoices.detail': {
        canAccess: true,
        canNew: false,
        canView: true,
        canEdit: false, // No edit permission — Approve requires canEdit
        canDelete: false,
      },
    });

    render(<ActionBar {...defaultProps} status="DRAFT" />);

    // Approve requires canEdit => hidden
    expect(screen.queryByText('actionBar.approve')).not.toBeInTheDocument();
    // Save Draft requires canEdit => hidden
    expect(screen.queryByText('actionBar.saveDraft')).not.toBeInTheDocument();
  });

  it('SUPER_ADMIN sees all status-valid actions', () => {
    setSuperAdmin();
    render(<ActionBar {...defaultProps} status="DRAFT" />);

    expect(screen.getByText('actionBar.approve')).toBeInTheDocument();
    expect(screen.getByText('actionBar.saveDraft')).toBeInTheDocument();
  });

  // --- Callback tests ---

  it('calls onAttachmentsClick when Attachments button is clicked', async () => {
    const user = userEvent.setup();
    const onAttachmentsClick = vi.fn();
    render(<ActionBar {...defaultProps} onAttachmentsClick={onAttachmentsClick} />);

    await user.click(screen.getByRole('button', { name: 'actionBar.attachments' }));
    expect(onAttachmentsClick).toHaveBeenCalledTimes(1);
  });

  it('calls onLinksClick when Links button is clicked', async () => {
    const user = userEvent.setup();
    const onLinksClick = vi.fn();
    render(<ActionBar {...defaultProps} onLinksClick={onLinksClick} />);

    await user.click(screen.getByRole('button', { name: 'actionBar.links' }));
    expect(onLinksClick).toHaveBeenCalledTimes(1);
  });

  // --- Custom action config ---

  it('uses actionConfig prop override instead of registry', () => {
    render(
      <ActionBar
        {...defaultProps}
        actionConfig={{
          primary: [
            {
              key: 'custom',
              labelKey: 'actionBar.custom',
              isPrimary: true,
              onAction: vi.fn(),
            },
          ],
          overflow: [],
        }}
      />,
    );

    expect(screen.getByText('actionBar.custom')).toBeInTheDocument();
    // Registry actions should not appear
    expect(screen.queryByText('actionBar.approve')).not.toBeInTheDocument();
  });

  // --- Additional actions ---

  it('renders additionalActions in the overflow menu', async () => {
    const user = userEvent.setup();
    render(
      <ActionBar
        {...defaultProps}
        additionalActions={[
          {
            key: 'customOverflow',
            labelKey: 'actionBar.customOverflow',
            section: 'record',
            onAction: vi.fn(),
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));
    expect(screen.getByText('actionBar.customOverflow')).toBeInTheDocument();
  });

  // --- Global actions suppression ---

  it('showGlobalActions={false} suppresses AI and History actions from overflow', async () => {
    const user = userEvent.setup();
    render(<ActionBar {...defaultProps} showGlobalActions={false} />);

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));
    expect(screen.queryByText('actionBar.aiExplain')).not.toBeInTheDocument();
    expect(screen.queryByText('actionBar.viewAuditLog')).not.toBeInTheDocument();
  });

  it('global actions are included by default', async () => {
    const user = userEvent.setup();
    render(<ActionBar {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));
    expect(screen.getByText('actionBar.aiExplain')).toBeInTheDocument();
    expect(screen.getByText('actionBar.viewAuditLog')).toBeInTheDocument();
  });
});
