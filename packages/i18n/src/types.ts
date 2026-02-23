/** Supported locale codes (BCP 47). English-only for MVP. */
export type SupportedLocale = 'en';

/**
 * Core translation namespaces shipped with @nexa/i18n.
 *
 * Business modules add their own namespaces (e.g., 'finance', 'sales', 'ar')
 * by extending this type via the `TranslationNamespace` union below.
 */
export type CoreTranslationNamespace =
  | 'common'
  | 'validation'
  | 'navigation'
  | 'errors'
  | 'system';

/**
 * All translation namespaces. Extensible — business module epics add
 * their own namespaces by extending this union in this file:
 *
 * ```typescript
 * export type TranslationNamespace = CoreTranslationNamespace | 'finance' | 'sales';
 * ```
 *
 * Runtime namespace registration via i18next.addResourceBundle() works
 * independently of this type (it accepts plain strings).
 */
export type TranslationNamespace = CoreTranslationNamespace;

/** Parameters passed to `t()` for interpolation. */
export type TranslationParams = Record<string, string | number>;

/**
 * Structured translation message for backend → frontend / persistence.
 *
 * Used for API error responses, audit log entries, and notification payloads.
 * `params` uses `Record<string, string>` (not `string | number`) because backend
 * messages are serialised to JSON. Numbers must be formatted with locale-aware
 * formatters on the client.
 */
export interface TranslationMessage {
  key: string;
  params?: Record<string, string>;
}

/** Fallback chain configuration for locale resolution. */
export interface FallbackConfig {
  userLocale?: string;
  companyLocale?: string;
  defaultLocale: 'en';
}
