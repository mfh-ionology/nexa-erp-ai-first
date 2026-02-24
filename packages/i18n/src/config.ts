import i18next, { type i18n, type InitOptions, type Resource } from 'i18next';

import type {
  CoreTranslationNamespace,
  SupportedLocale,
  TranslationNamespace,
} from './types.js';

/** Default locale — English. */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** Default translation namespace. */
export const DEFAULT_NAMESPACE: TranslationNamespace = 'common';

/** All locales supported in the current build (English-only for MVP). */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en'] as const;

/** Core translation namespaces shipped with the i18n package. */
export const TRANSLATION_NAMESPACES: readonly CoreTranslationNamespace[] = [
  'common',
  'validation',
  'navigation',
  'errors',
  'system',
  'mobile',
] as const;

/**
 * Check whether a locale string is in the supported set (exact match).
 */
export function isSupportedLocale(
  locale: string | undefined,
): locale is SupportedLocale {
  if (!locale) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

/**
 * Match a locale string to a supported locale, trying exact match
 * first then language-prefix match (e.g., 'en-GB' → 'en').
 *
 * Returns the matched SupportedLocale or undefined.
 */
export function matchSupportedLocale(
  locale: string | undefined,
): SupportedLocale | undefined {
  if (!locale) return undefined;
  if (isSupportedLocale(locale)) return locale;
  // Try language prefix (e.g., 'en-GB' → 'en')
  const langPrefix = locale.split('-')[0];
  if (langPrefix !== locale && isSupportedLocale(langPrefix)) return langPrefix;
  return undefined;
}

/**
 * Resolve the effective locale using the fallback chain:
 *   1. userLocale   (if set and supported, including prefix match)
 *   2. companyLocale (if set and supported, including prefix match)
 *   3. 'en'         (always available)
 *
 * Exported for standalone testing and reuse from non-React code
 * (e.g., SSR, backend utilities).
 */
export function resolveLocale(
  userLocale?: string,
  companyLocale?: string,
): SupportedLocale {
  return matchSupportedLocale(userLocale)
    ?? matchSupportedLocale(companyLocale)
    ?? 'en';
}

const isDev =
  typeof process !== 'undefined' &&
  process.env?.NODE_ENV !== 'production';

/**
 * Shared i18next init options — single source of truth consumed by
 * both `createI18nInstance()` and the singleton in `i18n-instance.ts`.
 */
export function buildInitOptions(overrides?: Partial<InitOptions>): InitOptions {
  return {
    lng: DEFAULT_LOCALE,
    fallbackLng: 'en',
    ns: [...TRANSLATION_NAMESPACES],
    defaultNS: DEFAULT_NAMESPACE,

    keySeparator: false, // navigation.json uses flat dotted keys like "finance.chartOfAccounts"

    interpolation: {
      escapeValue: false, // React handles XSS
    },

    returnNull: false,
    returnEmptyString: false,

    // Missing key handling — warn in dev, silent in prod
    saveMissing: isDev,
    missingKeyHandler: isDev
      ? (
          _lngs: readonly string[],
          ns: string,
          key: string,
          _fallbackValue: string,
          _updateMissing: boolean,
        ) => {
          console.warn(`[i18n] Missing key: ${ns}:${key}`);
        }
      : undefined,

    debug: false,

    ...overrides,
  };
}

/**
 * Create and return a fully configured i18next instance.
 *
 * Pass `resources` to pre-load translation bundles. Without resources
 * the instance initialises but `t()` calls will return raw keys — use
 * the pre-built singleton from `i18n-instance.ts` instead for production.
 */
export async function createI18nInstance(resources?: Resource): Promise<i18n> {
  const instance = i18next.createInstance();

  await instance.init(buildInitOptions(resources ? { resources } : undefined));

  return instance;
}
