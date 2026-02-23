import type { FastifySchemaCompiler, FastifySerializerCompiler } from 'fastify';
import type { ZodType } from 'zod';

import { ValidationError } from '../errors/app-error.js';

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

export const zodSerializerCompiler: FastifySerializerCompiler<ZodType> = ({ schema }) => {
  return (data) => {
    try {
      const parsed = schema.parse(data);
      return JSON.stringify(parsed);
    } catch {
      // Fallback: if response validation fails, serialize as-is.
      // This prevents serialization errors from crashing requests while
      // still stripping unknown fields (e.g. passwordHash) in the happy path.
      return JSON.stringify(data);
    }
  };
};
