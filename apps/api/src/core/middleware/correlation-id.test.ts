import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { correlationIdPlugin } from './correlation-id.js';

interface CorrelationBody {
  correlationId: string;
}

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(correlationIdPlugin);
  app.get('/test', (req, reply) => {
    reply.send({ correlationId: req.correlationId });
  });
  return app;
}

describe('correlationIdPlugin', () => {
  it('generates a UUID correlation ID when header is not present', async () => {
    const app = buildApp();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/test' });
    const body = response.json<CorrelationBody>();
    const headerValue = response.headers['x-correlation-id'];

    expect(headerValue).toBeDefined();
    expect(typeof headerValue).toBe('string');
    // UUID v4 format
    expect(headerValue).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(body.correlationId).toBe(headerValue);

    await app.close();
  });

  it('uses the incoming X-Correlation-ID header when present', async () => {
    const app = buildApp();
    await app.ready();

    const incomingId = 'my-custom-correlation-id-123';
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-correlation-id': incomingId },
    });
    const body = response.json<CorrelationBody>();

    expect(response.headers['x-correlation-id']).toBe(incomingId);
    expect(body.correlationId).toBe(incomingId);

    await app.close();
  });

  it('generates unique IDs for different requests', async () => {
    const app = buildApp();
    await app.ready();

    const response1 = await app.inject({ method: 'GET', url: '/test' });
    const response2 = await app.inject({ method: 'GET', url: '/test' });

    const id1 = response1.headers['x-correlation-id'];
    const id2 = response2.headers['x-correlation-id'];

    expect(id1).not.toBe(id2);

    await app.close();
  });

  it('decorates request.correlationId accessible in route handlers', async () => {
    const app = buildApp();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/test' });
    const body = response.json<CorrelationBody>();

    expect(body.correlationId).toBeDefined();
    expect(typeof body.correlationId).toBe('string');
    expect(body.correlationId.length).toBeGreaterThan(0);

    await app.close();
  });

  it('rejects overly long correlation IDs and generates a new UUID', async () => {
    const app = buildApp();
    await app.ready();

    const longId = 'a'.repeat(200);
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-correlation-id': longId },
    });

    const headerValue = response.headers['x-correlation-id'] as string;
    expect(headerValue).not.toBe(longId);
    // Should have generated a UUID instead
    expect(headerValue).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    await app.close();
  });

  it('rejects correlation IDs with unsafe characters (log-injection)', async () => {
    const app = buildApp();
    await app.ready();

    const maliciousId = 'legit-id\n{"level":"error","message":"injected"}';
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-correlation-id': maliciousId },
    });

    const headerValue = response.headers['x-correlation-id'] as string;
    expect(headerValue).not.toBe(maliciousId);
    expect(headerValue).not.toContain('\n');

    await app.close();
  });
});
