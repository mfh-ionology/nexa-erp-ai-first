/* eslint-disable i18next/no-literal-string */
import { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Polyfill scrollIntoView (jsdom doesn't implement it) ---
Element.prototype.scrollIntoView = vi.fn();

// --- Mock useAiVariables ---
const mockUseAiVariables = vi.fn();
vi.mock('../../api/use-ai-variables', () => ({
  useAiVariables: () => mockUseAiVariables(),
}));

function setupMocks(
  apiVariables: Record<string, { variableName: string; displayName: string }[]> | null = null,
) {
  mockUseAiVariables.mockReturnValue({ data: apiVariables });
}

// We need a stateful wrapper because the component is controlled
let WrappedTextarea: React.ComponentType<{
  initialValue?: string;
  onChangeSpy?: (v: string) => void;
  stepIndex?: number;
  stepCount?: number;
}>;

async function loadComponent() {
  const { VariableAutocompleteTextarea } = await import('./variable-autocomplete-textarea');

  WrappedTextarea = function Wrapper({
    initialValue = '',
    onChangeSpy,
    stepIndex = 0,
    stepCount = 1,
  }) {
    const [value, setValue] = useState(initialValue);
    const handleChange = (v: string) => {
      setValue(v);
      onChangeSpy?.(v);
    };
    return (
      <VariableAutocompleteTextarea
        value={value}
        onChange={handleChange}
        stepIndex={stepIndex}
        stepCount={stepCount}
      />
    );
  };
}

async function renderTextarea(
  props: {
    initialValue?: string;
    onChangeSpy?: (v: string) => void;
    stepIndex?: number;
    stepCount?: number;
  } = {},
) {
  if (!WrappedTextarea) await loadComponent();
  return render(<WrappedTextarea {...props} />);
}

/**
 * Simulate typing text containing `{` characters into the textarea.
 * userEvent.type interprets `{` as special key; this helper uses
 * fireEvent.change which works correctly with literal braces.
 */
function typeIntoTextarea(textarea: HTMLTextAreaElement, text: string) {
  // Simulate typing character-by-character to trigger handleInput
  // Build up the value incrementally
  let currentValue = textarea.value;
  for (const char of text) {
    currentValue += char;
    // Set selectionStart before firing the event so the handler can read it
    Object.defineProperty(textarea, 'selectionStart', {
      value: currentValue.length,
      writable: true,
      configurable: true,
    });
    fireEvent.change(textarea, { target: { value: currentValue } });
  }
}

describe('VariableAutocompleteTextarea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // --- Basic rendering ---

  describe('rendering', () => {
    it('renders a textarea element', async () => {
      await renderTextarea();

      const textarea = document.querySelector('textarea');
      expect(textarea).toBeTruthy();
    });

    it('displays the current value', async () => {
      await renderTextarea({ initialValue: 'Hello world' });

      const textarea = document.querySelector('textarea');
      expect(textarea).toHaveValue('Hello world');
    });

    it('does not show dropdown initially', async () => {
      await renderTextarea();

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  // --- Autocomplete trigger ---

  describe('autocomplete trigger', () => {
    it('typing {{ opens the autocomplete dropdown', async () => {
      await renderTextarea();

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('shows system variables in the dropdown', async () => {
      await renderTextarea();

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{');

      await waitFor(() => {
        expect(screen.getByText(/\{\{today\}\}/)).toBeInTheDocument();
        expect(screen.getByText(/\{\{company\.name\}\}/)).toBeInTheDocument();
      });
    });

    it('shows "System" group header', async () => {
      await renderTextarea();

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{');

      await waitFor(() => {
        // "System" appears as group header + in badge text on each item
        const systemElements = screen.getAllByText('System');
        expect(systemElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('dropdown closes when Escape is pressed', async () => {
      await renderTextarea();

      const textarea = document.querySelector('textarea')!;
      textarea.focus();
      typeIntoTextarea(textarea, '{{');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Fire keydown for Escape
      fireEvent.keyDown(textarea, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  // --- Selecting a variable ---

  describe('variable selection', () => {
    it('clicking a variable inserts it at cursor position', async () => {
      const user = userEvent.setup();
      const onChangeSpy = vi.fn();
      await renderTextarea({ onChangeSpy });

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click the "today" variable option
      const todayOption = screen.getByText(/\{\{today\}\}/).closest('button');
      expect(todayOption).toBeTruthy();
      await user.click(todayOption!);

      // After selection, onChange should have been called with {{today}}
      const lastCallValue = onChangeSpy.mock.calls.at(-1)?.[0];
      expect(lastCallValue).toContain('{{today}}');
    });

    it('pressing Enter selects variable and closes dropdown', async () => {
      await renderTextarea();

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Press Enter to select the first item
      fireEvent.keyDown(textarea, { key: 'Enter' });

      // Dropdown should close after selection
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  // --- Previous step variables ---

  describe('previous step variables', () => {
    it('shows previous step variables when stepIndex > 0', async () => {
      await renderTextarea({ stepIndex: 2, stepCount: 3 });

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{');

      await waitFor(() => {
        // "Previous Steps" appears as group header + in badge text on each item
        const prevStepElements = screen.getAllByText('Previous Steps');
        expect(prevStepElements.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/\{\{step1\.output\.\*\}\}/)).toBeInTheDocument();
        expect(screen.getByText(/\{\{step2\.output\.\*\}\}/)).toBeInTheDocument();
      });
    });

    it('shows no previous step variables when stepIndex is 0', async () => {
      await renderTextarea({ stepIndex: 0, stepCount: 1 });

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      expect(screen.queryByText('Previous Steps')).not.toBeInTheDocument();
      expect(screen.queryByText(/step1\.output/)).not.toBeInTheDocument();
    });

    it('dynamically reflects step count (step 4 of 5 shows 3 previous)', async () => {
      await renderTextarea({ stepIndex: 3, stepCount: 5 });

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{');

      await waitFor(() => {
        expect(screen.getByText(/\{\{step1\.output\.\*\}\}/)).toBeInTheDocument();
        expect(screen.getByText(/\{\{step2\.output\.\*\}\}/)).toBeInTheDocument();
        expect(screen.getByText(/\{\{step3\.output\.\*\}\}/)).toBeInTheDocument();
      });

      // Should NOT show step4 (we are step 4)
      expect(screen.queryByText(/\{\{step4\.output/)).not.toBeInTheDocument();
    });
  });

  // --- Filtering ---

  describe('filtering', () => {
    it('typing after {{ filters the variable list', async () => {
      await renderTextarea();

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{comp');

      await waitFor(() => {
        // "company.name" and "company.baseCurrency" should match
        expect(screen.getByText(/\{\{company\.name\}\}/)).toBeInTheDocument();
        expect(screen.getByText(/\{\{company\.baseCurrency\}\}/)).toBeInTheDocument();
      });

      // "today" should not be visible (filtered out)
      expect(screen.queryByText(/\{\{today\}\}/)).not.toBeInTheDocument();
    });

    it('shows "No matching variables" when filter has no matches', async () => {
      await renderTextarea();

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{zzzznonexistent');

      await waitFor(() => {
        expect(screen.getByText('No matching variables')).toBeInTheDocument();
      });
    });
  });

  // --- API variables ---

  describe('api variables', () => {
    it('includes variables from the API in the dropdown', async () => {
      setupMocks({
        constant: [{ variableName: 'default_currency', displayName: 'Default Currency' }],
      });

      await renderTextarea();

      const textarea = document.querySelector('textarea')!;
      typeIntoTextarea(textarea, '{{');

      await waitFor(() => {
        expect(screen.getByText(/\{\{default_currency\}\}/)).toBeInTheDocument();
        // "Constants" appears as group header + in badge text on the item
        const constantElements = screen.getAllByText('Constants');
        expect(constantElements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
