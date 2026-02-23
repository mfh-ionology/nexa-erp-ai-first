import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Suspense } from 'react';

import { I18nProvider } from '../I18nProvider.js';
import { useI18n, useLocale } from '../hooks.js';
import { i18n } from '../i18n-instance.js';

// Helper component that displays a translated string
function TranslatedLabel({ tKey }: { tKey: string }) {
  const { t } = useI18n();
  return <span data-testid="label">{t(tKey)}</span>;
}

// Helper component that displays the resolved locale
function LocaleDisplay() {
  const locale = useLocale();
  return <span data-testid="locale">{locale}</span>;
}

// Helper component that displays t, i18n, ready
function HookResult() {
  const { t, i18n: inst, ready } = useI18n();
  return (
    <div>
      <span data-testid="t-type">{typeof t}</span>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="lang">{inst.language}</span>
    </div>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>;
}

afterEach(async () => {
  // Reset to default locale after each test
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

describe('I18nProvider', () => {
  it('renders children', () => {
    render(
      <Wrapper>
        <I18nProvider>
          <span data-testid="child">Hello</span>
        </I18nProvider>
      </Wrapper>,
    );

    expect(screen.getByTestId('child').textContent).toBe('Hello');
  });

  it('provides a working t() function via useI18n()', () => {
    render(
      <Wrapper>
        <I18nProvider>
          <TranslatedLabel tKey="save" />
        </I18nProvider>
      </Wrapper>,
    );

    expect(screen.getByTestId('label').textContent).toBe('Save');
  });

  it('useI18n() returns t function, i18n instance, and ready flag', () => {
    render(
      <Wrapper>
        <I18nProvider>
          <HookResult />
        </I18nProvider>
      </Wrapper>,
    );

    expect(screen.getByTestId('t-type').textContent).toBe('function');
    expect(screen.getByTestId('ready').textContent).toBe('true');
    expect(screen.getByTestId('lang').textContent).toBe('en');
  });

  it('defaults to "en" when no locale props are provided', () => {
    render(
      <Wrapper>
        <I18nProvider>
          <LocaleDisplay />
        </I18nProvider>
      </Wrapper>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('resolves userLocale when provided and supported', () => {
    // Only 'en' is supported in MVP, so userLocale='en' should be used
    render(
      <Wrapper>
        <I18nProvider userLocale="en">
          <LocaleDisplay />
        </I18nProvider>
      </Wrapper>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('falls back to companyLocale when userLocale is unsupported', () => {
    render(
      <Wrapper>
        <I18nProvider userLocale="fr" companyLocale="en">
          <LocaleDisplay />
        </I18nProvider>
      </Wrapper>,
    );

    // 'fr' is not supported, so falls back to companyLocale 'en'
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('falls back to "en" when both userLocale and companyLocale are unsupported', () => {
    render(
      <Wrapper>
        <I18nProvider userLocale="fr" companyLocale="de">
          <LocaleDisplay />
        </I18nProvider>
      </Wrapper>,
    );

    // Neither 'fr' nor 'de' are supported, falls back to 'en'
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('falls back to "en" when no locale props are set', () => {
    render(
      <Wrapper>
        <I18nProvider>
          <LocaleDisplay />
        </I18nProvider>
      </Wrapper>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('translates interpolated strings correctly within provider', () => {
    function InterpolatedLabel() {
      const { t } = useI18n('validation');
      return (
        <span data-testid="interpolated">
          {t('required', { field: 'Customer Name' })}
        </span>
      );
    }

    render(
      <Wrapper>
        <I18nProvider>
          <InterpolatedLabel />
        </I18nProvider>
      </Wrapper>,
    );

    expect(screen.getByTestId('interpolated').textContent).toBe(
      'Customer Name is required',
    );
  });
});
