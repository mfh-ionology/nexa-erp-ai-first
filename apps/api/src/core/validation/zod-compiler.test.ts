import Fastify, { type FastifyError } from 'fastify';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ValidationError } from '../errors/index.js';

import {
  convertZodToJsonSchema,
  extractFieldErrors,
  zodSerializerCompiler,
  zodValidatorCompiler,
} from './zod-compiler.js';

interface SuccessResponse {
  success: boolean;
  data: unknown;
}

interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

describe('extractFieldErrors', () => {
  it('maps issues to field-level errors by path', () => {
    const issues = [
      { path: ['name'], message: 'Required' },
      { path: ['email'], message: 'Invalid email' },
      { path: ['email'], message: 'Too short' },
    ];

    const result = extractFieldErrors(issues);

    expect(result).toEqual({
      name: ['Required'],
      email: ['Invalid email', 'Too short'],
    });
  });

  it('uses dot notation for nested paths', () => {
    const issues = [
      { path: ['address', 'street'], message: 'Required' },
      { path: ['items', 0, 'quantity'], message: 'Must be positive' },
    ];

    const result = extractFieldErrors(issues);

    expect(result).toEqual({
      'address.street': ['Required'],
      'items.0.quantity': ['Must be positive'],
    });
  });

  it('uses _root key for path-less issues', () => {
    const issues = [{ path: [], message: 'Invalid input' }];

    const result = extractFieldErrors(issues);

    expect(result).toEqual({
      _root: ['Invalid input'],
    });
  });

  it('returns empty object for no issues', () => {
    expect(extractFieldErrors([])).toEqual({});
  });
});

describe('zodValidatorCompiler', () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
  });

  const validate = zodValidatorCompiler({
    schema: testSchema,
    method: 'POST',
    url: '/test',
    httpPart: 'body',
  });

  it('returns value for valid data', () => {
    const result = validate({ name: 'Alice', age: 30 });

    expect(result).toEqual({ value: { name: 'Alice', age: 30 } });
  });

  it('returns ValidationError for invalid data', () => {
    const result = validate({ name: '', age: -1 }) as {
      error: ValidationError;
    };

    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error.statusCode).toBe(400);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.details).toBeDefined();
    expect(result.error.details!['name']).toBeDefined();
    expect(result.error.details!['age']).toBeDefined();
  });

  it('returns ValidationError for missing required fields', () => {
    const result = validate({}) as { error: ValidationError };

    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error.details).toBeDefined();
    expect(Object.keys(result.error.details!).length).toBeGreaterThan(0);
  });

  it('strips unknown fields from output value', () => {
    const strictSchema = z.object({ name: z.string() }).strict();
    const strictValidate = zodValidatorCompiler({
      schema: strictSchema,
      method: 'POST',
      url: '/test',
      httpPart: 'body',
    });

    const result = strictValidate({ name: 'Bob', extra: true }) as {
      error: ValidationError;
    };

    expect(result.error).toBeInstanceOf(ValidationError);
  });
});

describe('zodSerializerCompiler', () => {
  it('serializes data to JSON string', () => {
    const serialize = zodSerializerCompiler({
      schema: z.object({ id: z.string() }),
      method: 'GET',
      url: '/test',
      httpStatus: '200',
    });

    const result = serialize({ id: '123', name: 'Test' });

    expect(result).toBe(JSON.stringify({ id: '123', name: 'Test' }));
    expect(JSON.parse(result)).toEqual({ id: '123', name: 'Test' });
  });
});

describe('convertZodToJsonSchema', () => {
  it('converts a Zod object schema to JSON Schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const jsonSchema = convertZodToJsonSchema(schema);

    expect(jsonSchema).toHaveProperty('type', 'object');
    expect(jsonSchema).toHaveProperty('properties');
    const props = jsonSchema['properties'] as Record<string, unknown>;
    expect(props).toHaveProperty('name');
    expect(props).toHaveProperty('age');
  });

  it('converts a Zod string schema to JSON Schema', () => {
    const schema = z.string().min(1).max(100);

    const jsonSchema = convertZodToJsonSchema(schema);

    expect(jsonSchema).toHaveProperty('type', 'string');
    expect(jsonSchema).toHaveProperty('minLength', 1);
    expect(jsonSchema).toHaveProperty('maxLength', 100);
  });
});

describe('Fastify Zod validation integration', () => {
  const bodySchema = z.object({
    email: z.email(),
    name: z.string().min(2),
    age: z.number().int().min(0).max(150),
  });

  function buildTestApp() {
    const app = Fastify({ logger: false });
    app.setValidatorCompiler(zodValidatorCompiler);
    app.setSerializerCompiler(zodSerializerCompiler);

    // Simple error handler to format validation errors for testing
    app.setErrorHandler((error: FastifyError, _request, reply) => {
      if (error.validation) {
        // Fastify-wrapped validation error — our ValidationError is in the cause
        const cause = (error as { cause?: unknown }).cause;
        if (cause instanceof ValidationError) {
          return reply.status(400).send({
            success: false,
            error: {
              code: cause.code,
              message: cause.message,
              details: cause.details,
            },
          });
        }
      }
      if (error instanceof ValidationError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
      }
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
      });
    });

    app.post('/test', { schema: { body: bodySchema } }, async (request, reply) => {
      return reply.send({ success: true, data: request.body });
    });

    return app;
  }

  it('accepts valid request body and returns 200', async () => {
    const app = buildTestApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      payload: { email: 'test@example.com', name: 'Alice', age: 30 },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      email: 'test@example.com',
      name: 'Alice',
      age: 30,
    });

    await app.close();
  });

  it('returns 400 with field errors for invalid body', async () => {
    const app = buildTestApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      payload: { email: 'not-an-email', name: 'A', age: -5 },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
    expect(body.error.details!.email).toBeDefined();
    expect(body.error.details!.email!.length).toBeGreaterThan(0);
    expect(body.error.details!.name).toBeDefined();
    expect(body.error.details!.age).toBeDefined();

    await app.close();
  });

  it('returns 400 with field errors for missing required fields', async () => {
    const app = buildTestApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
    expect(Object.keys(body.error.details!).length).toBeGreaterThanOrEqual(3);

    await app.close();
  });

  it('returns 400 with specific field error messages', async () => {
    const app = buildTestApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      payload: { email: 'bad', name: 'X', age: 200 },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ErrorResponse>();
    const details = body.error.details!;

    // Each field should have at least one error message string
    for (const field of ['email', 'name', 'age']) {
      expect(Array.isArray(details[field])).toBe(true);
      expect(details[field]!.length).toBeGreaterThan(0);
      expect(typeof details[field]![0]).toBe('string');
    }

    await app.close();
  });
});
