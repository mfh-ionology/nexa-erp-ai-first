import type { TranslationMessage } from './types.js';

/**
 * Construct a validation translation message.
 * Prepends `validation:` namespace prefix if not already present.
 *
 * @example
 * validationMsg('required', { field: 'email' })
 * // → { key: 'validation:required', params: { field: 'email' } }
 */
export function validationMsg(
  key: string,
  params?: Record<string, string>,
): TranslationMessage {
  return {
    key: key.includes(':') ? key : `validation:${key}`,
    params,
  };
}

/**
 * Construct an error translation message.
 * Prepends `errors:` namespace prefix if not already present.
 *
 * @example
 * errorMsg('AUTH_INVALID_CREDENTIALS')
 * // → { key: 'errors:AUTH_INVALID_CREDENTIALS' }
 */
export function errorMsg(
  key: string,
  params?: Record<string, string>,
): TranslationMessage {
  return {
    key: key.includes(':') ? key : `errors:${key}`,
    params,
  };
}

/**
 * Construct a system/audit translation message.
 * Prepends `system:` namespace prefix if not already present.
 *
 * Used for audit log descriptions, notification text, and other system-generated
 * messages that are distinct from UI labels (common:) and error codes (errors:).
 *
 * @example
 * systemMsg('user.created', { email: 'a@b.com' })
 * // → { key: 'system:user.created', params: { email: 'a@b.com' } }
 */
export function systemMsg(
  key: string,
  params?: Record<string, string>,
): TranslationMessage {
  return {
    key: key.includes(':') ? key : `system:${key}`,
    params,
  };
}
