import type { PrismaClient, AiPromptVariable } from '@nexa/db';
import type { Logger } from 'pino';
import { AppError } from '../../core/errors/app-error.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Context passed to variable resolution */
export interface VariableResolutionContext {
  companyId: string;
  userId: string;
  userName?: string;
  userRole?: string;
  companyName?: string;
  baseCurrency?: string;
  defaultCurrency?: string;
  /** For DB_FIELD resolution — the entity ID to look up when no explicit where clause is provided */
  entityId?: string;
  /** For DB_FIELD resolution — the entity type (Prisma model name, e.g., 'customer') */
  entityType?: string;
  /** Output from previous automation steps, keyed by step order: { '1': {...}, '2': {...} } */
  previousStepOutputs?: Record<string, unknown>;
  /** Frontend page state from chat session */
  pageContext?: Record<string, unknown>;
  /** Whether running in autonomous mode (no user to prompt) */
  autonomous: boolean;
}

/** Source handler interface — each source type implements this */
export interface SourceHandler {
  readonly sourceType: string;
  resolve(variable: AiPromptVariable, context: VariableResolutionContext): Promise<unknown>;
}

/** Error thrown when a required parameter cannot be resolved in autonomous mode */
export class UnresolvableRequiredParamError extends AppError {
  constructor(paramName: string) {
    super(
      'UNRESOLVABLE_REQUIRED_PARAM',
      `Required variable '${paramName}' could not be resolved in autonomous mode`,
      422,
      undefined,
      'ai.error.unresolvableRequiredParam',
      { paramName },
    );
    this.name = 'UnresolvableRequiredParamError';
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Allowlist of Prisma model names that DB_FIELD variables are permitted to query.
 *  Prevents arbitrary model access (e.g., User, AiModel, platform tables). */
export const ALLOWED_DB_FIELD_MODELS = new Set([
  'customer',
  'supplier',
  'item',
  'customerInvoice',
  'customerInvoiceLine',
  'salesOrder',
  'salesOrderLine',
  'purchaseOrder',
  'purchaseOrderLine',
  'supplierInvoice',
  'supplierInvoiceLine',
  'companyProfile',
  'chartOfAccount',
  'financialPeriod',
  'journalEntry',
  'journalLine',
  'stockMovement',
  'warehouse',
  'location',
  'crmLead',
  'crmOpportunity',
  'crmCampaign',
  'employee',
  'leaveRequest',
  'aiAutomation',
  'aiAutomationRun',
]);

// ─── Source Handlers ────────────────────────────────────────────────────────

/**
 * DB_FIELD handler — resolves a variable from a database table field.
 * Supports dot-path relation traversal (e.g., `customer.primaryContact.email`).
 */
export class DbFieldHandler implements SourceHandler {
  readonly sourceType = 'DB_FIELD';

  constructor(
    private db: PrismaClient,
    private logger: Logger,
  ) {}

  async resolve(variable: AiPromptVariable, context: VariableResolutionContext): Promise<unknown> {
    const config = variable.sourceConfig as {
      table: string;
      field: string;
      where?: Record<string, unknown>;
      relation?: string; // dot-path for relation traversal
    };

    if (!config.table || !config.field) {
      this.logger.warn(
        { variableName: variable.variableName, config },
        'DB_FIELD source missing table or field',
      );
      return undefined;
    }

    // Security: only allow models from the explicit allowlist
    if (!ALLOWED_DB_FIELD_MODELS.has(config.table)) {
      this.logger.warn(
        { table: config.table, variableName: variable.variableName },
        'DB_FIELD rejected: model not in allowlist',
      );
      return undefined;
    }

    // Security: reject table names starting with $ or _ (Prisma internals like $connect, $queryRaw, _runCommandRaw)
    if (/^[$_]/.test(config.table)) {
      this.logger.error(
        { table: config.table, variableName: variable.variableName },
        'DB_FIELD rejected: table name accesses Prisma internals',
      );
      return undefined;
    }

    const model = (this.db as any)[config.table];
    if (!model || typeof model.findFirst !== 'function') {
      this.logger.warn({ table: config.table }, 'Unknown Prisma model for DB_FIELD resolution');
      return undefined;
    }

    // Build include for relation traversal
    const include = config.relation ? this.buildIncludeFromPath(config.relation) : undefined;

    // Build where clause: use explicit config.where if provided, otherwise
    // infer from entity context when the config.table matches the entity type
    let whereClause: Record<string, unknown> = { ...config.where, companyId: context.companyId };
    if (!config.where && context.entityId && context.entityType) {
      // If the variable's table matches the entity type from context, use entityId as the lookup
      if (config.table.toLowerCase() === context.entityType.toLowerCase()) {
        whereClause = { id: context.entityId, companyId: context.companyId };
      }
    }

    try {
      const record = await model.findFirst({
        where: whereClause,
        ...(include ? { include } : {}),
      });

      if (!record) return undefined;

      // If relation path, traverse it
      if (config.relation) {
        return this.traversePath(record, `${config.relation}.${config.field}`);
      }

      return record[config.field];
    } catch (err) {
      this.logger.warn(
        { variableName: variable.variableName, table: config.table, err },
        'DB_FIELD resolution query failed',
      );
      return undefined;
    }
  }

  /** Build a Prisma include object from a dot-separated relation path */
  private buildIncludeFromPath(path: string): Record<string, unknown> {
    const parts = path.split('.');
    if (parts.length === 0) return {};

    let include: Record<string, unknown> = { [parts[parts.length - 1]!]: true };

    for (let i = parts.length - 2; i >= 0; i--) {
      include = { [parts[i]!]: { include } };
    }

    return include;
  }

  /** Traverse a dot-separated path in a record */
  private traversePath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}

/**
 * DB_QUERY handler — executes a raw parameterised SELECT query.
 * Security: only SELECT queries are allowed (validated at resolution time).
 */
export class DbQueryHandler implements SourceHandler {
  readonly sourceType = 'DB_QUERY';

  constructor(
    private db: PrismaClient,
    private logger: Logger,
  ) {}

  async resolve(variable: AiPromptVariable, context: VariableResolutionContext): Promise<unknown> {
    const config = variable.sourceConfig as {
      query: string;
    };

    if (!config.query) {
      this.logger.warn({ variableName: variable.variableName }, 'DB_QUERY source missing query');
      return undefined;
    }

    // Security: only allow SELECT queries
    const trimmed = config.query.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT')) {
      this.logger.error(
        { variableName: variable.variableName, query: config.query },
        'DB_QUERY rejected: only SELECT queries are allowed',
      );
      return undefined;
    }

    // Reject dangerous SQL patterns (DML, DDL, DCL, and PostgreSQL-specific)
    const dangerous =
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|EXEC|EXECUTE|COPY|GRANT|REVOKE|LOCK|VACUUM)\b/i;
    if (dangerous.test(config.query)) {
      this.logger.error(
        { variableName: variable.variableName },
        'DB_QUERY rejected: contains disallowed SQL keywords',
      );
      return undefined;
    }

    // Reject multi-statement attacks (semicolons), CTEs (WITH), DO blocks, and SQL comments
    const injection = /;|--|\bWITH\b|\bDO\b\s*\$|\bCOPY\b|\/\*/i;
    if (injection.test(config.query)) {
      this.logger.error(
        { variableName: variable.variableName },
        'DB_QUERY rejected: contains potentially dangerous SQL patterns (semicolons, comments, CTEs, DO blocks)',
      );
      return undefined;
    }

    try {
      // Use parameterised query — replace :companyId placeholder with $1 positional binding
      // and pass the value separately to prevent SQL injection
      const parameterisedQuery = config.query.replace(/:companyId/g, '$1');

      const result = await (this.db as any).$queryRawUnsafe(parameterisedQuery, context.companyId);

      // Truncate long results to stay within token budgets (BR-AI-01)
      const stringified = JSON.stringify(result);
      if (stringified.length > 2000) {
        this.logger.info(
          { variableName: variable.variableName, originalLength: stringified.length },
          'DB_QUERY result truncated to stay within token budget',
        );
        return stringified.substring(0, 2000) + '... [truncated]';
      }

      return result;
    } catch (err) {
      this.logger.warn({ variableName: variable.variableName, err }, 'DB_QUERY execution failed');
      return undefined;
    }
  }
}

/**
 * SYSTEM handler — resolves built-in system variables.
 */
export class SystemHandler implements SourceHandler {
  readonly sourceType = 'SYSTEM';

  constructor(private logger: Logger) {}

  async resolve(variable: AiPromptVariable, context: VariableResolutionContext): Promise<unknown> {
    const config = variable.sourceConfig as { key?: string };
    const key = config.key ?? variable.variableName;

    switch (key) {
      case 'today':
        return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      case 'currentUser.name':
        return context.userName ?? '[unknown user]';
      case 'currentUser.role':
        return context.userRole ?? '[unknown role]';
      case 'company.name':
        return context.companyName ?? '[unknown company]';
      case 'company.baseCurrency':
        return context.baseCurrency ?? 'GBP';
      case 'company.defaultCurrency':
        return context.defaultCurrency ?? context.baseCurrency ?? 'GBP';
      case 'company.id':
        return context.companyId;
      case 'currentUser.id':
        return context.userId;
      default:
        this.logger.warn(
          { variableName: variable.variableName, key },
          'Unknown SYSTEM variable key',
        );
        return undefined;
    }
  }
}

/**
 * PREVIOUS_STEP handler — resolves variables from previous automation step outputs.
 * Format: `step{N}.output.{jsonPath}` — e.g., `step1.output.flaggedInvoices`
 */
export class PreviousStepHandler implements SourceHandler {
  readonly sourceType = 'PREVIOUS_STEP';

  constructor(private logger: Logger) {}

  async resolve(variable: AiPromptVariable, context: VariableResolutionContext): Promise<unknown> {
    const config = variable.sourceConfig as { stepOrder: number; jsonPath: string };

    if (config.stepOrder == null || !config.jsonPath) {
      this.logger.warn(
        { variableName: variable.variableName, config },
        'PREVIOUS_STEP source missing stepOrder or jsonPath',
      );
      return undefined;
    }

    const stepOutput = context.previousStepOutputs?.[String(config.stepOrder)];
    if (stepOutput == null) {
      this.logger.warn(
        { variableName: variable.variableName, stepOrder: config.stepOrder },
        'No output found for previous step',
      );
      return undefined;
    }

    return this.traverseJsonPath(stepOutput, config.jsonPath);
  }

  /** Traverse a dot-separated JSON path */
  private traverseJsonPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}

/**
 * CONSTANT handler — returns a static value from sourceConfig.
 */
export class ConstantHandler implements SourceHandler {
  readonly sourceType = 'CONSTANT';

  async resolve(variable: AiPromptVariable, _context: VariableResolutionContext): Promise<unknown> {
    const config = variable.sourceConfig as { value: unknown };
    return config.value;
  }
}

/**
 * EXPRESSION handler — evaluates safe expressions.
 * Supports date arithmetic (today +/- N days) and basic math.
 * Security: NO eval(). Uses a safe expression parser.
 */
export class ExpressionHandler implements SourceHandler {
  readonly sourceType = 'EXPRESSION';

  constructor(private logger: Logger) {}

  async resolve(variable: AiPromptVariable, _context: VariableResolutionContext): Promise<unknown> {
    const config = variable.sourceConfig as { expression: string };

    if (!config.expression) {
      this.logger.warn(
        { variableName: variable.variableName },
        'EXPRESSION source missing expression',
      );
      return undefined;
    }

    return this.evaluateExpression(config.expression);
  }

  /** Safe expression evaluator — supports date arithmetic and basic math */
  private evaluateExpression(expression: string): unknown {
    const trimmed = expression.trim();

    // Date arithmetic: "today + N days" / "today - N days"
    const dateArithMatch = trimmed.match(/^today\s*([+-])\s*(\d+)\s*(days?|weeks?|months?)$/i);
    if (dateArithMatch) {
      const [, operator, amountStr, unit] = dateArithMatch;
      const amount = parseInt(amountStr!, 10);
      const sign = operator === '+' ? 1 : -1;
      const date = new Date();

      const unitLower = unit!.toLowerCase().replace(/s$/, '');
      switch (unitLower) {
        case 'day':
          date.setDate(date.getDate() + sign * amount);
          break;
        case 'week':
          date.setDate(date.getDate() + sign * amount * 7);
          break;
        case 'month':
          date.setMonth(date.getMonth() + sign * amount);
          break;
      }

      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    // Basic math: "N op N" where op is +, -, *, /
    const mathMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/);
    if (mathMatch) {
      const [, leftStr, op, rightStr] = mathMatch;
      const left = parseFloat(leftStr!);
      const right = parseFloat(rightStr!);

      switch (op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return right !== 0 ? left / right : undefined;
      }
    }

    // "today" alone
    if (trimmed.toLowerCase() === 'today') {
      return new Date().toISOString().split('T')[0];
    }

    // String functions: concat(...), uppercase(...), lowercase(...), trim(...)
    const funcMatch = trimmed.match(/^(\w+)\((.+)\)$/s);
    if (funcMatch) {
      const [, funcName, argsStr] = funcMatch;
      const func = funcName!.toLowerCase();

      switch (func) {
        case 'concat': {
          const args = this.parseStringArgs(argsStr!);
          if (args === undefined) break;
          return args.join('');
        }
        case 'uppercase': {
          const args = this.parseStringArgs(argsStr!);
          if (args === undefined || args.length !== 1) break;
          return args[0]!.toUpperCase();
        }
        case 'lowercase': {
          const args = this.parseStringArgs(argsStr!);
          if (args === undefined || args.length !== 1) break;
          return args[0]!.toLowerCase();
        }
        case 'trim': {
          const args = this.parseStringArgs(argsStr!);
          if (args === undefined || args.length !== 1) break;
          return args[0]!.trim();
        }
      }
    }

    this.logger.warn({ expression }, 'Unsupported expression format');
    return undefined;
  }

  /** Parse comma-separated single-quoted string arguments: 'hello', ' ', 'world' */
  private parseStringArgs(argsStr: string): string[] | undefined {
    const args: string[] = [];
    const argPattern = /'([^']*)'/g;
    let match: RegExpExecArray | null;

    while ((match = argPattern.exec(argsStr)) !== null) {
      args.push(match[1]!);
    }

    // Verify we matched all non-whitespace/comma content (no unquoted junk)
    const stripped = argsStr.replace(/'[^']*'/g, '').replace(/[\s,]/g, '');
    if (stripped.length > 0 || args.length === 0) {
      return undefined;
    }

    return args;
  }
}

/**
 * PAGE_FIELD handler — resolves variables from the chat session's frontend page state.
 * The pageContext is a Record<string, unknown> passed from the frontend via the chat session.
 * In automation/autonomous mode, pageContext will be undefined and resolution returns undefined.
 */
export class PageFieldHandler implements SourceHandler {
  readonly sourceType = 'PAGE_FIELD';

  constructor(private logger: Logger) {}

  async resolve(variable: AiPromptVariable, context: VariableResolutionContext): Promise<unknown> {
    const config = variable.sourceConfig as { field: string };

    if (!config.field) {
      this.logger.warn({ variableName: variable.variableName }, 'PAGE_FIELD source missing field');
      return undefined;
    }

    if (!context.pageContext) {
      this.logger.debug?.(
        { variableName: variable.variableName },
        'PAGE_FIELD: no pageContext available (autonomous/automation mode)',
      );
      return undefined;
    }

    const value = this.traversePath(context.pageContext, config.field);

    // Stringify non-primitive values for prompt injection
    if (value !== undefined && value !== null && typeof value === 'object') {
      return JSON.stringify(value);
    }

    return value;
  }

  /** Traverse a dot-separated path in the page context object */
  private traversePath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}

// ─── Main Resolver ──────────────────────────────────────────────────────────

export class VariableResolver {
  private handlers = new Map<string, SourceHandler>();

  constructor(private logger: Logger) {}

  /** Register a source handler for a given source type */
  registerSourceHandler(sourceType: string, handler: SourceHandler): void {
    this.handlers.set(sourceType, handler);
  }

  /**
   * Resolve a template string by replacing all `{{varName}}` placeholders
   * with values from the registered source handlers.
   */
  async resolve(
    template: string,
    variables: AiPromptVariable[],
    context: VariableResolutionContext,
  ): Promise<string> {
    const resolved = new Map<string, unknown>();

    // Resolve all variables first
    for (const variable of variables) {
      try {
        const value = await this.resolveVariable(variable, context);
        resolved.set(variable.variableName, value);
      } catch (err) {
        // In autonomous mode, required variable failures are fatal
        if (err instanceof UnresolvableRequiredParamError) {
          throw err;
        }

        this.logger.warn(
          { variableName: variable.variableName, err },
          'Variable resolution failed',
        );
        resolved.set(variable.variableName, this.getFallback(variable));
      }
    }

    // Replace template placeholders
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, varName: string) => {
      const value = resolved.get(varName);

      if (value === undefined || value === null) {
        return `[unknown: ${varName}]`;
      }

      if (Array.isArray(value) || typeof value === 'object') {
        return JSON.stringify(value);
      }

      return String(value);
    });
  }

  /**
   * Resolve variables and return them as a key-value map (for step I/O piping).
   */
  async resolveToMap(
    variables: AiPromptVariable[],
    context: VariableResolutionContext,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const variable of variables) {
      try {
        const value = await this.resolveVariable(variable, context);
        result[variable.variableName] = value ?? this.getFallback(variable);
      } catch (err) {
        if (err instanceof UnresolvableRequiredParamError) {
          throw err;
        }

        this.logger.warn(
          { variableName: variable.variableName, err },
          'Variable resolution failed',
        );
        result[variable.variableName] = this.getFallback(variable);
      }
    }

    return result;
  }

  /** Resolve a single variable using the appropriate source handler */
  private async resolveVariable(
    variable: AiPromptVariable,
    context: VariableResolutionContext,
  ): Promise<unknown> {
    const handler = this.handlers.get(variable.sourceType);

    if (!handler) {
      this.logger.warn(
        { sourceType: variable.sourceType, variableName: variable.variableName },
        'No handler registered for source type',
      );
      return this.handleUnresolved(variable, context);
    }

    const value = await handler.resolve(variable, context);

    if (value === undefined || value === null) {
      return this.handleUnresolved(variable, context);
    }

    return value;
  }

  /** Handle unresolved variable — throws in autonomous mode for required vars */
  private handleUnresolved(
    variable: AiPromptVariable,
    context: VariableResolutionContext,
  ): unknown {
    if (variable.isRequired && context.autonomous) {
      throw new UnresolvableRequiredParamError(variable.variableName);
    }

    return this.getFallback(variable);
  }

  /** Get fallback value: defaultValue if set, otherwise undefined (will become [unknown: varName]) */
  private getFallback(variable: AiPromptVariable): unknown {
    if (variable.defaultValue != null) {
      return variable.defaultValue;
    }

    if (!variable.isRequired) {
      this.logger.warn(
        { variableName: variable.variableName },
        'Optional variable unresolved, using [unknown] placeholder',
      );
    }

    return undefined;
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/** Create a fully configured VariableResolver with all built-in handlers */
export function createVariableResolver(db: PrismaClient, logger: Logger): VariableResolver {
  const resolver = new VariableResolver(logger);

  resolver.registerSourceHandler('DB_FIELD', new DbFieldHandler(db, logger));
  resolver.registerSourceHandler('DB_QUERY', new DbQueryHandler(db, logger));
  resolver.registerSourceHandler('SYSTEM', new SystemHandler(logger));
  resolver.registerSourceHandler('PREVIOUS_STEP', new PreviousStepHandler(logger));
  resolver.registerSourceHandler('CONSTANT', new ConstantHandler());
  resolver.registerSourceHandler('EXPRESSION', new ExpressionHandler(logger));
  resolver.registerSourceHandler('PAGE_FIELD', new PageFieldHandler(logger));

  return resolver;
}
