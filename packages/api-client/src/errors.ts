/**
 * Typed API error classes matching the Nexa ERP response envelope.
 *
 * Error envelope shape (from API Contracts §1):
 * { success: false, error: { code: string, message: string, details?: Record<string, string[]> } }
 */

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(code, message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(code, message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found', code = 'NOT_FOUND') {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ApiError {
  readonly details: Record<string, string[]>;

  constructor(
    message: string,
    details: Record<string, string[]> = {},
    code = 'VALIDATION_ERROR',
  ) {
    super(code, message, 400);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class BusinessRuleError extends ApiError {
  readonly details: Record<string, string[]>;

  constructor(
    message: string,
    details: Record<string, string[]> = {},
    code = 'BUSINESS_RULE_VIOLATION',
  ) {
    super(code, message, 422);
    this.name = 'BusinessRuleError';
    this.details = details;
  }
}
