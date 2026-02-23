export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, string[]>;
  readonly messageKey?: string;
  readonly messageParams?: Record<string, string>;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: Record<string, string[]>,
    messageKey?: string,
    messageParams?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.messageKey = messageKey;
    this.messageParams = messageParams;

    // Restore prototype chain broken by extending built-in Error
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
