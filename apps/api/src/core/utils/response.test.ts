import { describe, expect, it } from 'vitest';

import { sendSuccess, sendError } from './response.js';
import { AppError } from '../errors/index.js';

/**
 * Create a minimal mock FastifyReply that tracks status and send calls.
 */
function createMockReply() {
  const reply = {
    statusCode: 200,
    _sent: undefined as unknown,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(payload: unknown) {
      reply._sent = payload;
      return reply;
    },
  };
  return reply;
}

describe('sendSuccess', () => {
  it('returns success envelope with data', () => {
    const reply = createMockReply();
    const data = { id: '123', name: 'Test' };

    sendSuccess(reply as never, data);

    expect(reply.statusCode).toBe(200);
    expect(reply._sent).toEqual({
      success: true,
      data: { id: '123', name: 'Test' },
    });
  });

  it('includes meta when provided', () => {
    const reply = createMockReply();
    const data = [{ id: '1' }, { id: '2' }];
    const meta = { cursor: 'abc', hasMore: true, total: 10 };

    sendSuccess(reply as never, data, meta);

    expect(reply._sent).toEqual({
      success: true,
      data: [{ id: '1' }, { id: '2' }],
      meta: { cursor: 'abc', hasMore: true, total: 10 },
    });
  });

  it('omits meta when not provided', () => {
    const reply = createMockReply();

    sendSuccess(reply as never, { ok: true });

    expect(reply._sent).not.toHaveProperty('meta');
  });

  it('allows custom status code', () => {
    const reply = createMockReply();

    sendSuccess(reply as never, { id: 'new' }, undefined, 201);

    expect(reply.statusCode).toBe(201);
    expect(reply._sent).toEqual({
      success: true,
      data: { id: 'new' },
    });
  });

  it('handles null data', () => {
    const reply = createMockReply();

    sendSuccess(reply as never, null);

    expect(reply._sent).toEqual({
      success: true,
      data: null,
    });
  });
});

describe('sendError', () => {
  it('returns error envelope from AppError', () => {
    const reply = createMockReply();
    const error = new AppError('NOT_FOUND', 'Resource not found', 404);

    sendError(reply as never, error);

    expect(reply.statusCode).toBe(404);
    expect(reply._sent).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  });

  it('includes details when present on AppError', () => {
    const reply = createMockReply();
    const error = new AppError('VALIDATION_ERROR', 'Validation failed', 400, {
      email: ['Email is required'],
      name: ['Name must be at least 2 characters'],
    });

    sendError(reply as never, error);

    expect(reply.statusCode).toBe(400);
    expect(reply._sent).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          email: ['Email is required'],
          name: ['Name must be at least 2 characters'],
        },
      },
    });
  });

  it('omits details when empty object on AppError', () => {
    const reply = createMockReply();
    const error = new AppError('DOMAIN_ERROR', 'Something went wrong', 422, {});

    sendError(reply as never, error);

    expect(reply._sent).toEqual({
      success: false,
      error: {
        code: 'DOMAIN_ERROR',
        message: 'Something went wrong',
      },
    });
  });

  it('handles unknown errors as 500 INTERNAL_ERROR', () => {
    const reply = createMockReply();
    const error = new Error('Something unexpected');

    sendError(reply as never, error);

    expect(reply.statusCode).toBe(500);
    expect(reply._sent).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
});
