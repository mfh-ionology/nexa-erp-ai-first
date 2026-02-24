import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Auto-cleanup rendered components after each test.
// Needed because vitest globals are disabled.
afterEach(() => {
  cleanup();
});

// --- Mock @nexa/i18n ---
// Returns the translation key as the value so tests can assert on keys.
vi.mock('@nexa/i18n', () => {
  const tFn = (key: string) => key;
  const mockI18n = {
    language: 'en',
    changeLanguage: vi.fn().mockResolvedValue(undefined),
    t: tFn,
  };

  return {
    // React provider — passthrough wrapper
    I18nProvider: ({ children }: { children: React.ReactNode }) => children,

    // Hooks
    useTranslation: () => ({ t: tFn, i18n: mockI18n, ready: true }),
    useI18n: () => ({ t: tFn, i18n: mockI18n, ready: true }),
    useLocale: () => 'en',

    // Format hooks — return identity functions
    useFormatCurrency: () => (amount: string | number) => String(amount),
    useFormatNumber: () => (value: number) => String(value),
    useFormatDate: () => (date: Date | string) => String(date),
    useFormatDateTime: () => (date: Date | string) => String(date),
    useFormatPercent: () => (value: number) => String(value),

    // Config exports
    i18n: mockI18n,
    i18nReady: Promise.resolve(),
    DEFAULT_LOCALE: 'en',
    DEFAULT_NAMESPACE: 'common',
    SUPPORTED_LOCALES: ['en'],
    TRANSLATION_NAMESPACES: ['common', 'validation', 'navigation', 'errors', 'system'],
    isSupportedLocale: () => true,
    matchSupportedLocale: () => 'en',
    resolveLocale: () => 'en',
    buildInitOptions: vi.fn(),
    createI18nInstance: vi.fn(),

    // Zod error map
    mapZodIssueToTranslationKey: () => ({ key: 'validation.required', params: {} }),
  };
});

// --- Mock ResizeObserver ---
// jsdom does not implement ResizeObserver; Radix UI components require it.
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// --- Mock window.matchMedia ---
// Required for components that use responsive media queries.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
