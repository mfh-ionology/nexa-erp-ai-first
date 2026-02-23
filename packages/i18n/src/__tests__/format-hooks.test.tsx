import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Suspense, type ReactNode } from 'react';

import { I18nProvider } from '../I18nProvider.js';
import { i18n } from '../i18n-instance.js';
import {
  useFormatCurrency,
  useFormatNumber,
  useFormatDate,
  useFormatDateTime,
  useFormatPercent,
} from '../format-hooks.js';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <I18nProvider>{children}</I18nProvider>
    </Suspense>
  );
}

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

describe('useFormatCurrency', () => {
  it('returns a function', () => {
    const { result } = renderHook(() => useFormatCurrency(), {
      wrapper: Wrapper,
    });

    expect(typeof result.current).toBe('function');
  });

  it('formats GBP with £ symbol and correct grouping', () => {
    const { result } = renderHook(() => useFormatCurrency(), {
      wrapper: Wrapper,
    });

    const formatted = result.current(1234.56, 'GBP');
    expect(formatted).toContain('£');
    expect(formatted).toContain('1,234');
    expect(formatted).toContain('.56');
  });

  it('formats string amount from API the same as numeric', () => {
    const { result } = renderHook(() => useFormatCurrency(), {
      wrapper: Wrapper,
    });

    const fromString = result.current('1234.5600', 'GBP');
    const fromNumber = result.current(1234.56, 'GBP');
    expect(fromString).toBe(fromNumber);
  });

  it('respects minorUnit override for JPY (0 decimals)', () => {
    const { result } = renderHook(() => useFormatCurrency(), {
      wrapper: Wrapper,
    });

    const formatted = result.current(1234, 'JPY', { minorUnit: 0 });
    expect(formatted).toContain('¥');
    expect(formatted).not.toContain('.');
  });

  it('returns empty string for NaN input', () => {
    const { result } = renderHook(() => useFormatCurrency(), {
      wrapper: Wrapper,
    });

    expect(result.current('not-a-number', 'GBP')).toBe('');
  });
});

describe('useFormatNumber', () => {
  it('returns a function', () => {
    const { result } = renderHook(() => useFormatNumber(), {
      wrapper: Wrapper,
    });

    expect(typeof result.current).toBe('function');
  });

  it('formats numbers with locale thousands separator', () => {
    const { result } = renderHook(() => useFormatNumber(), {
      wrapper: Wrapper,
    });

    const formatted = result.current(1234.56);
    expect(formatted).toContain('1,234');
    expect(formatted).toContain('.56');
  });

  it('accepts Intl.NumberFormatOptions overrides', () => {
    const { result } = renderHook(() => useFormatNumber(), {
      wrapper: Wrapper,
    });

    const formatted = result.current(1234.5, { minimumFractionDigits: 2 });
    expect(formatted).toBe('1,234.50');
  });
});

describe('useFormatDate', () => {
  it('returns a function', () => {
    const { result } = renderHook(() => useFormatDate(), {
      wrapper: Wrapper,
    });

    expect(typeof result.current).toBe('function');
  });

  it('formats date in short format with current locale', () => {
    const { result } = renderHook(() => useFormatDate(), {
      wrapper: Wrapper,
    });

    const formatted = result.current('2026-02-17', 'short');
    // 'en' locale short format contains day, month, year components
    expect(formatted).toContain('2026');
    expect(formatted).toContain('17');
    expect(formatted).toContain('02');
  });

  it('formats date in medium format', () => {
    const { result } = renderHook(() => useFormatDate(), {
      wrapper: Wrapper,
    });

    const formatted = result.current('2026-02-17', 'medium');
    expect(formatted).toContain('Feb');
    expect(formatted).toContain('2026');
  });

  it('formats date in long format', () => {
    const { result } = renderHook(() => useFormatDate(), {
      wrapper: Wrapper,
    });

    const formatted = result.current('2026-02-17', 'long');
    expect(formatted).toContain('February');
    expect(formatted).toContain('2026');
  });

  it('accepts Date objects', () => {
    const { result } = renderHook(() => useFormatDate(), {
      wrapper: Wrapper,
    });

    const formatted = result.current(new Date('2026-02-17'));
    expect(formatted).toContain('2026');
  });

  it('returns empty string for invalid date', () => {
    const { result } = renderHook(() => useFormatDate(), {
      wrapper: Wrapper,
    });

    expect(result.current('not-a-date')).toBe('');
  });
});

describe('useFormatDateTime', () => {
  it('returns a function', () => {
    const { result } = renderHook(() => useFormatDateTime(), {
      wrapper: Wrapper,
    });

    expect(typeof result.current).toBe('function');
  });

  it('includes time component in formatted output', () => {
    const { result } = renderHook(() => useFormatDateTime(), {
      wrapper: Wrapper,
    });

    const formatted = result.current('2026-02-17T10:30:00Z', 'short');
    // Must contain both date and time components
    expect(formatted).toContain('2026');
    // Time part — hours and minutes separated by colon
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });

  it('includes seconds in long format', () => {
    const { result } = renderHook(() => useFormatDateTime(), {
      wrapper: Wrapper,
    });

    const formatted = result.current('2026-02-17T10:30:45Z', 'long');
    // Long format includes seconds — at least two colon-separated groups
    expect(formatted).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });
});

describe('useFormatPercent', () => {
  it('returns a function', () => {
    const { result } = renderHook(() => useFormatPercent(), {
      wrapper: Wrapper,
    });

    expect(typeof result.current).toBe('function');
  });

  it('formats decimal as percentage', () => {
    const { result } = renderHook(() => useFormatPercent(), {
      wrapper: Wrapper,
    });

    const formatted = result.current(0.15);
    expect(formatted).toContain('15');
    expect(formatted).toContain('%');
  });

  it('respects fraction digit options', () => {
    const { result } = renderHook(() => useFormatPercent(), {
      wrapper: Wrapper,
    });

    const formatted = result.current(0.155, { minimumFractionDigits: 1 });
    expect(formatted).toContain('15.5');
    expect(formatted).toContain('%');
  });

  it('formats zero as 0%', () => {
    const { result } = renderHook(() => useFormatPercent(), {
      wrapper: Wrapper,
    });

    const formatted = result.current(0);
    expect(formatted).toContain('0');
    expect(formatted).toContain('%');
  });
});

// AC #1 and #2 require en-GB locale formatting. The I18nProvider resolves
// 'en-GB' to 'en' on mount (MVP only supports 'en'), so we change
// i18n.language to 'en-GB' AFTER mount to verify the hooks pass the
// locale through to the underlying Intl formatters correctly.
describe('with en-GB locale (AC verification)', () => {
  it('useFormatCurrency formats GBP as £1,234.56 (AC #1)', async () => {
    const { result } = renderHook(() => useFormatCurrency(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await i18n.changeLanguage('en-GB');
    });

    const formatted = result.current(1234.56, 'GBP');
    expect(formatted).toContain('£');
    expect(formatted).toContain('1,234.56');
  });

  it('useFormatDate formats as DD/MM/YYYY (AC #2)', async () => {
    const { result } = renderHook(() => useFormatDate(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await i18n.changeLanguage('en-GB');
    });

    expect(result.current('2026-02-17', 'short')).toBe('17/02/2026');
  });

  it('useFormatNumber formats with en-GB grouping', async () => {
    const { result } = renderHook(() => useFormatNumber(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await i18n.changeLanguage('en-GB');
    });

    expect(result.current(1234.56)).toBe('1,234.56');
  });

  it('useFormatDateTime includes UTC time', async () => {
    const { result } = renderHook(() => useFormatDateTime(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await i18n.changeLanguage('en-GB');
    });

    const formatted = result.current('2026-02-17T10:30:00Z', 'short');
    expect(formatted).toContain('17/02/2026');
    expect(formatted).toMatch(/10:30/);
  });
});
