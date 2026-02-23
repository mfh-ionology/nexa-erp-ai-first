import { describe, expect, it } from 'vitest';

import { mapZodIssueToTranslationKey } from '../zod-error-map.js';

describe('mapZodIssueToTranslationKey()', () => {
  describe('too_small', () => {
    it('maps too_small with string origin to validation:minLength', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'too_small',
        path: ['name'],
        message: 'String must contain at least 2 character(s)',
        origin: 'string',
        minimum: 2,
      });

      expect(result).toEqual({
        key: 'validation:minLength',
        params: { field: 'name', min: '2' },
      });
    });

    it('maps too_small with number origin to validation:min', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'too_small',
        path: ['age'],
        message: 'Number must be greater than or equal to 0',
        origin: 'number',
        minimum: 0,
      });

      expect(result).toEqual({
        key: 'validation:min',
        params: { field: 'age', min: '0' },
      });
    });

    it('falls back to type field when origin is not set (Zod 3 compat)', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'too_small',
        path: ['count'],
        message: 'Too small',
        type: 'number',
        minimum: 1,
      });

      expect(result).toEqual({
        key: 'validation:min',
        params: { field: 'count', min: '1' },
      });
    });

    it('defaults minimum to 0 when not provided', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'too_small',
        path: ['val'],
        message: 'Too small',
        origin: 'string',
      });

      expect(result.params?.min).toBe('0');
    });
  });

  describe('too_big', () => {
    it('maps too_big with string origin to validation:maxLength', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'too_big',
        path: ['description'],
        message: 'String must contain at most 500 character(s)',
        origin: 'string',
        maximum: 500,
      });

      expect(result).toEqual({
        key: 'validation:maxLength',
        params: { field: 'description', max: '500' },
      });
    });

    it('maps too_big with number origin to validation:max', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'too_big',
        path: ['age'],
        message: 'Number must be less than or equal to 150',
        origin: 'number',
        maximum: 150,
      });

      expect(result).toEqual({
        key: 'validation:max',
        params: { field: 'age', max: '150' },
      });
    });

    it('defaults maximum to 0 when not provided', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'too_big',
        path: ['val'],
        message: 'Too big',
        origin: 'string',
      });

      expect(result.params?.max).toBe('0');
    });
  });

  describe('invalid_type', () => {
    it('maps invalid_type to validation:required when received is undefined', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_type',
        path: ['email'],
        message: 'Required',
        received: 'undefined',
      });

      expect(result).toEqual({
        key: 'validation:required',
        params: { field: 'email' },
      });
    });

    it('maps invalid_type to validation:required when received is not set', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_type',
        path: ['email'],
        message: 'Required',
      });

      expect(result).toEqual({
        key: 'validation:required',
        params: { field: 'email' },
      });
    });

    it('maps invalid_type to validation:required when received is null', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_type',
        path: ['age'],
        message: 'Expected number, received null',
        received: 'null',
      });

      expect(result).toEqual({
        key: 'validation:required',
        params: { field: 'age' },
      });
    });

    it('maps invalid_type to validation:invalid for genuine type mismatches', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_type',
        path: ['age'],
        message: 'Expected number, received string',
        received: 'string',
      });

      expect(result).toEqual({
        key: 'validation:invalid',
        params: { field: 'age' },
      });
    });
  });

  describe('invalid_format (Zod 4)', () => {
    it('maps invalid_format with email format to validation:email', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_format',
        path: ['email'],
        message: 'Invalid email',
        format: 'email',
      });

      expect(result).toEqual({
        key: 'validation:email',
        params: { field: 'email' },
      });
    });

    it('maps invalid_format with regex format to validation:pattern', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_format',
        path: ['code'],
        message: 'Invalid string',
        format: 'regex',
      });

      expect(result).toEqual({
        key: 'validation:pattern',
        params: { field: 'code' },
      });
    });

    it('maps invalid_format with unknown format to validation:invalid', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_format',
        path: ['field'],
        message: 'Invalid format',
        format: 'uuid',
      });

      expect(result).toEqual({
        key: 'validation:invalid',
        params: { field: 'field' },
      });
    });
  });

  describe('invalid_string (Zod 3 compat)', () => {
    it('maps invalid_string with Zod 3 validation=email to validation:email', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_string',
        path: ['email'],
        message: 'Invalid email',
        validation: 'email',
      });

      expect(result).toEqual({
        key: 'validation:email',
        params: { field: 'email' },
      });
    });

    it('maps invalid_string with Zod 3 validation=regex to validation:pattern', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_string',
        path: ['phone'],
        message: 'Invalid',
        validation: 'regex',
      });

      expect(result).toEqual({
        key: 'validation:pattern',
        params: { field: 'phone' },
      });
    });

    it('maps invalid_string with origin=email (fallback) to validation:email', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_string',
        path: ['email'],
        message: 'Invalid email',
        origin: 'email',
      });

      expect(result).toEqual({
        key: 'validation:email',
        params: { field: 'email' },
      });
    });

    it('maps invalid_string with origin=regex (fallback) to validation:pattern', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_string',
        path: ['phone'],
        message: 'Invalid',
        origin: 'regex',
      });

      expect(result).toEqual({
        key: 'validation:pattern',
        params: { field: 'phone' },
      });
    });

    it('maps invalid_string with unrecognised validation to validation:invalid', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_string',
        path: ['field'],
        message: 'Invalid',
        validation: 'url',
      });

      expect(result).toEqual({
        key: 'validation:invalid',
        params: { field: 'field' },
      });
    });
  });

  describe('custom', () => {
    it('uses message as key when it looks like a translation key (contains ":")', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'custom',
        path: ['username'],
        message: 'validation:unique',
      });

      expect(result).toEqual({
        key: 'validation:unique',
        params: { field: 'username' },
      });
    });

    it('maps to validation:invalid when message contains dots but no colon', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'custom',
        path: ['field'],
        message: 'custom.rule.check',
      });

      expect(result).toEqual({
        key: 'validation:invalid',
        params: { field: 'field' },
      });
    });

    it('maps to validation:invalid when message is a sentence with a period', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'custom',
        path: ['amount'],
        message: 'Amount must be at least $0.01.',
      });

      expect(result).toEqual({
        key: 'validation:invalid',
        params: { field: 'amount' },
      });
    });

    it('maps to validation:invalid when message is not a translation key', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'custom',
        path: ['field'],
        message: 'Something went wrong',
      });

      expect(result).toEqual({
        key: 'validation:invalid',
        params: { field: 'field' },
      });
    });

    it('maps to validation:invalid when message has a colon but is natural language', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'custom',
        path: ['field'],
        message: 'Error: value is too large',
      });

      expect(result).toEqual({
        key: 'validation:invalid',
        params: { field: 'field' },
      });
    });

    it('maps to validation:invalid when message has colon in middle of sentence', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'custom',
        path: ['time'],
        message: 'Expected format: YYYY-MM-DD',
      });

      expect(result).toEqual({
        key: 'validation:invalid',
        params: { field: 'time' },
      });
    });
  });

  describe('unknown code', () => {
    it('maps unknown codes to validation:invalid', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'some_future_code',
        path: ['field'],
        message: 'Unknown error',
      });

      expect(result).toEqual({
        key: 'validation:invalid',
        params: { field: 'field' },
      });
    });
  });

  describe('field derivation from path', () => {
    it('uses last path segment as field name', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_type',
        path: ['address', 'street'],
        message: 'Required',
      });

      expect(result.params?.field).toBe('street');
    });

    it('uses _root for empty path', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_type',
        path: [],
        message: 'Required',
      });

      expect(result.params?.field).toBe('_root');
    });

    it('converts numeric path segments to strings', () => {
      const result = mapZodIssueToTranslationKey({
        code: 'invalid_type',
        path: ['items', 0, 'name'],
        message: 'Required',
      });

      expect(result.params?.field).toBe('name');
    });
  });
});
