import { AppError } from './app-error.js';

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
