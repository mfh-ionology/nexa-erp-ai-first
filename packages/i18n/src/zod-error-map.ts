import type { TranslationMessage } from './types.js';

/**
 * Minimal Zod issue shape needed for translation mapping.
 * Compatible with Zod 4 issue types (uses `origin` for type context,
 * `format` for `invalid_format` issues).
 */
interface ZodIssueInput {
  code: string;
  message: string;
  path: PropertyKey[];
  minimum?: number | bigint;
  maximum?: number | bigint;
  /** Zod 4 uses `origin` (e.g. 'string', 'number') instead of Zod 3's `type`. */
  origin?: string;
  /** Zod 4 `invalid_format` issues carry a `format` field (e.g. 'email', 'regex'). */
  format?: string;
  /** Zod 3 compat — some code may pass `type` instead of `origin`. */
  type?: string;
  /** Zod 3 `invalid_string` uses `validation` (e.g. 'email', 'regex', 'url'). */
  validation?: string;
  /** The received value type (e.g. 'undefined', 'string', 'number'). */
  received?: string;
}

/**
 * Derive the field name from a Zod issue path.
 * Uses the last path segment, or '_root' if the path is empty.
 */
function deriveField(path: PropertyKey[]): string {
  if (path.length === 0) return '_root';
  return String(path[path.length - 1]);
}

/**
 * Check if a string looks like a translation key.
 * Matches the `namespace:key` pattern where the namespace is a simple
 * identifier (letters, digits, hyphens) — e.g. 'validation:unique'.
 * Rejects strings with colons that are natural language (e.g. "Error: something",
 * "Time: 10:30", "Expected format: YYYY-MM-DD").
 */
const TRANSLATION_KEY_RE = /^[a-z][a-z0-9-]*:[a-zA-Z][a-zA-Z0-9._]*$/;
function looksLikeTranslationKey(value: string): boolean {
  return TRANSLATION_KEY_RE.test(value);
}

/**
 * Get the origin type from the issue, handling both Zod 4 (`origin`)
 * and fallback (`type`) fields.
 */
function getOrigin(issue: ZodIssueInput): string | undefined {
  return issue.origin ?? issue.type;
}

/**
 * Map a Zod issue to a TranslationMessage.
 *
 * Returns `{ key: 'validation:<rule>', params: { field, min, max, ... } }`.
 * Does NOT call `tServer()` — translation resolution happens at the call site.
 *
 * Mapping table (Zod 4 issue codes → translation keys):
 * | Zod Issue Code                     | Translation Key        | Params           |
 * |------------------------------------|------------------------|------------------|
 * | `too_small` (origin: string)       | `validation:minLength` | `{ field, min }` |
 * | `too_small` (origin: number)       | `validation:min`       | `{ field, min }` |
 * | `too_big` (origin: string)         | `validation:maxLength` | `{ field, max }` |
 * | `too_big` (origin: number)         | `validation:max`       | `{ field, max }` |
 * | `invalid_type` (received undef)    | `validation:required`  | `{ field }`      |
 * | `invalid_type` (type mismatch)     | `validation:invalid`   | `{ field }`      |
 * | `invalid_format` (format: email)   | `validation:email`     | `{ field }`      |
 * | `invalid_format` (format: regex)   | `validation:pattern`   | `{ field }`      |
 * | `invalid_string` (email)           | `validation:email`     | `{ field }`      |
 * | `invalid_string` (regex)           | `validation:pattern`   | `{ field }`      |
 * | `custom` (msg with `:` separator)  | uses message as key    | `{ field }`      |
 * | `custom` (non-key msg)             | `validation:invalid`   | `{ field }`      |
 * | (other)                            | `validation:invalid`   | `{ field }`      |
 */
export function mapZodIssueToTranslationKey(issue: ZodIssueInput): TranslationMessage {
  const field = deriveField(issue.path);
  const origin = getOrigin(issue);

  switch (issue.code) {
    case 'too_small': {
      if (origin === 'string') {
        return {
          key: 'validation:minLength',
          params: { field, min: String(issue.minimum ?? 0) },
        };
      }
      // number, array, date, etc.
      return {
        key: 'validation:min',
        params: { field, min: String(issue.minimum ?? 0) },
      };
    }

    case 'too_big': {
      if (origin === 'string') {
        return {
          key: 'validation:maxLength',
          params: { field, max: String(issue.maximum ?? 0) },
        };
      }
      // number, array, date, etc.
      return {
        key: 'validation:max',
        params: { field, max: String(issue.maximum ?? 0) },
      };
    }

    case 'invalid_type': {
      // When the received value is undefined/null → required field
      // Otherwise it's a genuine type mismatch (e.g. string where number expected)
      if (!issue.received || issue.received === 'undefined' || issue.received === 'null') {
        return {
          key: 'validation:required',
          params: { field },
        };
      }
      return {
        key: 'validation:invalid',
        params: { field },
      };
    }

    // Zod 4 uses `invalid_format` with a `format` field for email, regex, etc.
    case 'invalid_format': {
      if (issue.format === 'email') {
        return {
          key: 'validation:email',
          params: { field },
        };
      }
      if (issue.format === 'regex') {
        return {
          key: 'validation:pattern',
          params: { field },
        };
      }
      return {
        key: 'validation:invalid',
        params: { field },
      };
    }

    // Zod 3 compat — `invalid_string` with email/regex validation.
    // Zod 3 uses `validation` field (e.g. 'email', 'regex'), Zod 4 uses `origin`.
    case 'invalid_string': {
      const validation = issue.validation ?? origin;
      if (validation === 'email') {
        return {
          key: 'validation:email',
          params: { field },
        };
      }
      if (validation === 'regex') {
        return {
          key: 'validation:pattern',
          params: { field },
        };
      }
      return {
        key: 'validation:invalid',
        params: { field },
      };
    }

    case 'custom': {
      if (looksLikeTranslationKey(issue.message)) {
        return {
          key: issue.message,
          params: { field },
        };
      }
      return {
        key: 'validation:invalid',
        params: { field },
      };
    }

    default: {
      return {
        key: 'validation:invalid',
        params: { field },
      };
    }
  }
}
