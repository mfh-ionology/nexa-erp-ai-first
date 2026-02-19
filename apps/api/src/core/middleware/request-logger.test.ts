import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { loggerOptions } from '../logger/logger.js';
import { correlationIdPlugin } from './correlation-id.js';
import { requestLoggerPlugin } from './request-logger.js';

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  correlationId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  module?: string;
}

function buildApp() {
  const logs: string[] = [];
  const app = Fastify({
    logger: {
      ...loggerOptions,
      stream: {
        write(msg: string) {
          logs.push(msg);
        },
      },
    },
  });
  app.register(correlationIdPlugin);
  app.register(requestLoggerPlugin);
  app.get('/test', (_req, reply) => {
    reply.send({ ok: true });
  });
  app.post('/test', (_req, reply) => {
    reply.status(201).send({ created: true });
  });
  return { app, logs };
}

describe('requestLoggerPlugin', () => {
  it('logs "request completed" on response with required fields', async () => {
    const { app, logs } = buildApp();
    await app.ready();

    await app.inject({ method: 'GET', url: '/test' });

    const logLine = logs.find((l) => l.includes('request completed'));
    expect(logLine).toBeDefined();

    const parsed = JSON.parse(logLine!) as LogEntry;
    expect(parsed.message).toBe('request completed');
    expect(parsed.level).toBe('info');
    expect(parsed.method).toBe('GET');
    expect(parsed.url).toBe('/test');
    expect(parsed.statusCode).toBe(200);
    expect(typeof parsed.responseTime).toBe('number');
    expect(parsed.timestamp).toBeDefined();

    await app.close();
  });

  it('includes correlationId from correlation-id plugin', async () => {
    const { app, logs } = buildApp();
    await app.ready();

    const correlationId = 'test-corr-id-abc';
    await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-correlation-id': correlationId },
    });

    const logLine = logs.find((l) => l.includes('request completed'));
    expect(logLine).toBeDefined();

    const parsed = JSON.parse(logLine!) as LogEntry;
    expect(parsed.correlationId).toBe(correlationId);

    await app.close();
  });

  it('includes generated correlationId when header not provided', async () => {
    const { app, logs } = buildApp();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/test' });
    const headerCorrId = response.headers['x-correlation-id'];

    const logLine = logs.find((l) => l.includes('request completed'));
    expect(logLine).toBeDefined();

    const parsed = JSON.parse(logLine!) as LogEntry;
    expect(parsed.correlationId).toBe(headerCorrId);

    await app.close();
  });

  it('logs correct statusCode for non-200 responses', async () => {
    const { app, logs } = buildApp();
    await app.ready();

    await app.inject({ method: 'POST', url: '/test' });

    const logLine = logs.find((l) => l.includes('request completed'));
    expect(logLine).toBeDefined();

    const parsed = JSON.parse(logLine!) as LogEntry;
    expect(parsed.statusCode).toBe(201);
    expect(parsed.method).toBe('POST');

    await app.close();
  });

  it('logs correct url for different routes', async () => {
    const logs: string[] = [];
    const app = Fastify({
      logger: {
        ...loggerOptions,
        stream: {
          write(msg: string) {
            logs.push(msg);
          },
        },
      },
    });
    app.register(correlationIdPlugin);
    app.register(requestLoggerPlugin);
    app.get('/api/v1/health', (_req, reply) => {
      reply.send({ status: 'ok' });
    });
    await app.ready();

    await app.inject({ method: 'GET', url: '/api/v1/health' });

    const logLine = logs.find((l) => l.includes('request completed'));
    expect(logLine).toBeDefined();

    const parsed = JSON.parse(logLine!) as LogEntry;
    expect(parsed.url).toBe('/api/v1/health');

    await app.close();
  });

  it('binds correlationId to request.log so route-level logs include it', async () => {
    const logs: string[] = [];
    const app = Fastify({
      logger: {
        ...loggerOptions,
        stream: {
          write(msg: string) {
            logs.push(msg);
          },
        },
      },
    });
    app.register(correlationIdPlugin);
    app.register(requestLoggerPlugin);
    app.get('/log-test', (req, reply) => {
      req.log.info({ module: 'test' }, 'handler log');
      reply.send({ ok: true });
    });
    await app.ready();

    const correlationId = 'handler-corr-456';
    await app.inject({
      method: 'GET',
      url: '/log-test',
      headers: { 'x-correlation-id': correlationId },
    });

    const handlerLog = logs.find((l) => l.includes('handler log'));
    expect(handlerLog).toBeDefined();

    const parsed = JSON.parse(handlerLog!) as LogEntry;
    expect(parsed.correlationId).toBe(correlationId);
    expect(parsed.module).toBe('test');

    await app.close();
  });
});
