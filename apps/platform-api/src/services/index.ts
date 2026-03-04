// ---------------------------------------------------------------------------
// Services barrel export — Cross-tenant intelligence pipeline
// Source: E5d-3 Task 9.1
// ---------------------------------------------------------------------------

export { TenantDbConnector } from './tenant-db-connector.js';
export type {
  TenantConnectionInfo,
  TenantDbClient,
  QueryResult,
  ConnectorLogger,
} from './tenant-db-connector.js';

export {
  anonymiseUsagePatterns,
  anonymiseCorrectionPatterns,
  generateCorrectionSummary,
  validateNoPersonalData,
} from './anonymisation.service.js';
export type {
  TenantRawData,
  RawLearningSignal,
  RawCorrectionEntry,
  RawViewRecord,
  RawAutomationRecord,
  AnonymisedPatterns,
  AnonymisedCorrections,
  AnonymisedCorrectionEntry,
  ValidationResult,
} from './anonymisation.service.js';

export { CrossTenantAggregationService } from './cross-tenant-aggregation.service.js';
export type { AggregationResult } from './cross-tenant-aggregation.service.js';

export { InsightsGenerationService } from './insights-generation.service.js';
export type {
  InsightsResult,
  InsightType,
  InsightSeverity,
} from './insights-generation.service.js';

export { KnowledgeDistributionService } from './knowledge-distribution.service.js';
export type {
  PaginationOpts,
  PreviousResponse,
  SuggestedKnowledgeArticle,
  SuggestedKnowledgeResult,
  RecordResponseInput,
} from './knowledge-distribution.service.js';

/**
 * Validates that required environment variables for the intelligence pipeline
 * are present. Returns warnings for missing optional config.
 */
export function validateIntelligenceEnv(): string[] {
  const warnings: string[] = [];

  if (!process.env.TENANT_DB_SERVICE_USER || !process.env.TENANT_DB_SERVICE_PASSWORD) {
    warnings.push(
      'TENANT_DB_SERVICE_USER / TENANT_DB_SERVICE_PASSWORD not set — ' +
        'cross-tenant aggregation endpoints will return 503',
    );
  }

  return warnings;
}
