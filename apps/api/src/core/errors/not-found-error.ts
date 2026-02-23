import { AppError } from './app-error.js';

export class NotFoundError extends AppError {
  constructor(
    code: string = 'NOT_FOUND',
    message: string = 'Resource not found',
    messageKey?: string,
    messageParams?: Record<string, string>,
  ) {
    super(code, message, 404, undefined, messageKey, messageParams);
    this.name = 'NotFoundError';
  }
}
