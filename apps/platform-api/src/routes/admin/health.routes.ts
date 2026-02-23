import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createRequire } from 'node:module';

import { sendSuccess } from '../../core/utils/response.js';
import { getPlatformPrisma } from '../../client.js';
import { verifyPlatformJwt } from '../../core/auth/platform-auth.service.js';

const require = createRequire(import.meta.url);
const pkg = require('../../../package.json') as { version: string };

const DB_HEALTH_TIMEOUT_MS = 5_000;

interface DbHealth {
  connected: boolean;
  latencyMs: number;
}

interface RedisHealth {
  connected: boolean;
  latencyMs: number;
}

async function checkDatabaseHealth(): Promise<DbHealth> {
  const start = performance.now();
  try {
    const prisma = getPlatformPrisma();
    await Promise.race([
      prisma.$queryRawUnsafe('SELECT 1'),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('DB health check timeout')), DB_HEALTH_TIMEOUT_MS),
      ),
    ]);
    return { connected: true, latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { connected: false, latencyMs: Math.round(performance.now() - start) };
  }
}

const REDIS_HEALTH_TIMEOUT_MS = 3_000;

async function checkRedisHealth(): Promise<RedisHealth | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null; // Redis not configured — omit from health response
  }

  const start = performance.now();
  try {
    // Parse redis URL for host/port
    const url = new URL(redisUrl);
    const host = url.hostname || '127.0.0.1';
    const port = Number(url.port) || 6379;

    const { createConnection } = await import('node:net');
    const connected = await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host, port, timeout: REDIS_HEALTH_TIMEOUT_MS }, () => {
        // Send PING command in RESP protocol
        socket.write('*1\r\n$4\r\nPING\r\n');
      });
      socket.on('data', (data) => {
        socket.destroy();
        // Redis responds with +PONG\r\n
        resolve(data.toString().includes('+PONG'));
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });

    return { connected, latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { connected: false, latencyMs: Math.round(performance.now() - start) };
  }
}

async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/admin/monitoring/health', async (request, reply) => {
    // This route is public (bypasses JWT hook), so we manually check for a
    // valid Bearer token. Unauthenticated callers (load balancers, uptime
    // monitors) get a minimal response. Authenticated admin users get full
    // details (DB/Redis health, version, uptime). This prevents leaking
    // infrastructure details publicly.
    let isAuthenticated = false;
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = await verifyPlatformJwt(authHeader.slice(7));
        isAuthenticated = typeof payload.sub === 'string' && payload.sub.length > 0;
      } catch {
        // Invalid token — treat as unauthenticated
      }
    }

    if (!isAuthenticated) {
      return sendSuccess(reply, { status: 'ok' });
    }

    const [database, redis] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

    const redisDown = redis !== null && !redis.connected;
    const status = database.connected && !redisDown ? 'ok' : 'degraded';

    const data: Record<string, unknown> = {
      status,
      version: pkg.version,
      uptime: process.uptime(),
      database,
    };

    if (redis !== null) {
      data.redis = redis;
    }

    return sendSuccess(reply, data);
  });
}

export const healthRoutesPlugin = fp(healthRoutes, {
  name: 'platform-health-routes',
});
