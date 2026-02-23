import type { PrismaClient, AiPrompt } from '@nexa/db';
import type { Logger } from 'pino';
import type Redis from 'ioredis';
import type {
  AiRequestContext,
  ResolvedPrompt,
  PromptParamSource,
  EntityParamSource,
  QueryParamSource,
  ContextParamSource,
  ComputedParamSource,
} from './ai.types.js';
import { AiPromptNotFoundError } from './ai.errors.js';

/** Default maximum rows returned by query parameter resolution */
const DEFAULT_QUERY_LIMIT = 50;

export class PromptManager {
  constructor(
    private db: PrismaClient,
    private redis: Redis,
    private logger: Logger,
  ) {}

  /**
   * Load prompt by name from DB, using the active version.
   * Returns the resolved prompt with system + user templates.
   */
  async loadPrompt(promptName: string): Promise<ResolvedPrompt & { prompt: AiPrompt }> {
    const prompt = await this.db.aiPrompt.findUnique({
      where: { name: promptName },
    });

    if (!prompt || !prompt.isActive) {
      throw new AiPromptNotFoundError(
        `AI prompt '${promptName}' not found or inactive`,
        'ai.error.promptNotFound',
        { promptName },
      );
    }

    return {
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userTemplate,
      promptId: prompt.id,
      promptVersion: prompt.activeVersion,
      prompt,
    };
  }

  /**
   * Resolve all parameters in a prompt template.
   * Substitutes {{param}} placeholders with values from entity data,
   * queries, context cache, computed values, and user input.
   */
  async resolveParameters(
    prompt: AiPrompt,
    context: AiRequestContext,
    userMessage: string,
    intentData?: Record<string, unknown>,
  ): Promise<{ systemPrompt: string; userPrompt: string }> {
    const paramDefs = (prompt.parameters ?? {}) as unknown as Record<string, PromptParamSource>;
    const resolved: Record<string, unknown> = {};

    // Resolve each parameter based on its source type
    for (const [paramName, source] of Object.entries(paramDefs)) {
      try {
        resolved[paramName] = await this.resolveParam(source, context, userMessage, intentData);
      } catch (err) {
        this.logger.warn(
          { paramName, source: source.type, err },
          'Failed to resolve prompt parameter, using placeholder',
        );
        resolved[paramName] = '[not found]';
      }
    }

    // Also inject intentData keys directly into resolved params if provided
    if (intentData) {
      for (const [key, value] of Object.entries(intentData)) {
        if (!(key in resolved)) {
          resolved[key] = value;
        }
      }
    }

    return {
      systemPrompt: this.compileTemplate(prompt.systemPrompt, resolved),
      userPrompt: this.compileTemplate(prompt.userTemplate, resolved),
    };
  }

  /** Dispatch parameter resolution by type */
  private async resolveParam(
    source: PromptParamSource,
    context: AiRequestContext,
    userMessage: string,
    intentData?: Record<string, unknown>,
  ): Promise<unknown> {
    switch (source.type) {
      case 'entity':
        return this.resolveEntityParam(source, context, intentData);
      case 'query':
        return this.resolveQueryParam(source, context);
      case 'context':
        return this.resolveContextParam(source, context);
      case 'computed':
        return this.resolveComputedParam(source);
      case 'userInput':
        return this.resolveUserInputParam(userMessage);
    }
  }

  // ─── Entity Parameter Resolution ────────────────────────────────────────────

  /**
   * Resolve entity parameter: fetch a single record by ID.
   * Uses companyId scoping on all entity queries.
   */
  private async resolveEntityParam(
    source: EntityParamSource,
    context: AiRequestContext,
    intentData?: Record<string, unknown>,
  ): Promise<unknown> {
    // Get the entity ID from context or intentData
    let entityId: string | undefined;

    if (source.idFrom === 'currentEntityId') {
      entityId = context.currentEntityId;
    } else if (intentData && source.idFrom in intentData) {
      entityId = String(intentData[source.idFrom]);
    }

    if (!entityId) {
      this.logger.warn(
        { entityType: source.entityType, idFrom: source.idFrom },
        'Entity ID not found in context for parameter resolution',
      );
      return '[not found]';
    }

    const model = (this.db as any)[source.entityType];
    if (!model) {
      this.logger.warn(
        { entityType: source.entityType },
        'Unknown entity type for parameter resolution',
      );
      return '[not found]';
    }

    const record = await model.findFirst({
      where: { id: entityId, companyId: context.companyId },
      ...(source.fields ? { select: Object.fromEntries(source.fields.map((f) => [f, true])) } : {}),
    });

    if (!record) {
      this.logger.warn(
        { entityType: source.entityType, entityId },
        'Entity not found for parameter resolution',
      );
      return '[not found]';
    }

    return record;
  }

  // ─── Query Parameter Resolution ─────────────────────────────────────────────

  /**
   * Resolve query parameter: fetch multiple records.
   * Always adds companyId to where clause.
   * Limits results to prevent token overflow.
   */
  private async resolveQueryParam(
    source: QueryParamSource,
    context: AiRequestContext,
  ): Promise<unknown> {
    const model = (this.db as any)[source.entityType];
    if (!model) {
      this.logger.warn(
        { entityType: source.entityType },
        'Unknown entity type for query parameter resolution',
      );
      return [];
    }

    const limit = Math.min(source.limit ?? DEFAULT_QUERY_LIMIT, DEFAULT_QUERY_LIMIT);

    const records = await model.findMany({
      where: { ...source.where, companyId: context.companyId },
      ...(source.select ? { select: source.select } : {}),
      take: limit,
    });

    return records;
  }

  // ─── Context Parameter Resolution ───────────────────────────────────────────

  /**
   * Resolve context parameter: Redis lookup at {tenantId}:context:{userId}.
   * Traverses dot-path to extract nested value.
   */
  private async resolveContextParam(
    source: ContextParamSource,
    context: AiRequestContext,
  ): Promise<unknown> {
    const redisKey = `${context.tenantId}:context:${context.userId}`;
    const raw = await this.redis.get(redisKey);

    if (!raw) {
      this.logger.warn(
        { redisKey, path: source.path },
        'No context found in Redis for parameter resolution',
      );
      return '[not found]';
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(
        { redisKey },
        'Failed to parse context JSON from Redis',
      );
      return '[not found]';
    }

    return this.traverseDotPath(parsed, source.path);
  }

  /** Traverse a dot-separated path in an object (e.g. 'tenant.companyName') */
  private traverseDotPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current == null || typeof current !== 'object') {
        return '[not found]';
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current ?? '[not found]';
  }

  // ─── Computed Parameter Resolution ──────────────────────────────────────────

  /** Resolve computed parameter: built-in functions */
  private resolveComputedParam(source: ComputedParamSource): unknown {
    switch (source.fn) {
      case 'currentDate':
        return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      case 'currentTime':
        return new Date().toISOString();
      case 'currentPeriod': {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
      case 'currentUser':
        return 'currentUser'; // resolved externally via context
      default:
        this.logger.warn({ fn: (source as any).fn }, 'Unknown computed parameter function');
        return '[unknown]';
    }
  }

  // ─── User Input Parameter Resolution ────────────────────────────────────────

  /** Resolve user input parameter: returns the raw user message */
  private resolveUserInputParam(userMessage: string): string {
    return userMessage;
  }

  // ─── Template Compilation ───────────────────────────────────────────────────

  /**
   * Simple regex-based {{param}} replacement.
   * Supports nested access: {{customer.name}}, {{customer.paymentTerms}}
   * Supports array serialization: {{recentOrders}} → JSON stringified list
   * Escapes any remaining unresolved {{param}} markers (logs warning).
   */
  compileTemplate(template: string, params: Record<string, unknown>): string {
    const result = template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, path: string) => {
      const value = this.resolveTemplatePath(params, path);

      if (value === undefined || value === null) {
        this.logger.warn({ param: path }, 'Unresolved template parameter');
        return `[${path}]`;
      }

      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }

      if (typeof value === 'object') {
        return JSON.stringify(value);
      }

      return String(value);
    });

    return result;
  }

  /** Resolve a dot-path in the template params, supporting nested objects */
  private resolveTemplatePath(params: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');

    // First try exact match (e.g. 'customer.name' as a key)
    if (path in params) {
      return params[path];
    }

    // Then try traversing (e.g. params.customer.name)
    let current: unknown = params;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}
