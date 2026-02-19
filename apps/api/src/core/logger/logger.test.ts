import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { createChildLogger, loggerOptions } from './logger.js';

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  module?: string;
  entity?: string;
  entityId?: string;
  action?: string;
  isAiAction?: boolean;
}

describe('loggerOptions', () => {
  it('uses "info" as default log level', () => {
    expect(loggerOptions.level).toBe('info');
  });

  it('renames msg key to message', () => {
    expect(loggerOptions.messageKey).toBe('message');
  });

  it('produces ISO 8601 timestamp', () => {
    const ts = (loggerOptions.timestamp as () => string)();
    // Format: ,"timestamp":"2026-..."
    const match = ts.match(/"timestamp":"(.+?)"/);
    expect(match).not.toBeNull();
    const parsed = new Date(match![1]!);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it('formats level as string label instead of numeric', () => {
    const formatter = loggerOptions.formatters!.level!;
    expect(formatter('info', 30)).toEqual({ level: 'info' });
    expect(formatter('error', 50)).toEqual({ level: 'error' });
  });

  it('redacts authorization and cookie headers', () => {
    expect(loggerOptions.redact).toContain('req.headers.authorization');
    expect(loggerOptions.redact).toContain('req.headers.cookie');
  });
});

describe('loggerOptions integration with Fastify', () => {
  it('produces structured JSON logs with required fields', async () => {
    const logs: string[] = [];

    const app = Fastify({
      logger: {
        ...loggerOptions,
        // Capture log output to a writable stream
        stream: {
          write(msg: string) {
            logs.push(msg);
          },
        },
      },
    });

    app.get('/test', (_req, reply) => {
      _req.log.info({ module: 'test' }, 'Test log entry');
      reply.send({ ok: true });
    });

    await app.ready();
    await app.inject({ method: 'GET', url: '/test' });

    // Find the "Test log entry" log line
    const logLine = logs.find((l) => l.includes('Test log entry'));
    expect(logLine).toBeDefined();

    const parsed = JSON.parse(logLine!) as LogEntry;
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Test log entry');
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.module).toBe('test');
    // Pino numeric level should NOT be the level field value
    expect(typeof parsed.level).toBe('string');

    await app.close();
  });
});

describe('createChildLogger', () => {
  it('creates a child logger that inherits context fields', async () => {
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

    app.get('/child-test', (req, reply) => {
      const childLog = createChildLogger(req.log, {
        correlationId: 'corr-123',
        tenantId: 'tenant-abc',
        userId: 'user-456',
        module: 'ar',
        entity: 'invoice',
        entityId: 'inv-789',
        action: 'approve',
        isAiAction: false,
      });
      childLog.info('Invoice approved');
      reply.send({ ok: true });
    });

    await app.ready();
    await app.inject({ method: 'GET', url: '/child-test' });

    const logLine = logs.find((l) => l.includes('Invoice approved'));
    expect(logLine).toBeDefined();

    const parsed = JSON.parse(logLine!) as LogEntry;
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Invoice approved');
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.correlationId).toBe('corr-123');
    expect(parsed.tenantId).toBe('tenant-abc');
    expect(parsed.userId).toBe('user-456');
    expect(parsed.module).toBe('ar');
    expect(parsed.entity).toBe('invoice');
    expect(parsed.entityId).toBe('inv-789');
    expect(parsed.action).toBe('approve');
    expect(parsed.isAiAction).toBe(false);

    await app.close();
  });

  it('allows partial context (only some fields)', async () => {
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

    app.get('/partial', (req, reply) => {
      const childLog = createChildLogger(req.log, {
        module: 'system',
        correlationId: 'corr-partial',
      });
      childLog.warn('Partial context log');
      reply.send({ ok: true });
    });

    await app.ready();
    await app.inject({ method: 'GET', url: '/partial' });

    const logLine = logs.find((l) => l.includes('Partial context log'));
    expect(logLine).toBeDefined();

    const parsed = JSON.parse(logLine!) as LogEntry;
    expect(parsed.level).toBe('warn');
    expect(parsed.module).toBe('system');
    expect(parsed.correlationId).toBe('corr-partial');
    // Fields not provided should not be present
    expect(parsed.tenantId).toBeUndefined();
    expect(parsed.entity).toBeUndefined();

    await app.close();
  });
});
