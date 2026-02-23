import type { PlatformClient } from './platform-client.interface.js';
import { PlatformClientService } from './platform-client.service.js';
import type { PlatformClientConfig } from './types/index.js';

/**
 * Factory function to create a configured PlatformClient instance.
 *
 * Validates required config, creates cache backend (Redis or Memory)
 * and circuit breaker internally, and returns the ready-to-use client.
 *
 * @example
 * ```ts
 * import { createPlatformClient } from '@nexa/platform-client';
 *
 * const client = createPlatformClient({
 *   platformApiUrl: process.env.PLATFORM_API_URL!,
 *   serviceToken: process.env.PLATFORM_SERVICE_TOKEN!,
 *   redisUrl: process.env.REDIS_URL,
 * });
 *
 * const { entitlements, degraded } = await client.getEntitlements(tenantId);
 * ```
 */
export function createPlatformClient(config: PlatformClientConfig): PlatformClient {
  if (!config.platformApiUrl) {
    throw new Error('PlatformClientConfig: platformApiUrl is required');
  }
  if (!config.serviceToken) {
    throw new Error('PlatformClientConfig: serviceToken is required');
  }

  return new PlatformClientService(config);
}
