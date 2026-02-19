import type { FastifySchema, FastifySchemaCompiler, FastifySerializerCompiler } from 'fastify';
import type { ZodType } from 'zod';

import { ValidationError } from '../errors/index.js';

/**
 * Extract field-level errors from Zod issues into Record<string, string[]>.
 * Maps each issue's path to a dot-separated key with its error message.
 */
export function extractFieldErrors(
  issues: ReadonlyArray<{
    readonly path: PropertyKey[];
    readonly message: string;
  }>,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_root';
    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

/**
 * Fastify validator compiler that validates requests against Zod schemas.
 * Returns a ValidationError with field-level details on failure.
 *
 * Usage: fastify.setValidatorCompiler(zodValidatorCompiler)
 */
export const zodValidatorCompiler: FastifySchemaCompiler<ZodType> = ({ schema }) => {
  return (data: unknown) => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { value: result.data };
    }
    const fieldErrors = extractFieldErrors(result.error.issues);
    return { error: new ValidationError('Validation failed', fieldErrors) };
  };
};

/**
 * Fastify serializer compiler for Zod response schemas.
 * Serializes response data as JSON.
 *
 * Usage: fastify.setSerializerCompiler(zodSerializerCompiler)
 */
export const zodSerializerCompiler: FastifySerializerCompiler<ZodType> = () => {
  return (data) => JSON.stringify(data);
};

/**
 * Convert a Zod schema to JSON Schema.
 * Uses Zod 4's built-in toJSONSchema() method instead of the `zod-to-json-schema`
 * package (Task 1.1 / Task 6.1 originally specified that dep, but Zod 4 makes it
 * unnecessary — the built-in method produces equivalent output with zero extra deps).
 *
 * Zod 4 does not natively represent z.date() in JSON Schema (dates are not a JSON type).
 * We use `unrepresentable: "any"` to prevent throwing on date schemas, then use `override`
 * to emit `{ type: "string", format: "date-time" }` which is the standard OpenAPI
 * representation for date-time fields.
 */
export function convertZodToJsonSchema(zodSchema: ZodType): Record<string, unknown> {
  return zodSchema.toJSONSchema({
    unrepresentable: 'any',
    override: ({ zodSchema: innerSchema, jsonSchema }) => {
      // Zod 4 date schemas have def.type === 'date'
      const def = (innerSchema as unknown as Record<string, unknown>)._zod as
        | { def?: { type?: string } }
        | undefined;
      if (def?.def?.type === 'date') {
        (jsonSchema as Record<string, unknown>).type = 'string';
        (jsonSchema as Record<string, unknown>).format = 'date-time';
      }
    },
  }) as Record<string, unknown>;
}

/**
 * Check if a value is a Zod schema instance (has safeParse method).
 */
function isZodSchema(value: unknown): value is ZodType {
  return (
    typeof value === 'object' &&
    value !== null &&
    'safeParse' in value &&
    typeof (value as Record<string, unknown>).safeParse === 'function'
  );
}

/**
 * @fastify/swagger transform function that converts Zod schemas to JSON Schema.
 * Without this, routes using Zod schemas produce empty schema definitions in the
 * generated OpenAPI spec because @fastify/swagger expects JSON Schema objects.
 *
 * Usage: fastify.register(swagger, { ..., transform: zodSwaggerTransform })
 */
export function zodSwaggerTransform({
  schema,
  url,
}: {
  schema: FastifySchema | undefined;
  url: string;
}): { schema: FastifySchema; url: string } {
  // Guard: routes registered without a schema pass undefined here
  if (!schema) {
    return { schema: {} as FastifySchema, url };
  }

  const transformed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === 'response' && typeof value === 'object' && value !== null) {
      // Response schemas are keyed by status code
      const responses: Record<string, unknown> = {};
      for (const [status, respSchema] of Object.entries(value as Record<string, unknown>)) {
        responses[status] = isZodSchema(respSchema)
          ? convertZodToJsonSchema(respSchema)
          : respSchema;
      }
      transformed[key] = responses;
    } else {
      transformed[key] = isZodSchema(value) ? convertZodToJsonSchema(value) : value;
    }
  }

  return { schema: transformed as FastifySchema, url };
}
