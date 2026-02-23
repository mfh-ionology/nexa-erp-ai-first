import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const LOCALES_DIR = resolve(import.meta.dirname, '../../locales');

// Read all locale directories (currently just 'en')
const localeDirs = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

// Read all JSON files for a given locale
function readLocaleFiles(locale: string): Record<string, Record<string, string>> {
  const localeDir = join(LOCALES_DIR, locale);
  const files = readdirSync(localeDir).filter((f) => f.endsWith('.json'));
  const result: Record<string, Record<string, string>> = {};

  for (const file of files) {
    const namespace = file.replace('.json', '');
    const content = readFileSync(join(localeDir, file), 'utf-8');
    result[namespace] = JSON.parse(content);
  }

  return result;
}

describe('locale files', () => {
  describe('JSON validity', () => {
    for (const locale of localeDirs) {
      const localeDir = join(LOCALES_DIR, locale);
      const files = readdirSync(localeDir).filter((f) => f.endsWith('.json'));

      for (const file of files) {
        it(`${locale}/${file} is valid JSON`, () => {
          const content = readFileSync(join(localeDir, file), 'utf-8');
          expect(() => JSON.parse(content)).not.toThrow();
        });
      }
    }
  });

  describe('no empty string values', () => {
    for (const locale of localeDirs) {
      const namespaces = readLocaleFiles(locale);

      for (const [namespace, translations] of Object.entries(namespaces)) {
        it(`${locale}/${namespace}.json has no empty string values`, () => {
          for (const [key, value] of Object.entries(translations)) {
            expect(value, `Key "${key}" in ${locale}/${namespace}.json is empty`).not.toBe('');
          }
        });
      }
    }
  });

  describe('key naming convention', () => {
    for (const locale of localeDirs) {
      const namespaces = readLocaleFiles(locale);

      for (const [namespace, translations] of Object.entries(namespaces)) {
        it(`${locale}/${namespace}.json keys follow camelCase convention`, () => {
          for (const key of Object.keys(translations)) {
            // Keys should be camelCase, SCREAMING_SNAKE_CASE (for error codes),
            // or camelCase with i18next plural suffix (_one, _other, _zero, _few, _many, _two)
            const isCamelCase = /^[a-z][a-zA-Z0-9]*$/.test(key);
            const isScreamingSnakeCase = /^[A-Z][A-Z0-9_]*$/.test(key);
            const isCamelCaseWithPluralSuffix = /^[a-z][a-zA-Z0-9]*_(one|other|zero|few|many|two)$/.test(key);

            expect(
              isCamelCase || isScreamingSnakeCase || isCamelCaseWithPluralSuffix,
              `Key "${key}" in ${locale}/${namespace}.json does not follow camelCase, SCREAMING_SNAKE_CASE, or camelCase_pluralSuffix convention`,
            ).toBe(true);
          }
        });
      }
    }
  });

  describe('consistent key structure across locales', () => {
    it('all locales have the same namespace files', () => {
      if (localeDirs.length <= 1) {
        // Only one locale (en) for MVP — skip cross-locale comparison
        expect(localeDirs).toContain('en');
        return;
      }

      const referenceLocale = localeDirs[0]!;
      const referenceNamespaces = Object.keys(readLocaleFiles(referenceLocale)).sort();

      for (const locale of localeDirs.slice(1)) {
        const namespaces = Object.keys(readLocaleFiles(locale)).sort();
        expect(namespaces, `${locale} has different namespaces than ${referenceLocale}`).toEqual(
          referenceNamespaces,
        );
      }
    });

    it('all locales have the same keys within each namespace', () => {
      if (localeDirs.length <= 1) {
        // Only one locale (en) for MVP — skip cross-locale comparison
        expect(localeDirs).toContain('en');
        return;
      }

      const referenceLocale = localeDirs[0]!;
      const referenceData = readLocaleFiles(referenceLocale);

      for (const locale of localeDirs.slice(1)) {
        const localeData = readLocaleFiles(locale);

        for (const [namespace, referenceKeys] of Object.entries(referenceData)) {
          const localeKeys = localeData[namespace] ?? {};
          const missingKeys = Object.keys(referenceKeys).filter(
            (k) => !(k in localeKeys),
          );
          const extraKeys = Object.keys(localeKeys).filter(
            (k) => !(k in referenceKeys),
          );

          expect(
            missingKeys,
            `${locale}/${namespace}.json is missing keys: ${missingKeys.join(', ')}`,
          ).toEqual([]);
          expect(
            extraKeys,
            `${locale}/${namespace}.json has extra keys: ${extraKeys.join(', ')}`,
          ).toEqual([]);
        }
      }
    });
  });

  describe('expected namespaces exist', () => {
    it('en locale has common, validation, navigation, errors, and system namespaces', () => {
      const namespaces = readLocaleFiles('en');
      expect(Object.keys(namespaces).sort()).toEqual([
        'common',
        'errors',
        'navigation',
        'system',
        'validation',
      ]);
    });
  });

  describe('expected keys exist in en locale', () => {
    const enData = readLocaleFiles('en');

    it('common.json has core UI labels', () => {
      const common = enData.common;
      const expectedKeys = [
        'save', 'cancel', 'delete', 'confirm', 'create', 'edit',
        'close', 'back', 'next', 'search', 'filter', 'loading',
        'submit', 'reset', 'yes', 'no', 'actions', 'status',
      ];
      for (const key of expectedKeys) {
        expect(common, `Missing key "${key}" in common.json`).toHaveProperty(key);
      }
    });

    it('validation.json has validation message templates', () => {
      const validation = enData.validation;
      const expectedKeys = [
        'required', 'minLength', 'maxLength', 'email',
        'numeric', 'positive', 'integer', 'unique',
      ];
      for (const key of expectedKeys) {
        expect(validation, `Missing key "${key}" in validation.json`).toHaveProperty(key);
      }
    });

    it('navigation.json has module navigation labels', () => {
      const navigation = enData.navigation;
      const expectedKeys = [
        'dashboard', 'system', 'settings', 'users',
        'finance', 'sales', 'purchasing', 'inventory',
      ];
      for (const key of expectedKeys) {
        expect(navigation, `Missing key "${key}" in navigation.json`).toHaveProperty(key);
      }
    });

    it('errors.json has error code messages', () => {
      const errors = enData.errors;
      const expectedKeys = [
        'AUTH_INVALID_CREDENTIALS', 'AUTH_TOKEN_EXPIRED',
        'NOT_FOUND', 'SERVER_ERROR',
        'NETWORK_ERROR', 'VALIDATION_ERROR',
      ];
      for (const key of expectedKeys) {
        expect(errors, `Missing key "${key}" in errors.json`).toHaveProperty(key);
      }
    });
  });

  describe('value types', () => {
    for (const locale of localeDirs) {
      const namespaces = readLocaleFiles(locale);

      for (const [namespace, translations] of Object.entries(namespaces)) {
        it(`${locale}/${namespace}.json values are all strings`, () => {
          for (const [key, value] of Object.entries(translations)) {
            expect(
              typeof value,
              `Key "${key}" in ${locale}/${namespace}.json is not a string (got ${typeof value})`,
            ).toBe('string');
          }
        });
      }
    }
  });
});
