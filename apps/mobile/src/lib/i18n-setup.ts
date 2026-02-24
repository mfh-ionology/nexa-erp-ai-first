/**
 * i18n setup for the React Native mobile application.
 *
 * The @nexa/i18n package pre-configures:
 * - react-i18next integration (initReactI18next plugin)
 * - Bundled English resources for namespaces: common, validation, navigation, errors, system
 * - Default locale: 'en', fallback: 'en'
 * - Missing key warnings in development
 *
 * This module adds the mobile-specific namespace and exposes
 * an init function to call before React renders.
 */
import { i18n, i18nReady } from '@nexa/i18n';

import mobileEn from '@nexa/i18n/locales/en/mobile.json';

/**
 * Initialise i18n for the mobile application.
 *
 * Call once at app startup (before React renders) to:
 * 1. Wait for the shared i18n singleton to finish loading core resources
 * 2. Add the mobile-specific namespace resource bundle
 */
export async function initMobileI18n(): Promise<void> {
  await i18nReady;

  // Add mobile-specific translations (not bundled in the shared instance)
  i18n.addResourceBundle('en', 'mobile', mobileEn, true, true);
}

export { i18n, i18nReady };
