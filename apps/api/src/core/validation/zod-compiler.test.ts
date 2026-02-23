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
    messageKey?: string;
    details?: Record<string, string[]>;
  };
}

describe('extractFieldErrors', () => {
  it('maps issues to field-level errors with translated messages', () => {
    const issues = [
      { code: 'invalid_type', path: ['name'], message: 'Required', origin: 'string' },
      { code: 'invalid_format', path: ['email'], message: 'Invalid email', format: 'email', origin: 'string' },
      { code: 'too_small', path: ['email'], message: 'Too short', origin: 'string', minimum: 3 },
    ];

    const result = extractFieldErrors(issues);

    expect(result.name).toBeDefined();
    expect(result.name!.length).toBe(1);
    // invalid_type → validation:required → "name is required"
    expect(result.name![0]).toContain('is required');

    expect(result.email).toBeDefined();
    expect(result.email!.length).toBe(2);
    // invalid_format (email) → validation:email → "Please enter a valid email address"
    expect(result.email![0]).toContain('valid email');
    // too_small (string) → validation:minLength → "email must be at least 3 characters"
    expect(result.email![1]).toContain('at least');
  });

  it('uses dot notation for nested paths', () => {
    const issues = [
      { code: 'invalid_type', path: ['address', 'street'], message: 'Required' },
      { code: 'too_small', path: ['items', 0, 'quantity'], message: 'Must be positive', origin: 'number', minimum: 1 },
    ];

    const result = extractFieldErrors(issues);

    expect(result['address.street']).toBeDefined();
    expect(result['items.0.quantity']).toBeDefined();
    // Field name derived from last path segment: 'street', 'quantity'
    expect(result['address.street']![0]).toContain('is required');
    expect(result['items.0.quantity']![0]).toContain('at least');
  });

  it('uses _root key for path-less issues', () => {
    const issues = [{ code: 'custom', path: [], message: 'Invalid input' }];

    const result = extractFieldErrors(issues);

    expect(result._root).toBeDefined();
    expect(result._root!.length).toBe(1);
    // 'Invalid input' doesn't look like a translation key → validation:invalid
    expect(result._root![0]).toContain('invalid');
  });

  it('returns empty object for no issues', () => {
    expect(extractFieldErrors([])).toEqual({});
  });

  it('produces translated messages for too_small string issues', () => {
    const issues = [
      { code: 'too_small', path: ['name'], message: 'Too small', origin: 'string', minimum: 2 },
    ];

    const result = extractFieldErrors(issues);

    // validation:minLength → "name must be at least 2 characters"
    expect(result.name![0]).toContain('at least');
    expect(result.name![0]).toContain('2');
  });

  it('produces translated messages for too_big string issues', () => {
    const issues = [
      { code: 'too_big', path: ['name'], message: 'Too big', origin: 'string', maximum: 100 },
    ];

    const result = extractFieldErrors(issues);

    // validation:maxLength → "name must not exceed 100 characters"
    expect(result.name![0]).toContain('exceed');
    expect(result.name![0]).toContain('100');
  });

  it('produces translated messages for too_small number issues', () => {
    const issues = [
      { code: 'too_small', path: ['age'], message: 'Too small', origin: 'number', minimum: 0 },
    ];

    const result = extractFieldErrors(issues);

    // validation:min → "age must be at least 0"
    expect(result.age![0]).toContain('at least');
  });

  it('produces translated messages for too_big number issues', () => {
    const issues = [
      { code: 'too_big', path: ['age'], message: 'Too big', origin: 'number', maximum: 150 },
    ];

    const result = extractFieldErrors(issues);

    // validation:max → "age must not exceed 150"
    expect(result.age![0]).toContain('exceed');
    expect(result.age![0]).toContain('150');
  });

  it('produces translated messages for invalid_format email issues', () => {
    const issues = [
      { code: 'invalid_format', path: ['email'], message: 'Invalid email', format: 'email', origin: 'string' },
    ];

    const result = extractFieldErrors(issues);

    // validation:email → "Please enter a valid email address"
    expect(result.email![0]).toContain('valid email');
  });

  it('produces translated messages for invalid_format regex issues', () => {
    const issues = [
      { code: 'invalid_format', path: ['code'], message: 'Invalid string', format: 'regex', origin: 'string' },
    ];

    const result = extractFieldErrors(issues);

    // validation:pattern → "code format is invalid"
    expect(result.code![0]).toContain('invalid');
  });

  it('uses custom message as translation key when it looks like one', () => {
    const issues = [
      { code: 'custom', path: ['field'], message: 'validation:unique' },
    ];

    const result = extractFieldErrors(issues);

    // validation:unique → "field already exists"
    expect(result.field![0]).toContain('already exists');
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

  it('returns ValidationError with messageKey for invalid data', () => {
    const result = validate({ name: '', age: -1 }) as {
      error: ValidationError;
    };

    expect(result.error.messageKey).toBe('errors:VALIDATION_ERROR');
  });

  it('returns ValidationError with translated message', () => {
    const result = validate({ name: '', age: -1 }) as {
      error: ValidationError;
    };

    // errors:VALIDATION_ERROR → "Please correct the errors below"
    expect(result.error.message).toBe('Please correct the errors below');
  });

  it('returns ValidationError for missing required fields', () => {
    const result = validate({}) as { error: ValidationError };

    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error.details).toBeDefined();
    expect(Object.keys(result.error.details!).length).toBeGreaterThan(0);
  });

  it('returns translated field errors for missing required fields', () => {
    const result = validate({}) as { error: ValidationError };

    // invalid_type → validation:required → "X is required"
    for (const messages of Object.values(result.error.details!)) {
      expect(messages[0]).toContain('is required');
    }
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
              messageKey: cause.messageKey,
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
            messageKey: error.messageKey,
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

  it('returns translated validation message and messageKey', async () => {
    const app = buildTestApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      payload: { email: 'bad', name: 'X', age: 200 },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ErrorResponse>();
    expect(body.error.message).toBe('Please correct the errors below');
    expect(body.error.messageKey).toBe('errors:VALIDATION_ERROR');

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

  it('returns translated field error messages', async () => {
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

    // Each field should have translated error messages
    for (const field of ['email', 'name', 'age']) {
      expect(Array.isArray(details[field])).toBe(true);
      expect(details[field]!.length).toBeGreaterThan(0);
      expect(typeof details[field]![0]).toBe('string');
    }

    // email: invalid_format (email) → "Please enter a valid email address"
    expect(details.email![0]).toContain('valid email');
    // name: too_small (string, min=2) → "name must be at least 2 characters"
    expect(details.name![0]).toContain('at least');
    // age: too_big (number, max=150) → "age must not exceed 150"
    expect(details.age![0]).toContain('exceed');

    await app.close();
  });

  it('returns translated required messages for missing fields', async () => {
    const app = buildTestApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = response.json<ErrorResponse>();
    const details = body.error.details!;

    // All missing fields should produce "X is required" messages
    for (const field of ['email', 'name', 'age']) {
      expect(details[field]).toBeDefined();
      expect(details[field]![0]).toContain('is required');
    }

    await app.close();
  });
});
