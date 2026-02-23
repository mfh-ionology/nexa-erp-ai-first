export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, string[]>;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthError extends AppError {
  constructor(code: string = 'UNAUTHORIZED', message: string = 'Authentication required', statusCode: 401 | 403 | 429 = 401) {
    super(code, message, statusCode);
    this.name = 'AuthError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: Record<string, string[]>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(code: string = 'NOT_FOUND', message: string = 'Resource not found') {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}

export class DomainError extends AppError {
  constructor(
    code: string = 'BUSINESS_RULE_VIOLATION',
    message: string = 'A business rule was violated',
    details?: Record<string, string[]>,
  ) {
    super(code, message, 422, details);
    this.name = 'DomainError';
  }
}
