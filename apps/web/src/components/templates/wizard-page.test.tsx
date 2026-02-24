import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { WizardPage } from './wizard-page';
import type { WizardStep } from './types';

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

const mockSteps: WizardStep[] = [
  { key: 'company', labelKey: 'wizard.companyInfo', content: <div>Company info form</div> },
  { key: 'settings', labelKey: 'wizard.settings', content: <div>Settings form</div> },
  { key: 'review', labelKey: 'wizard.review', content: <div>Review content</div> },
];

const defaultProps = {
  title: 'Company Setup',
  breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Setup' }],
  steps: mockSteps,
  activeStep: 0,
};

describe('WizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step indicator with step labels', () => {
    render(<WizardPage {...defaultProps} />);

    expect(screen.getByText('wizard.companyInfo')).toBeInTheDocument();
    expect(screen.getByText('wizard.settings')).toBeInTheDocument();
    expect(screen.getByText('wizard.review')).toBeInTheDocument();
  });

  it('renders current step content', () => {
    render(<WizardPage {...defaultProps} />);

    expect(screen.getByText('Company info form')).toBeInTheDocument();
  });

  it('Next button calls onNext', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();

    render(<WizardPage {...defaultProps} onNext={onNext} />);

    await user.click(screen.getByText('nextStep'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('Back button calls onBack (hidden on first step)', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    const { rerender } = render(
      <WizardPage {...defaultProps} activeStep={0} onBack={onBack} />,
    );

    // Back button should not be visible on first step
    expect(screen.queryByText('previousStep')).not.toBeInTheDocument();

    // On step 2, Back should be visible
    rerender(
      <WizardPage {...defaultProps} activeStep={1} onBack={onBack} />,
    );

    await user.click(screen.getByText('previousStep'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Complete button shown on last step', () => {
    render(
      <WizardPage {...defaultProps} activeStep={2} onComplete={vi.fn()} />,
    );

    expect(screen.getByText('complete')).toBeInTheDocument();
    expect(screen.queryByText('nextStep')).not.toBeInTheDocument();
  });

  it('Complete button calls onComplete', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    render(
      <WizardPage {...defaultProps} activeStep={2} onComplete={onComplete} />,
    );

    await user.click(screen.getByText('complete'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('Next button disabled when isCurrentStepValid === false', () => {
    render(
      <WizardPage {...defaultProps} isCurrentStepValid={false} onNext={vi.fn()} />,
    );

    const nextButton = screen.getByText('nextStep').closest('button');
    expect(nextButton).toBeDisabled();
  });

  it('has semantic main landmark with aria-label', () => {
    render(<WizardPage {...defaultProps} />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-label', 'Company Setup');
  });

  it('step indicator has aria-current on active step', () => {
    render(<WizardPage {...defaultProps} activeStep={1} />);

    const currentStep = document.querySelector('[aria-current="step"]');
    expect(currentStep).toBeTruthy();
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<WizardPage {...defaultProps} isLoading />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
  });
});
