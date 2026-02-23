import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

import { eventBusPlugin } from './event-bus.plugin.js';
import { eventBus, EventBus } from './event-bus.js';

/** Flush queueMicrotask-scheduled handlers */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('eventBusPlugin (Task 7)', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    eventBus.removeAllListeners();
    await app?.close();
  });

  // =========================================================================
  // 7.2 — fastify.eventBus is available and is an instance of EventBus
  // =========================================================================

  it('decorates fastify with eventBus after plugin registration', async () => {
    app = Fastify({ logger: false });
    await app.register(eventBusPlugin);
    await app.ready();

    expect(app.eventBus).toBeDefined();
    expect(app.eventBus).toBeInstanceOf(EventBus);
    expect(app.eventBus).toBe(eventBus); // same singleton
  });

  // =========================================================================
  // 7.3 — request.server.eventBus is accessible from within a route handler
  // =========================================================================

  it('exposes eventBus via request.server.eventBus inside a route handler', async () => {
    app = Fastify({ logger: false });
    await app.register(eventBusPlugin);

    app.get('/test-event-bus', async (request) => {
      return {
        hasEventBus: request.server.eventBus !== undefined,
        isEventBus: request.server.eventBus instanceof EventBus,
        isSingleton: request.server.eventBus === eventBus,
      };
    });

    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/test-event-bus' });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      hasEventBus: boolean;
      isEventBus: boolean;
      isSingleton: boolean;
    }>();
    expect(body.hasEventBus).toBe(true);
    expect(body.isEventBus).toBe(true);
    expect(body.isSingleton).toBe(true);
  });

  // =========================================================================
  // 7.4 — Events emitted via fastify.eventBus are received by subscribers
  // =========================================================================

  it('delivers events emitted via fastify.eventBus to registered subscribers', async () => {
    app = Fastify({ logger: false });
    await app.register(eventBusPlugin);
    await app.ready();

    const handler = vi.fn();
    app.eventBus.on('user.login', handler);

    const payload = {
      userId: 'u-integration',
      companyId: 'c1',
      loginMethod: 'password',
      ipAddress: '10.0.0.1',
    };
    app.eventBus.emit('user.login', payload);

    await flushMicrotasks();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  // =========================================================================
  // onClose — drains pending handlers and clears logger on shutdown
  // =========================================================================

  it('drains pending handlers on app.close()', async () => {
    app = Fastify({ logger: false });
    await app.register(eventBusPlugin);
    await app.ready();

    const executionOrder: string[] = [];

    app.eventBus.on('user.login', async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      executionOrder.push('handler-done');
    });

    app.eventBus.emit('user.login', {
      userId: 'u-drain',
      companyId: 'c1',
      loginMethod: 'password',
    });

    // close() triggers onClose hook which calls drain()
    await app.close();

    expect(executionOrder).toContain('handler-done');
  });
});
