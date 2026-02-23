/** Thrown when a tenant's AI quota hard limit blocks the call. */
export class AiQuotaExceededError extends Error {
  readonly code = 'AI_QUOTA_EXCEEDED' as const;
  readonly quotaPct: number;
  readonly remainingTokens: number;

  constructor(quotaPct: number, remainingTokens: number) {
    super(`AI quota exceeded (${quotaPct.toFixed(1)}% used). Call blocked by hard limit.`);
    this.name = 'AiQuotaExceededError';
    this.quotaPct = quotaPct;
    this.remainingTokens = remainingTokens;
  }
}

/** Wraps LLM provider errors (rate limit, 5xx, timeout). */
export class ProviderError extends Error {
  readonly code = 'PROVIDER_ERROR' as const;
  readonly provider: string;
  readonly statusCode?: number;
  readonly isRetryable: boolean;

  constructor(
    provider: string,
    message: string,
    opts?: { statusCode?: number; isRetryable?: boolean; cause?: Error },
  ) {
    super(`Provider "${provider}" error: ${message}`);
    this.name = 'ProviderError';
    this.provider = provider;
    this.statusCode = opts?.statusCode;
    this.isRetryable = opts?.isRetryable ?? false;
    if (opts?.cause) this.cause = opts.cause;
  }
}

/** All providers (primary + fallback) failed. */
export class ProviderUnavailableError extends Error {
  readonly code = 'PROVIDER_UNAVAILABLE' as const;
  readonly primaryError: Error;
  readonly fallbackError?: Error;

  constructor(primaryError: Error, fallbackError?: Error) {
    const msg = fallbackError
      ? `All providers failed. Primary: ${primaryError.message}. Fallback: ${fallbackError.message}`
      : `Provider unavailable: ${primaryError.message}`;
    super(msg);
    this.name = 'ProviderUnavailableError';
    this.primaryError = primaryError;
    this.fallbackError = fallbackError;
  }
}

/** BYOK decryption failure or missing credentials for a provider. */
export class CredentialError extends Error {
  readonly code = 'CREDENTIAL_ERROR' as const;
  readonly provider: string;

  constructor(provider: string, message: string) {
    super(`Credential error for "${provider}": ${message}`);
    this.name = 'CredentialError';
    this.provider = provider;
  }
}

/** Requested model name or routing tags not found in the model registry. */
export class ModelNotFoundError extends Error {
  readonly code = 'MODEL_NOT_FOUND' as const;
  readonly modelName?: string;
  readonly routingTags?: string[];

  constructor(opts: { modelName?: string; routingTags?: string[] }) {
    const identifier = opts.modelName
      ? `model "${opts.modelName}"`
      : `tags [${opts.routingTags?.join(', ')}]`;
    super(`No model found matching ${identifier}`);
    this.name = 'ModelNotFoundError';
    this.modelName = opts.modelName;
    this.routingTags = opts.routingTags;
  }
}
