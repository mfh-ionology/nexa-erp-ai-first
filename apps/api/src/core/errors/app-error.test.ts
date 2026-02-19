import { describe, expect, it } from 'vitest';

import { AppError } from './app-error.js';
import { AuthError } from './auth-error.js';
import { DomainError } from './domain-error.js';
import { NotFoundError } from './not-found-error.js';
import { ValidationError } from './validation-error.js';

describe('AppError', () => {
  it('stores code, message, statusCode, and details', () => {
    const details = { field: ['is required'] };
    const error = new AppError('TEST_ERROR', 'Something failed', 500, details);

    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Something failed');
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual(details);
    expect(error.name).toBe('AppError');
  });

  it('is an instance of Error', () => {
    const error = new AppError('TEST', 'msg', 400);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('omits details when not provided', () => {
    const error = new AppError('TEST', 'msg', 400);
    expect(error.details).toBeUndefined();
  });
});

describe('DomainError', () => {
  it('defaults to 422 BUSINESS_RULE_VIOLATION', () => {
    const error = new DomainError();

    expect(error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(error.statusCode).toBe(422);
    expect(error.name).toBe('DomainError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('accepts custom code, message, and details', () => {
    const details = { amount: ['must be positive'] };
    const error = new DomainError('PERIOD_LOCKED', 'Period is locked', details);

    expect(error.code).toBe('PERIOD_LOCKED');
    expect(error.message).toBe('Period is locked');
    expect(error.statusCode).toBe(422);
    expect(error.details).toEqual(details);
  });
});

describe('AuthError', () => {
  it('defaults to 401 UNAUTHORIZED', () => {
    const error = new AuthError();

    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('AuthError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('supports 403 FORBIDDEN', () => {
    const error = new AuthError('FORBIDDEN', 'Access denied', 403);

    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Access denied');
  });
});

describe('NotFoundError', () => {
  it('defaults to 404 NOT_FOUND', () => {
    const error = new NotFoundError();

    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('NotFoundError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('accepts custom code and message', () => {
    const error = new NotFoundError('INVOICE_NOT_FOUND', 'Invoice not found');

    expect(error.code).toBe('INVOICE_NOT_FOUND');
    expect(error.message).toBe('Invoice not found');
    expect(error.statusCode).toBe(404);
  });
});

describe('ValidationError', () => {
  it('defaults to 400 VALIDATION_ERROR', () => {
    const error = new ValidationError();

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ValidationError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('includes field-level error details', () => {
    const details = {
      email: ['must be a valid email'],
      name: ['is required', 'must be at least 2 characters'],
    };
    const error = new ValidationError('Validation failed', details);

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual(details);
  });
});
