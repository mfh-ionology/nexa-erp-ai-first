import { useTranslation } from 'react-i18next';

import type { TranslationNamespace } from './types.js';

// Re-export useTranslation with typed namespace support
export { useTranslation };
export type { TranslationNamespace };

/**
 * Convenience hook that returns `{ t, i18n, ready }` from `useTranslation()`.
 *
 * Optionally accepts a namespace (defaults to the configured defaultNS).
 */
export function useI18n(ns?: TranslationNamespace) {
  const { t, i18n, ready } = useTranslation(ns);
  return { t, i18n, ready };
}

/**
 * Returns the currently resolved locale string (e.g. `'en'`).
 */
export function useLocale(): string {
  const { i18n } = useTranslation();
  return i18n.language;
}
