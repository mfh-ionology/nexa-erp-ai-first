import { AppError } from '../errors/app-error.js';

export class ViewNotFoundError extends AppError {
  constructor(
    message: string = 'View not found',
    messageKey?: string,
    messageParams?: Record<string, string>,
  ) {
    super('VIEW_NOT_FOUND', message, 404, undefined, messageKey, messageParams);
    this.name = 'ViewNotFoundError';
  }
}

export class DuplicateViewNameError extends AppError {
  constructor(
    message: string = 'A view with this name already exists',
    messageKey?: string,
    messageParams?: Record<string, string>,
  ) {
    super('DUPLICATE_VIEW_NAME', message, 409, undefined, messageKey, messageParams);
    this.name = 'DuplicateViewNameError';
  }
}

export class ViewScopeForbiddenError extends AppError {
  constructor(
    message: string = 'Insufficient permissions for this view scope',
    messageKey?: string,
    messageParams?: Record<string, string>,
  ) {
    super('VIEW_SCOPE_FORBIDDEN', message, 403, undefined, messageKey, messageParams);
    this.name = 'ViewScopeForbiddenError';
  }
}
