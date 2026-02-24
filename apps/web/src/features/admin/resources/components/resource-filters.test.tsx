import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ResourceFilters } from './resource-filters';

// Mock TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
  Link: (props: Record<string, unknown>) => {
    const React = require('react');
    return React.createElement('a', { href: props.to }, props.children);
  },
}));

// Create context via vi.hoisted so it's available in the mock factory
const { MockSelectCtx } = vi.hoisted(() => {
  const React = require('react');
  return {
    MockSelectCtx: React.createContext({
      onValueChange: undefined as ((v: string) => void) | undefined,
    }),
  };
});

// Mock Shadcn Select with simple HTML elements that use context
// to properly route onValueChange to the correct parent Select.
vi.mock('@/components/ui/select', () => {
  const React = require('react');

  return {
    Select: (props: { children: unknown; value?: string; onValueChange?: (v: string) => void }) =>
      React.createElement(
        MockSelectCtx.Provider,
        { value: { onValueChange: props.onValueChange } },
        props.children,
      ),
    SelectTrigger: (props: { children: unknown; 'aria-label'?: string }) =>
      React.createElement(
        'button',
        { role: 'combobox', 'aria-label': props['aria-label'] },
        props.children,
      ),
    SelectContent: (props: { children: unknown }) =>
      React.createElement('div', null, props.children),
    SelectItem: (props: { children: unknown; value: string }) => {
      const ctx = React.useContext(MockSelectCtx);
      return React.createElement(
        'button',
        {
          role: 'option',
          'data-value': props.value,
          onClick: () => ctx.onValueChange?.(props.value),
        },
        props.children,
      );
    },
    SelectValue: (props: { placeholder?: string }) =>
      React.createElement('span', null, props.placeholder),
  };
});

const defaultProps = {
  module: '',
  onModuleChange: vi.fn(),
  type: '',
  onTypeChange: vi.fn(),
};

describe('ResourceFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders module filter trigger with translated label', () => {
    render(<ResourceFilters {...defaultProps} />);

    expect(
      screen.getByRole('combobox', { name: 'resources.filter.module' }),
    ).toBeInTheDocument();
  });

  it('renders type filter trigger with translated label', () => {
    render(<ResourceFilters {...defaultProps} />);

    expect(
      screen.getByRole('combobox', { name: 'resources.filter.type' }),
    ).toBeInTheDocument();
  });

  it('module dropdown renders "All Modules" and all known modules', () => {
    render(<ResourceFilters {...defaultProps} />);

    // "All Modules" appears twice: once in placeholder, once as _all option
    const allModulesEls = screen.getAllByText('resources.filter.allModules');
    expect(allModulesEls.length).toBeGreaterThanOrEqual(1);

    const expectedModules = [
      'navigation:system',
      'navigation:finance',
      'navigation:ar',
      'navigation:ap',
      'navigation:sales',
      'navigation:purchasing',
      'navigation:inventory',
      'navigation:crm',
      'navigation:hr',
      'navigation:manufacturing',
      'navigation:reporting',
    ];
    for (const mod of expectedModules) {
      expect(screen.getByText(mod)).toBeInTheDocument();
    }
  });

  it('type dropdown renders "All Types" and all ResourceType values', () => {
    render(<ResourceFilters {...defaultProps} />);

    // "All Types" appears twice: once in placeholder, once as _all option
    const allTypesEls = screen.getAllByText('resources.filter.allTypes');
    expect(allTypesEls.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('resources.type.page')).toBeInTheDocument();
    expect(screen.getByText('resources.type.report')).toBeInTheDocument();
    expect(screen.getByText('resources.type.setting')).toBeInTheDocument();
    expect(screen.getByText('resources.type.maintenance')).toBeInTheDocument();
  });

  it('selecting a module calls onModuleChange with the selected value', async () => {
    const user = userEvent.setup();
    const onModuleChange = vi.fn();

    render(
      <ResourceFilters {...defaultProps} onModuleChange={onModuleChange} />,
    );

    await user.click(screen.getByText('navigation:finance'));

    expect(onModuleChange).toHaveBeenCalledWith('finance');
  });

  it('selecting a type calls onTypeChange with the selected value', async () => {
    const user = userEvent.setup();
    const onTypeChange = vi.fn();

    render(
      <ResourceFilters {...defaultProps} onTypeChange={onTypeChange} />,
    );

    await user.click(screen.getByText('resources.type.page'));

    expect(onTypeChange).toHaveBeenCalledWith('PAGE');
  });

  it('selecting "All Modules" calls onModuleChange with empty string', async () => {
    const user = userEvent.setup();
    const onModuleChange = vi.fn();

    render(
      <ResourceFilters
        {...defaultProps}
        module="finance"
        onModuleChange={onModuleChange}
      />,
    );

    // The component maps '_all' → '' before calling the prop.
    // Target the option button (role="option") not the placeholder span.
    const allModulesOption = screen.getByRole('option', { name: 'resources.filter.allModules' });
    await user.click(allModulesOption);

    expect(onModuleChange).toHaveBeenCalledWith('');
  });

  it('both filters can be active simultaneously', () => {
    render(
      <ResourceFilters {...defaultProps} module="finance" type="PAGE" />,
    );

    expect(
      screen.getByRole('combobox', { name: 'resources.filter.module' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'resources.filter.type' }),
    ).toBeInTheDocument();
  });

  it('filter labels use t() translation keys', () => {
    render(<ResourceFilters {...defaultProps} />);

    expect(
      screen.getByRole('combobox', { name: 'resources.filter.module' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'resources.filter.type' }),
    ).toBeInTheDocument();
  });
});
