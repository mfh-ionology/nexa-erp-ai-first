// @nexa/platform-api — Platform API (Prisma client, types, and enums)
// Re-exports singleton client getter, PlatformPrismaClient type, generated types, and enums

// Lazy singleton client getter — use getPlatformPrisma() for the configured instance
export { getPlatformPrisma } from './client';
// Type alias for the generated PrismaClient (use for type annotations, not instantiation)
export type { PlatformPrismaClient } from './client';

// Generated enums
export {
  TenantStatus,
  BillingStatus,
  EnforcementAction,
  PlatformRole,
} from '../generated/platform-prisma/client';

// Generated model types
export type {
  Tenant,
  Plan,
  TenantModuleOverride,
  TenantFeatureFlag,
  TenantAiQuota,
  TenantAiUsage,
  TenantBilling,
  PlatformUser,
  PlatformAuditLog,
  ImpersonationSession,
} from '../generated/platform-prisma/client';
