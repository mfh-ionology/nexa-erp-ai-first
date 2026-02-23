// @nexa/platform-client — Platform API client SDK

// Factory (primary entry point for consumers)
export { createPlatformClient } from './create-platform-client.js';

// Interface (for type-only imports / dependency injection)
export type { PlatformClient } from './platform-client.interface.js';

// All public types
export type {
  AiQuotaCheck,
  AiUsageRecord,
  BillingStatus,
  EnforcementAction,
  EntitlementResult,
  ModuleAccess,
  PlatformClientConfig,
  PlatformWebhookEvent,
  TenantEntitlements,
  TenantStatus,
  TenantStatusResponse,
  UserQuota,
} from './types/index.js';
