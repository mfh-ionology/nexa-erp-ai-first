import { AppError } from './app-error.js';

export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation failed',
    details?: Record<string, string[]>,
    messageKey?: string,
    messageParams?: Record<string, string>,
  ) {
    super('VALIDATION_ERROR', message, 400, details, messageKey, messageParams);
    this.name = 'ValidationError';
  }
}
