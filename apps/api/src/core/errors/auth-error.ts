import { AppError } from './app-error.js';

export class AuthError extends AppError {
  constructor(
    code: string = 'UNAUTHORIZED',
    message: string = 'Authentication required',
    statusCode: 401 | 403 = 401,
  ) {
    super(code, message, statusCode);
    this.name = 'AuthError';
  }
}
