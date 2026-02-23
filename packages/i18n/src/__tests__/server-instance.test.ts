import { describe, expect, it } from 'vitest';

import { tServer, resolveMessage } from '../server-instance.js';
import type { TranslationMessage } from '../types.js';

describe('tServer()', () => {
  it('resolves error keys to English strings', () => {
    expect(tServer('errors:AUTH_INVALID_CREDENTIALS')).toBe('Invalid email or password');
  });

  it('resolves validation keys with params', () => {
    expect(tServer('validation:required', { field: 'Email' })).toBe('Email is required');
  });

  it('resolves validation keys with multiple params', () => {
    expect(tServer('validation:minLength', { field: 'Name', min: '2' })).toBe(
      'Name must be at least 2 characters',
    );
  });

  it('resolves common namespace keys', () => {
    expect(tServer('common:loggedOut')).toBe('Logged out');
  });

  it('resolves common:mfaEnabled', () => {
    expect(tServer('common:mfaEnabled')).toBe('MFA enabled successfully');
  });

  it('resolves common:mfaReset', () => {
    expect(tServer('common:mfaReset')).toBe('MFA reset successfully');
  });

  it('resolves errors:SERVER_ERROR', () => {
    expect(tServer('errors:SERVER_ERROR')).toBe('An internal server error occurred');
  });

  it('resolves errors:VALIDATION_ERROR', () => {
    expect(tServer('errors:VALIDATION_ERROR')).toBe('Please correct the errors below');
  });

  it('returns key string for missing keys', () => {
    const result = tServer('errors:NONEXISTENT_KEY');
    // i18next returns the key itself when no translation is found
    expect(result).toBe('NONEXISTENT_KEY');
  });

  it('returns key string for completely unknown namespace', () => {
    const result = tServer('unknown:someKey');
    expect(result).toBe('someKey');
  });

  it('works in Node.js context without React dependency', () => {
    // This test proves the server entry point loads without React.
    // If it required React, the import at the top would have failed.
    expect(typeof tServer).toBe('function');
    expect(tServer('errors:UNAUTHORIZED')).toBe('Authentication required');
  });
});

describe('resolveMessage()', () => {
  it('resolves a TranslationMessage to the correct string', () => {
    const msg: TranslationMessage = {
      key: 'errors:AUTH_INVALID_CREDENTIALS',
    };
    expect(resolveMessage(msg)).toBe('Invalid email or password');
  });

  it('resolves a TranslationMessage with params', () => {
    const msg: TranslationMessage = {
      key: 'validation:required',
      params: { field: 'Password' },
    };
    expect(resolveMessage(msg)).toBe('Password is required');
  });

  it('resolves a TranslationMessage with multiple params', () => {
    const msg: TranslationMessage = {
      key: 'validation:maxLength',
      params: { field: 'Description', max: '500' },
    };
    expect(resolveMessage(msg)).toBe('Description must not exceed 500 characters');
  });

  it('returns key for missing translation', () => {
    const msg: TranslationMessage = { key: 'errors:DOES_NOT_EXIST' };
    expect(resolveMessage(msg)).toBe('DOES_NOT_EXIST');
  });
});
