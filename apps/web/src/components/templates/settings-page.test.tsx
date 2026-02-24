import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SettingsPage } from './settings-page';
import type { SettingsGroup } from './types';

// Mock useBreakpoint to default to desktop
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: vi.fn(() => 'desktop'),
}));

// Mock TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...rest}>{children}</a>
  ),
}));

const mockGroups: SettingsGroup[] = [
  {
    key: 'general',
    labelKey: 'settings.general',
    descriptionKey: 'settings.generalDesc',
    content: <div>General settings form</div>,
    isCollapsible: false,
  },
  {
    key: 'notifications',
    labelKey: 'settings.notifications',
    descriptionKey: 'settings.notificationsDesc',
    content: <div>Notification settings form</div>,
    isCollapsible: true,
    defaultOpen: true,
  },
  {
    key: 'advanced',
    labelKey: 'settings.advanced',
    content: <div>Advanced settings form</div>,
    isCollapsible: true,
    defaultOpen: false,
  },
];

const defaultProps = {
  title: 'Company Settings',
  breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Settings' }],
  groups: mockGroups,
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings groups', () => {
    render(<SettingsPage {...defaultProps} />);

    expect(screen.getByText('settings.general')).toBeInTheDocument();
    expect(screen.getByText('settings.notifications')).toBeInTheDocument();
    expect(screen.getByText('settings.advanced')).toBeInTheDocument();
  });

  it('renders group content', () => {
    render(<SettingsPage {...defaultProps} />);

    expect(screen.getByText('General settings form')).toBeInTheDocument();
  });

  it('save button disabled when not dirty', () => {
    render(<SettingsPage {...defaultProps} isDirty={false} onSave={vi.fn()} />);

    const saveButton = screen.getByText('saveSettings').closest('button');
    expect(saveButton).toBeDisabled();
  });

  it('save button enabled when dirty', () => {
    render(<SettingsPage {...defaultProps} isDirty onSave={vi.fn()} />);

    const saveButton = screen.getByText('saveSettings').closest('button');
    expect(saveButton).not.toBeDisabled();
  });

  it('save button calls onSave when clicked', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<SettingsPage {...defaultProps} isDirty onSave={onSave} />);

    await user.click(screen.getByText('saveSettings'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows unsaved changes indicator when dirty', () => {
    render(<SettingsPage {...defaultProps} isDirty />);

    expect(screen.getByText('unsavedChanges')).toBeInTheDocument();
  });

  it('reset button opens confirmation dialog', async () => {
    const user = userEvent.setup();

    render(<SettingsPage {...defaultProps} onReset={vi.fn()} />);

    // Click the reset button to open dialog
    await user.click(screen.getByText('resetDefaults'));

    // Dialog should appear
    expect(screen.getByText('settings.resetConfirmTitle')).toBeInTheDocument();
    expect(screen.getByText('settings.resetConfirmDescription')).toBeInTheDocument();
  });

  it('has semantic main landmark with aria-label', () => {
    render(<SettingsPage {...defaultProps} />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-label', 'Company Settings');
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<SettingsPage {...defaultProps} isLoading />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
  });

  it('renders group descriptions', () => {
    render(<SettingsPage {...defaultProps} />);

    expect(screen.getByText('settings.generalDesc')).toBeInTheDocument();
    // Notifications description may appear in both header and content area (two-column layout)
    expect(screen.getAllByText('settings.notificationsDesc').length).toBeGreaterThanOrEqual(1);
  });
});
