// @nexa/i18n/server — Backend-safe entry point (no React dependency)

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

// Backend message utilities
export { validationMsg, errorMsg, systemMsg } from './message-utils.js';

// Zod error → translation key mapping
export { mapZodIssueToTranslationKey } from './zod-error-map.js';

// Server-side i18n singleton
export { tServer, resolveMessage } from './server-instance.js';
