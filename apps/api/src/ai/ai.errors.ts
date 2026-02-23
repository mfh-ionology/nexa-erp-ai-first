import { AppError } from '../core/errors/app-error.js';

export class AiDegradedError extends AppError {
  constructor(
    message: string = 'AI service is temporarily unavailable',
    messageKey: string = 'ai.error.degraded',
    messageParams?: Record<string, string>,
  ) {
    super('AI_DEGRADED', message, 503, undefined, messageKey, messageParams);
    this.name = 'AiDegradedError';
  }
}

export class AiQuotaError extends AppError {
  constructor(
    message: string = 'AI usage quota exceeded',
    messageKey: string = 'ai.error.quotaExceeded',
    messageParams?: Record<string, string>,
  ) {
    super('AI_QUOTA_EXCEEDED', message, 429, undefined, messageKey, messageParams);
    this.name = 'AiQuotaError';
  }
}

export class AiPromptNotFoundError extends AppError {
  constructor(
    message: string = 'AI prompt not found',
    messageKey: string = 'ai.error.promptNotFound',
    messageParams?: Record<string, string>,
  ) {
    super('AI_PROMPT_NOT_FOUND', message, 404, undefined, messageKey, messageParams);
    this.name = 'AiPromptNotFoundError';
  }
}

export class AiAgentNotFoundError extends AppError {
  constructor(
    message: string = 'AI agent not found',
    messageKey: string = 'ai.error.agentNotFound',
    messageParams?: Record<string, string>,
  ) {
    super('AI_AGENT_NOT_FOUND', message, 404, undefined, messageKey, messageParams);
    this.name = 'AiAgentNotFoundError';
  }
}

export class AiActionNotFoundError extends AppError {
  constructor(
    actionId: string,
    messageKey: string = 'ai.error.actionNotFound',
  ) {
    super('ACTION_NOT_FOUND', `Action proposal ${actionId} not found`, 404, undefined, messageKey, { actionId });
    this.name = 'AiActionNotFoundError';
  }
}

export class AiActionForbiddenError extends AppError {
  constructor(
    messageKey: string = 'ai.error.actionForbidden',
  ) {
    super('ACTION_FORBIDDEN', 'You do not have permission to execute this action', 403, undefined, messageKey);
    this.name = 'AiActionForbiddenError';
  }
}

export class AiGuardrailBlockedError extends AppError {
  constructor(
    reason: string,
    messageKey: string = 'ai.error.guardrailBlocked',
  ) {
    super('GUARDRAIL_BLOCKED', reason, 422, undefined, messageKey, { reason });
    this.name = 'AiGuardrailBlockedError';
  }
}

export class AiActionNotImplementedError extends AppError {
  constructor(
    actionType: string,
    messageKey: string = 'ai.error.actionNotImplemented',
  ) {
    super('ACTION_TYPE_NOT_IMPLEMENTED', `Action type ${actionType} is not yet available`, 501, undefined, messageKey, { actionType });
    this.name = 'AiActionNotImplementedError';
  }
}
