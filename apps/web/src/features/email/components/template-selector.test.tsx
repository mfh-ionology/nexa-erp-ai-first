/* eslint-disable i18next/no-literal-string */
// ---------------------------------------------------------------------------
// Frontend component tests — E10-3 Task 10.5 (TemplateSelector)
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { TemplateSelector } from './template-selector';

const templates = [
  { id: 'tpl-1', code: 'INVOICE_SEND', name: 'Invoice Send' },
  { id: 'tpl-2', code: 'INVOICE_REMINDER', name: 'Invoice Reminder' },
];

describe('TemplateSelector', () => {
  it('renders template dropdown and reset button', () => {
    render(
      <TemplateSelector
        templates={templates}
        isLoading={false}
        selectedTemplateId="tpl-1"
        onTemplateChange={vi.fn()}
        onResetToTemplate={vi.fn()}
      />,
    );

    expect(screen.getByText('Reset to Template')).toBeInTheDocument();
  });

  it('renders nothing when templates array is empty', () => {
    const { container } = render(
      <TemplateSelector
        templates={[]}
        isLoading={false}
        selectedTemplateId={undefined}
        onTemplateChange={vi.fn()}
        onResetToTemplate={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('shows skeleton when loading', () => {
    const { container } = render(
      <TemplateSelector
        templates={[]}
        isLoading={true}
        selectedTemplateId={undefined}
        onTemplateChange={vi.fn()}
        onResetToTemplate={vi.fn()}
      />,
    );

    // Skeleton component renders a div with animate-pulse
    expect(container.querySelector('[class*="animate-pulse"]')).toBeInTheDocument();
  });

  it('calls onResetToTemplate when reset button clicked', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <TemplateSelector
        templates={templates}
        isLoading={false}
        selectedTemplateId="tpl-1"
        onTemplateChange={vi.fn()}
        onResetToTemplate={onReset}
      />,
    );

    await user.click(screen.getByText('Reset to Template'));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
