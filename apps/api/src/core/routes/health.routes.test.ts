import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock @nexa/db — buildApp transitively imports it via auth modules
vi.mock('@nexa/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    userCompanyRole: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
  resolveUserRole: vi.fn(),
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
  VatScheme: {
    STANDARD: 'STANDARD',
    FLAT_RATE: 'FLAT_RATE',
    CASH: 'CASH',
  },
  ResourceType: {
    PAGE: 'PAGE',
    REPORT: 'REPORT',
    SETTING: 'SETTING',
    MAINTENANCE: 'MAINTENANCE',
  },
  FieldVisibility: {
    VISIBLE: 'VISIBLE',
    READ_ONLY: 'READ_ONLY',
    HIDDEN: 'HIDDEN',
  },
  ViewScope: {
    PERSONAL: 'PERSONAL',
    ROLE: 'ROLE',
    GLOBAL: 'GLOBAL',
  },
  PinPosition: {
    NONE: 'NONE',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
  },
  FilterOperator: {
    EQUALS: 'EQUALS',
    NOT_EQUALS: 'NOT_EQUALS',
    CONTAINS: 'CONTAINS',
    STARTS_WITH: 'STARTS_WITH',
    ENDS_WITH: 'ENDS_WITH',
    GT: 'GT',
    GTE: 'GTE',
    LT: 'LT',
    LTE: 'LTE',
    BETWEEN: 'BETWEEN',
    IN: 'IN',
    NOT_IN: 'NOT_IN',
    IS_EMPTY: 'IS_EMPTY',
    IS_NOT_EMPTY: 'IS_NOT_EMPTY',
  },
}));

// Mock argon2 to avoid native module issues in unit tests
vi.mock('argon2', () => ({
  default: {
    verify: vi.fn(),
    hash: vi.fn(),
    argon2id: 2,
  },
}));

beforeAll(() => {
  vi.stubEnv('JWT_SECRET', 'test-secret-that-is-at-least-32-chars-long!!');
});

import { buildApp } from '../../app.js';

interface HealthData {
  status: string;
  version: string;
  uptime: number;
}

interface HealthEnvelope {
  success: true;
  data: HealthData;
}

describe('GET /health (Task 9)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 with success envelope containing status "ok"', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json<HealthEnvelope>();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  it('includes version from package.json', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });

    const body = res.json<HealthEnvelope>();
    expect(body.data.version).toBeDefined();
    expect(typeof body.data.version).toBe('string');
  });

  it('includes uptime as a number', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });

    const body = res.json<HealthEnvelope>();
    expect(body.data.uptime).toBeDefined();
    expect(typeof body.data.uptime).toBe('number');
    expect(body.data.uptime).toBeGreaterThan(0);
  });

  it('returns the full expected shape { success, data: { status, version, uptime } }', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json<HealthEnvelope>();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          status: 'ok',
          version: expect.any(String) as string,
          uptime: expect.any(Number) as number,
        }) as HealthData,
      }),
    );
  });
});
