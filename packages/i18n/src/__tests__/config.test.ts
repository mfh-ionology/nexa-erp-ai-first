import { describe, it, expect } from 'vitest';

import { isSupportedLocale, matchSupportedLocale, resolveLocale } from '../config.js';

describe('isSupportedLocale()', () => {
  it('returns true for "en"', () => {
    expect(isSupportedLocale('en')).toBe(true);
  });

  it('returns false for undefined', () => {
    expect(isSupportedLocale(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSupportedLocale('')).toBe(false);
  });

  it('returns false for unsupported locale "fr"', () => {
    expect(isSupportedLocale('fr')).toBe(false);
  });

  it('returns false for "en-GB" (exact match only)', () => {
    // isSupportedLocale is exact-match — use matchSupportedLocale for prefix matching
    expect(isSupportedLocale('en-GB')).toBe(false);
  });

  it('returns false for "EN" (case-sensitive match)', () => {
    expect(isSupportedLocale('EN')).toBe(false);
  });
});

describe('matchSupportedLocale()', () => {
  it('returns "en" for exact match "en"', () => {
    expect(matchSupportedLocale('en')).toBe('en');
  });

  it('returns "en" for language-prefix match "en-GB"', () => {
    expect(matchSupportedLocale('en-GB')).toBe('en');
  });

  it('returns "en" for language-prefix match "en-US"', () => {
    expect(matchSupportedLocale('en-US')).toBe('en');
  });

  it('returns undefined for unsupported locale "fr"', () => {
    expect(matchSupportedLocale('fr')).toBeUndefined();
  });

  it('returns undefined for unsupported prefix "fr-FR"', () => {
    expect(matchSupportedLocale('fr-FR')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(matchSupportedLocale(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(matchSupportedLocale('')).toBeUndefined();
  });
});

describe('resolveLocale()', () => {
  it('returns userLocale when it is supported', () => {
    expect(resolveLocale('en', undefined)).toBe('en');
  });

  it('returns companyLocale when userLocale is unsupported', () => {
    expect(resolveLocale('fr', 'en')).toBe('en');
  });

  it('returns "en" when both userLocale and companyLocale are unsupported', () => {
    expect(resolveLocale('fr', 'de')).toBe('en');
  });

  it('returns "en" when both are undefined', () => {
    expect(resolveLocale(undefined, undefined)).toBe('en');
  });

  it('returns "en" when no arguments are provided', () => {
    expect(resolveLocale()).toBe('en');
  });

  it('prefers userLocale over companyLocale when both are supported', () => {
    // Both are 'en' in MVP, but tests the priority chain
    expect(resolveLocale('en', 'en')).toBe('en');
  });

  it('resolves "en-GB" to "en" via language-prefix matching', () => {
    expect(resolveLocale('en-GB', undefined)).toBe('en');
  });

  it('resolves "en-US" to "en" via language-prefix matching', () => {
    expect(resolveLocale('en-US', undefined)).toBe('en');
  });

  it('resolves companyLocale "en-GB" when userLocale is unsupported', () => {
    expect(resolveLocale('fr', 'en-GB')).toBe('en');
  });
});
