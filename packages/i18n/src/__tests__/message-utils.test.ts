import { describe, expect, it } from 'vitest';

import { validationMsg, errorMsg, systemMsg } from '../message-utils.js';

describe('validationMsg()', () => {
  it('adds validation: prefix to bare key', () => {
    const result = validationMsg('required', { field: 'email' });
    expect(result).toEqual({
      key: 'validation:required',
      params: { field: 'email' },
    });
  });

  it('does not double-prefix keys already containing ":"', () => {
    const result = validationMsg('validation:minLength', { field: 'name', min: '2' });
    expect(result).toEqual({
      key: 'validation:minLength',
      params: { field: 'name', min: '2' },
    });
  });

  it('passes through params correctly', () => {
    const params = { field: 'age', min: '0', max: '150' };
    const result = validationMsg('range', params);
    expect(result.params).toEqual(params);
  });

  it('returns undefined params when omitted', () => {
    const result = validationMsg('required');
    expect(result.params).toBeUndefined();
  });

  it('handles keys with dots (nested keys)', () => {
    const result = validationMsg('address.required');
    expect(result.key).toBe('validation:address.required');
  });
});

describe('errorMsg()', () => {
  it('adds errors: prefix to bare key', () => {
    const result = errorMsg('AUTH_INVALID_CREDENTIALS');
    expect(result).toEqual({
      key: 'errors:AUTH_INVALID_CREDENTIALS',
      params: undefined,
    });
  });

  it('does not double-prefix keys already containing ":"', () => {
    const result = errorMsg('errors:SERVER_ERROR');
    expect(result).toEqual({
      key: 'errors:SERVER_ERROR',
      params: undefined,
    });
  });

  it('passes through params correctly', () => {
    const result = errorMsg('NOT_FOUND', { resource: 'Invoice' });
    expect(result).toEqual({
      key: 'errors:NOT_FOUND',
      params: { resource: 'Invoice' },
    });
  });

  it('returns undefined params when omitted', () => {
    const result = errorMsg('UNAUTHORIZED');
    expect(result.params).toBeUndefined();
  });
});

describe('systemMsg()', () => {
  it('adds system: prefix to bare key', () => {
    const result = systemMsg('user.created', { email: 'a@b.com' });
    expect(result).toEqual({
      key: 'system:user.created',
      params: { email: 'a@b.com' },
    });
  });

  it('does not double-prefix keys already containing ":"', () => {
    const result = systemMsg('system:loggedOut');
    expect(result).toEqual({
      key: 'system:loggedOut',
      params: undefined,
    });
  });

  it('passes through pre-prefixed keys from other namespaces', () => {
    const result = systemMsg('common:loggedOut');
    expect(result).toEqual({
      key: 'common:loggedOut',
      params: undefined,
    });
  });

  it('passes through params correctly', () => {
    const params = { userId: '123', action: 'update' };
    const result = systemMsg('audit.entry', params);
    expect(result.params).toEqual(params);
  });

  it('returns undefined params when omitted', () => {
    const result = systemMsg('userDeactivated');
    expect(result.params).toBeUndefined();
  });
});
