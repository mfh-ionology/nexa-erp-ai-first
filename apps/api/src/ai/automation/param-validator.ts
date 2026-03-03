// ---------------------------------------------------------------------------
// ToolParamValidator — Validates LLM-generated tool call parameters against
// the tool's JSON schema before execution.
// E5c-1 Task 5: AC #12, #13, #14, #15, #16
// ---------------------------------------------------------------------------

import type { ToolCall } from '@nexa/ai-gateway';
import type { ToolDefinition, JsonSchema, JsonSchemaProperty } from '@nexa/ai-tools';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MissingParam {
  /** Dot/bracket-notation path, e.g. "amount" or "lines[0].quantity" */
  path: string;
  /** Human-readable description from the schema (for user prompts) */
  description: string;
}

export interface ParamValidationResult {
  valid: boolean;
  missingParams: MissingParam[];
}

export type ExecutionMode = 'INTERACTIVE' | 'AUTONOMOUS';

// ─── ToolParamValidator ─────────────────────────────────────────────────────

/**
 * Validates tool call inputs against the tool definition's inputSchema.
 *
 * - Checks ALL required fields at top-level and nested levels
 * - Supports arrays of objects with nested required fields (2 levels deep)
 * - Returns ALL missing params in a single batch (AC #16)
 * - Optional params (not in `required`) pass through without validation (AC #13)
 */
export class ToolParamValidator {
  /**
   * Validate a tool call's input against the tool definition's inputSchema.
   *
   * @returns ParamValidationResult with `valid: true` if all required fields
   *          are present, or `valid: false` with a list of all missing params.
   */
  validate(toolCall: ToolCall, toolDef: ToolDefinition): ParamValidationResult {
    const schema = toolDef.inputSchema;
    const input = toolCall.input;
    const missingParams: MissingParam[] = [];

    this.validateObject(schema, input, '', missingParams);

    return {
      valid: missingParams.length === 0,
      missingParams,
    };
  }

  /**
   * Build a clarification message listing all missing params (AC #16 — batch).
   * Used in INTERACTIVE mode to prompt the user for all missing values at once.
   */
  buildClarificationMessage(toolName: string, missingParams: MissingParam[]): string {
    const lines = missingParams.map(
      (p) => `- **${p.path}**: ${p.description || 'Required parameter'}`,
    );

    return [
      `I need the following information to proceed with ${toolName}:`,
      '',
      ...lines,
      '',
      'Please provide all of the above values.',
    ].join('\n');
  }

  /**
   * Build an error message for AUTONOMOUS mode (AC #15).
   * Returns the UNRESOLVABLE_REQUIRED_PARAM error with all param names.
   */
  buildAutonomousError(missingParams: MissingParam[]): string {
    const paramNames = missingParams.map((p) => p.path).join(', ');
    return `UNRESOLVABLE_REQUIRED_PARAM: ${paramNames}`;
  }

  // ─── Private: Schema Traversal ──────────────────────────────────────────

  /**
   * Validate an object value against an object schema.
   * Checks all `required` fields are present and recurses into nested schemas.
   */
  private validateObject(
    schema: JsonSchema | JsonSchemaProperty,
    value: unknown,
    basePath: string,
    missingParams: MissingParam[],
  ): void {
    // If value is not an object (or is null), all required fields are missing
    if (typeof value !== 'object' || value === null) {
      if (schema.required) {
        for (const fieldName of schema.required) {
          const prop = schema.properties?.[fieldName];
          missingParams.push({
            path: basePath ? `${basePath}.${fieldName}` : fieldName,
            description: prop?.description ?? '',
          });
        }
      }
      return;
    }

    const obj = value as Record<string, unknown>;

    // Check all required fields at this level
    if (schema.required) {
      for (const fieldName of schema.required) {
        const fieldPath = basePath ? `${basePath}.${fieldName}` : fieldName;
        const fieldValue = obj[fieldName];

        if (fieldValue === undefined || fieldValue === null) {
          const prop = schema.properties?.[fieldName];
          missingParams.push({
            path: fieldPath,
            description: prop?.description ?? '',
          });
        }
      }
    }

    // Recurse into nested objects and arrays that DO have values
    if (schema.properties) {
      for (const [fieldName, prop] of Object.entries(schema.properties)) {
        const fieldPath = basePath ? `${basePath}.${fieldName}` : fieldName;
        const fieldValue = obj[fieldName];

        // Skip if the field is not present (already caught by required check above)
        if (fieldValue === undefined || fieldValue === null) {
          continue;
        }

        if (prop.type === 'object' && prop.properties) {
          // Nested object — validate recursively
          this.validateObject(prop, fieldValue, fieldPath, missingParams);
        } else if (prop.type === 'array' && prop.items) {
          // Array of items — validate each item
          this.validateArray(prop, fieldValue, fieldPath, missingParams);
        }
      }
    }
  }

  /**
   * Validate an array value against an array schema.
   * For arrays of objects, validates each item's required fields (AC #14).
   * Supports 2 levels of nesting.
   */
  private validateArray(
    prop: JsonSchemaProperty,
    value: unknown,
    basePath: string,
    missingParams: MissingParam[],
  ): void {
    if (!Array.isArray(value) || !prop.items) {
      return;
    }

    // Only validate arrays of objects with required fields
    if (prop.items.type !== 'object' || !prop.items.properties) {
      return;
    }

    for (let i = 0; i < value.length; i++) {
      const itemPath = `${basePath}[${i}]`;
      const item = value[i];

      // Validate the array item as an object
      this.validateObject(prop.items, item, itemPath, missingParams);
    }
  }
}
