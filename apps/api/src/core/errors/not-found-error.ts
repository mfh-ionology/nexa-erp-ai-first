import { AppError } from './app-error.js';

export class NotFoundError extends AppError {
  constructor(code: string = 'NOT_FOUND', message: string = 'Resource not found') {
    super(code, message, 404);
    this.name = 'NotFoundError';
  }
}
