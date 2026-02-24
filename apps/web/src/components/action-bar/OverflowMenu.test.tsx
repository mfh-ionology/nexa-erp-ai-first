import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Check, Printer, Ban, Trash2, Sparkles, History } from 'lucide-react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { OverflowAction, ActionDefinition } from './types';
import { OverflowMenu } from './OverflowMenu';

// Build a set of test actions spanning multiple sections
function buildTestActions(): OverflowAction[] {
  return [
    {
      key: 'print',
      labelKey: 'actionBar.print',
      icon: Printer,
      section: 'document',
      shortcutHint: 'Mod+P',
      onAction: vi.fn(),
    },
    {
      key: 'post',
      labelKey: 'actionBar.post',
      icon: Check,
      section: 'status',
      onAction: vi.fn(),
    },
    {
      key: 'void',
      labelKey: 'actionBar.void',
      icon: Ban,
      variant: 'destructive',
      section: 'status',
      requiresConfirmation: true,
      confirmTitleKey: 'actionBar.confirm.voidTitle',
      confirmDescriptionKey: 'actionBar.confirm.voidDescription',
      onAction: vi.fn(),
    },
    {
      key: 'delete',
      labelKey: 'actionBar.delete',
      icon: Trash2,
      variant: 'destructive',
      section: 'record',
      requiresConfirmation: true,
      confirmTitleKey: 'actionBar.confirm.deleteTitle',
      confirmDescriptionKey: 'actionBar.confirm.deleteDescription',
      onAction: vi.fn(),
    },
    {
      key: 'aiExplain',
      labelKey: 'actionBar.aiExplain',
      icon: Sparkles,
      section: 'ai',
      onAction: vi.fn(),
    },
    {
      key: 'viewAuditLog',
      labelKey: 'actionBar.viewAuditLog',
      icon: History,
      section: 'history',
      onAction: vi.fn(),
    },
  ];
}

describe('OverflowMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trigger button with aria-label', () => {
    render(
      <OverflowMenu actions={[]} entityName="Test Entity" />,
    );

    expect(screen.getByRole('button', { name: 'actionBar.moreActions' })).toBeInTheDocument();
  });

  it('renders all 5 sections when actions exist for each', async () => {
    const user = userEvent.setup();
    const actions = buildTestActions();

    render(
      <OverflowMenu actions={actions} entityName="INV-001" />,
    );

    // Open the menu
    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));

    // Check section labels are rendered
    expect(screen.getByText('actionBar.section.document')).toBeInTheDocument();
    expect(screen.getByText('actionBar.section.status')).toBeInTheDocument();
    expect(screen.getByText('actionBar.section.record')).toBeInTheDocument();
    expect(screen.getByText('actionBar.section.ai')).toBeInTheDocument();
    expect(screen.getByText('actionBar.section.history')).toBeInTheDocument();
  });

  it('hides sections with no actions', async () => {
    const user = userEvent.setup();
    // Only provide document actions
    const actions: OverflowAction[] = [
      {
        key: 'print',
        labelKey: 'actionBar.print',
        section: 'document',
        onAction: vi.fn(),
      },
    ];

    render(
      <OverflowMenu actions={actions} entityName="INV-001" />,
    );

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));

    expect(screen.getByText('actionBar.section.document')).toBeInTheDocument();
    expect(screen.queryByText('actionBar.section.status')).not.toBeInTheDocument();
    expect(screen.queryByText('actionBar.section.record')).not.toBeInTheDocument();
    expect(screen.queryByText('actionBar.section.ai')).not.toBeInTheDocument();
    expect(screen.queryByText('actionBar.section.history')).not.toBeInTheDocument();
  });

  it('renders action labels via t() keys', async () => {
    const user = userEvent.setup();
    const actions = buildTestActions();

    render(
      <OverflowMenu actions={actions} entityName="INV-001" />,
    );

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));

    expect(screen.getByText('actionBar.print')).toBeInTheDocument();
    expect(screen.getByText('actionBar.post')).toBeInTheDocument();
    expect(screen.getByText('actionBar.void')).toBeInTheDocument();
    expect(screen.getByText('actionBar.delete')).toBeInTheDocument();
    expect(screen.getByText('actionBar.aiExplain')).toBeInTheDocument();
    expect(screen.getByText('actionBar.viewAuditLog')).toBeInTheDocument();
  });

  it('renders keyboard shortcut hints', async () => {
    const user = userEvent.setup();
    const actions = buildTestActions();

    render(
      <OverflowMenu actions={actions} entityName="INV-001" />,
    );

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));

    // In test env (Node.js), isMac=false, so Mod+P resolves to Ctrl+P
    expect(screen.getByText('Ctrl+P')).toBeInTheDocument();
  });

  it('destructive items have destructive variant attribute', async () => {
    const user = userEvent.setup();
    const actions = buildTestActions();

    render(
      <OverflowMenu actions={actions} entityName="INV-001" />,
    );

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));

    // The void menu item should have data-variant="destructive"
    const voidItem = screen.getByText('actionBar.void').closest('[data-slot="dropdown-menu-item"]');
    expect(voidItem).toHaveAttribute('data-variant', 'destructive');
  });

  it('clicking a non-confirmation action calls onAction directly', async () => {
    const user = userEvent.setup();
    const printAction: OverflowAction = {
      key: 'print',
      labelKey: 'actionBar.print',
      section: 'document',
      onAction: vi.fn(),
    };

    render(
      <OverflowMenu actions={[printAction]} entityName="INV-001" />,
    );

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));
    await user.click(screen.getByText('actionBar.print'));

    expect(printAction.onAction).toHaveBeenCalledTimes(1);
  });

  it('clicking a destructive action opens confirmation dialog', async () => {
    const user = userEvent.setup();
    const actions = buildTestActions();

    render(
      <OverflowMenu actions={actions} entityName="INV-001" />,
    );

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));
    await user.click(screen.getByText('actionBar.void'));

    // Confirmation dialog should appear
    expect(screen.getByText('actionBar.confirm.voidTitle')).toBeInTheDocument();
    expect(screen.getByText('actionBar.confirm.voidDescription')).toBeInTheDocument();
  });

  it('confirming the dialog calls onAction', async () => {
    const user = userEvent.setup();
    const actions = buildTestActions();
    const voidAction = actions.find((a) => a.key === 'void')!;

    render(
      <OverflowMenu actions={actions} entityName="INV-001" />,
    );

    // Open menu and click void
    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));
    await user.click(screen.getByText('actionBar.void'));

    // Confirm the dialog
    await user.click(screen.getByText('actionBar.confirm.button'));
    expect(voidAction.onAction).toHaveBeenCalledTimes(1);
  });

  it('cancelling the dialog does not call onAction', async () => {
    const user = userEvent.setup();
    const actions = buildTestActions();
    const voidAction = actions.find((a) => a.key === 'void')!;

    render(
      <OverflowMenu actions={actions} entityName="INV-001" />,
    );

    // Open menu and click void
    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));
    await user.click(screen.getByText('actionBar.void'));

    // Cancel
    await user.click(screen.getByText('actionBar.confirm.cancel'));
    expect(voidAction.onAction).not.toHaveBeenCalled();
  });

  it('Escape key closes the menu', async () => {
    const user = userEvent.setup();
    const actions = buildTestActions();

    render(
      <OverflowMenu actions={actions} entityName="INV-001" />,
    );

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));
    expect(screen.getByText('actionBar.print')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    // After escape, menu items should no longer be visible
    expect(screen.queryByText('actionBar.print')).not.toBeInTheDocument();
  });

  it('renders mobile tool actions when provided', async () => {
    const user = userEvent.setup();
    const mobileTools: ActionDefinition[] = [
      {
        key: 'attachments',
        labelKey: 'actionBar.attachments',
        onAction: vi.fn(),
      },
      {
        key: 'links',
        labelKey: 'actionBar.links',
        onAction: vi.fn(),
      },
    ];

    render(
      <OverflowMenu
        actions={[]}
        entityName="INV-001"
        mobileToolActions={mobileTools}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));

    expect(screen.getByText('actionBar.attachments')).toBeInTheDocument();
    expect(screen.getByText('actionBar.links')).toBeInTheDocument();
  });

  it('confirmation dialog shows loading state during async onAction', async () => {
    const user = userEvent.setup();
    let resolveAction: () => void;
    const asyncAction: OverflowAction = {
      key: 'void',
      labelKey: 'actionBar.void',
      icon: Ban,
      variant: 'destructive',
      section: 'status',
      requiresConfirmation: true,
      confirmTitleKey: 'actionBar.confirm.voidTitle',
      confirmDescriptionKey: 'actionBar.confirm.voidDescription',
      onAction: vi.fn(() => new Promise<void>((resolve) => { resolveAction = resolve; })),
    };

    render(
      <OverflowMenu actions={[asyncAction]} entityName="INV-001" />,
    );

    // Open menu and click void
    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));
    await user.click(screen.getByText('actionBar.void'));

    // Confirm — dialog should stay open with loading
    await user.click(screen.getByText('actionBar.confirm.button'));

    // Dialog still open, confirm button disabled during async operation
    const confirmBtn = screen.getByText('actionBar.confirm.button').closest('button');
    expect(confirmBtn).toBeDisabled();

    // Resolve the async action
    resolveAction!();
    // Allow microtasks to flush
    await vi.waitFor(() => {
      expect(screen.queryByText('actionBar.confirm.voidTitle')).not.toBeInTheDocument();
    });
  });

  it('disabled items when isLoading is true', async () => {
    const user = userEvent.setup();
    const actions: OverflowAction[] = [
      {
        key: 'print',
        labelKey: 'actionBar.print',
        section: 'document',
        isLoading: true,
        onAction: vi.fn(),
      },
    ];

    render(
      <OverflowMenu actions={actions} entityName="INV-001" />,
    );

    await user.click(screen.getByRole('button', { name: 'actionBar.moreActions' }));

    const item = screen.getByText('actionBar.print').closest('[data-slot="dropdown-menu-item"]');
    expect(item).toHaveAttribute('data-disabled', '');
  });
});
