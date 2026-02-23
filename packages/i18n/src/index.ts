// @nexa/i18n — Internationalisation package

// Types
export type {
  SupportedLocale,
  CoreTranslationNamespace,
  TranslationNamespace,
  TranslationParams,
  TranslationMessage,
  FallbackConfig,
} from './types.js';

// Configuration & constants
export {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  SUPPORTED_LOCALES,
  TRANSLATION_NAMESPACES,
  isSupportedLocale,
  matchSupportedLocale,
  resolveLocale,
  buildInitOptions,
  createI18nInstance,
} from './config.js';

// Singleton i18next instance (pre-configured with resources + React plugin)
export { i18n, i18nReady } from './i18n-instance.js';

// React provider
export { I18nProvider } from './I18nProvider.js';
export type { I18nProviderProps } from './I18nProvider.js';

// React hooks
export { useTranslation, useI18n, useLocale } from './hooks.js';

// Format hooks (locale-bound wrappers around @nexa/shared formatters)
export {
  useFormatCurrency,
  useFormatNumber,
  useFormatDate,
  useFormatDateTime,
  useFormatPercent,
} from './format-hooks.js';
