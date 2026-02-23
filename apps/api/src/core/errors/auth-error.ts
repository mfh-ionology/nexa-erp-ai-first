import { AppError } from './app-error.js';

export class AuthError extends AppError {
  constructor(
    code: string = 'UNAUTHORIZED',
    message: string = 'Authentication required',
    statusCode: 401 | 403 = 401,
    messageKey?: string,
    messageParams?: Record<string, string>,
  ) {
    super(code, message, statusCode, undefined, messageKey, messageParams);
    this.name = 'AuthError';
  }
}
