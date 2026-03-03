// @nexa/i18n server-side singleton — NO React dependency.
// Backend counterpart to i18n-instance.ts (which uses initReactI18next).

import i18next from 'i18next';

import { buildInitOptions } from './config.js';
import type { TranslationMessage } from './types.js';

// Bundled locale files — same source of truth as the frontend singleton
import commonEn from '../locales/en/common.json';
import validationEn from '../locales/en/validation.json';
import navigationEn from '../locales/en/navigation.json';
import errorsEn from '../locales/en/errors.json';
import systemEn from '../locales/en/system.json';
import aiEn from '../locales/en/ai.json';

/**
 * Server-side i18next instance with bundled English resources.
 *
 * Uses `initImmediate: false` so the instance is ready synchronously
 * after module load (no async await required). This is safe because
 * all resources are bundled — there is no HTTP backend to wait for.
 */
const serverInstance = i18next.createInstance();

// initImmediate: false makes init synchronous (all resources are bundled, no HTTP).
// We still catch the returned Promise to surface any config errors at startup.
serverInstance
  .init(
    buildInitOptions({
      initImmediate: false,
      resources: {
        en: {
          common: commonEn,
          validation: validationEn,
          navigation: navigationEn,
          errors: errorsEn,
          system: systemEn,
          ai: aiEn,
        },
      },
    }),
  )
  .catch((err: unknown) => {
    // Surface init errors instead of silently swallowing them
    console.error('[i18n] Server instance initialization failed:', err);
  });

/**
 * Resolve a translation key to an English string on the server.
 *
 * @example
 * tServer('errors:AUTH_INVALID_CREDENTIALS')
 * // → 'Invalid email or password'
 *
 * tServer('validation:required', { field: 'Email' })
 * // → 'Email is required'
 */
export function tServer(key: string, params?: Record<string, string>): string {
  return serverInstance.t(key, params) as string;
}

/**
 * Resolve a `TranslationMessage` to an English string on the server.
 *
 * @example
 * resolveMessage({ key: 'errors:AUTH_INVALID_CREDENTIALS' })
 * // → 'Invalid email or password'
 */
export function resolveMessage(msg: TranslationMessage): string {
  return tServer(msg.key, msg.params);
}
