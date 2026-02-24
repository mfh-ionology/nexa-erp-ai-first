/**
 * i18n setup for the web application.
 *
 * The @nexa/i18n package pre-configures:
 * - react-i18next integration (initReactI18next plugin)
 * - Bundled English resources for namespaces: common, validation, navigation, errors, system
 * - Default locale: 'en', fallback: 'en'
 * - Missing key warnings in development
 *
 * This module detects the browser locale, resolves it against supported
 * locales, and applies it to the shared i18n instance.
 */
import { i18n, i18nReady, resolveLocale } from '@nexa/i18n';

/**
 * Detect the user's preferred locale from browser settings.
 * Returns the raw navigator.language string (e.g., 'en-GB', 'fr').
 * Falls back to 'en' when navigator is unavailable (e.g., SSR).
 */
function detectBrowserLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en';
}

/**
 * Initialise the i18n instance for the web application.
 *
 * Call this once at application startup (before React renders) to:
 * 1. Wait for the i18n singleton to finish loading resources
 * 2. Detect the browser locale and apply it if supported
 *
 * User preference locale (from Zustand preferences store) can override
 * the browser locale reactively via I18nProvider's `userLocale` prop.
 */
export async function initI18n(): Promise<void> {
  await i18nReady;

  const browserLocale = detectBrowserLocale();
  const resolved = resolveLocale(browserLocale);

  if (i18n.language !== resolved) {
    await i18n.changeLanguage(resolved);
  }
}

export { i18n, i18nReady };
