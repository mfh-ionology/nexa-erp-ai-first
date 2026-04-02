import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
// fp import removed — not needed since aiPlugin is NOT wrapped with fp()
import type { Logger } from 'pino';
import Redis from 'ioredis';
import { prisma } from '@nexa/db';
import {
  createAiGateway,
  ModelRegistry,
  ProviderRegistry,
  CredentialResolver,
  QuotaClientImpl,
  UsageRecorderImpl,
  FallbackHandlerImpl,
  AnthropicAdapter,
  OpenAIAdapter,
  DeepSeekAdapter,
} from '@nexa/ai-gateway';
import type { ByokCredentialSource, ByokCredential } from '@nexa/ai-gateway';

import { PromptManager } from './prompt-manager.js';
import { ResponseParser } from './response-parser.js';
import { ContextEngine } from './context-engine.js';
import { AiOrchestrator } from './orchestrator.js';
import { ChatSessionService } from './chat-session.service.js';
import { AiWebSocketHandler } from './websocket.handler.js';
import { GuardrailsService } from './guardrails.js';
import { ActionPlanner } from './action-planner.js';
import { ActionExecutor } from './action-executor.js';
import { PredictionService } from './prediction.service.js';
import { BriefingEngine } from './briefing-engine.js';
import { BriefingScheduler } from './briefing-scheduler.js';
import { SuggestionsService } from './suggestions.service.js';
import { MemoryService } from './memory.service.js';
import { MemoryInjectionService } from './memory-injection.service.js';
import { ConversationSummaryService } from './conversation-summary.service.js';
import { MemoryPruningService } from './memory-pruning.service.js';
import { SkillRouter } from './skill-router.js';
import { QueryExecutor } from './query-executor.js';
import { DynamicContextService } from './dynamic-context.service.js';
import { ToolRegistry, registerViewsTools } from '@nexa/ai-tools';
import { aiRoutesPlugin } from './ai.routes.js';
import { predictionRoutesPlugin } from './prediction.routes.js';
import { briefingRoutesPlugin } from './briefing.routes.js';
import { memoryRoutesPlugin } from './memory.routes.js';
import { SkillsService } from './skills.service.js';
import { skillsRoutesPlugin } from './skills.routes.js';
import { KnowledgeService } from './knowledge.service.js';
import { knowledgeRoutesPlugin } from './knowledge.routes.js';
import { EntityTriggerService } from './entity-triggers.service.js';
import { EntitySearchService } from './entity-search.service.js';
import { entityTriggersRoutesPlugin } from './entity-triggers.routes.js';
import { SkillOverrideService } from './skill-overrides.service.js';
import { skillOverridesRoutesPlugin } from './skill-overrides.routes.js';
import { automationRoutesPlugin } from './automation/automation.routes.js';
import { AutomationService } from './automation/automation.service.js';
import { AutomationExecutor as AutomationStepExecutor } from './automation/automation-executor.js';
import { AutomationSchedulerService } from './automation/automation-scheduler.js';
import { AutomationEventListener } from './automation/automation-event-listener.js';
import { PromptRenderer } from './prompt-renderer.js';
import { AdminModelService } from './admin/admin-model.service.js';
import { AdminPromptService } from './admin/admin-prompt.service.js';
import { AdminDashboardService } from './admin/admin-dashboard.service.js';
import { AdminAgentService } from './admin/admin-agent.service.js';
import { AdminSkillService } from './admin/admin-skill.service.js';
import { AdminTriggerTestService } from './admin/admin-trigger-test.service.js';
import { AdminAnalyticsService } from './admin/analytics.service.js';
import { adminRoutesPlugin } from './admin/admin.routes.js';
import { KnowledgeArticleService } from './knowledge-article.service.js';
import { knowledgeArticleRoutesPlugin } from './knowledge-article.routes.js';
import { registerKnowledgeArticleEvents } from './knowledge-article.events.js';
import { ChunkingService } from './chunking.service.js';
import { KnowledgeRagService } from './knowledge-rag.service.js';
import { LearningSignalsService } from './learning-signals.service.js';
import { CorrectionCaptureService } from './correction-capture.service.js';
import { CorrectionPatternService } from './correction-pattern.service.js';
import { TrainingExampleService } from './training-example.service.js';
import { TrainingExampleInjectionService } from './training-example-injection.service.js';
import { correctionRoutesPlugin } from './correction.routes.js';
import { trainingExampleRoutesPlugin } from './training-example.routes.js';
// variablesRoutesPlugin removed — GET /variables already in automationRoutesPlugin
import { registerCorrectionEvents } from './correction.events.js';
import { registerViewsQueryHandlers } from './tools/views-query-handlers.js';
import { PatternDetectionService } from './pattern-detection.service.js';
import { MemoryParserService } from './memory-parser.service.js';
import { MemoryCitationService } from './memory-citation.service.js';
import { SemanticDedupService } from './semantic-dedup.service.js';
import { PreCompactionService } from './pre-compaction.service.js';
import { EmbeddingService } from './embedding.service.js';
import { EmbeddingBackfillService } from './embedding-backfill.service.js';
import { VectorSearchService } from './vector-search.service.js';
import { parseRedisUrl } from '../core/events/redis-connection.js';
import { registerSystemActionHandlers } from './action-handlers/system.handlers.js';
import {
  registerFinanceTools,
  registerFinanceQueryHandlers,
  registerFinanceActionHandlers,
} from '../modules/finance/finance-skills.js';
import { registerAuditMapping } from '../core/audit/audit.mappings.js';
import type { AuditAction } from '../core/audit/audit.types.js';
import { permissionService } from '../core/rbac/permission.service.js';

// ---------------------------------------------------------------------------
// Fastify type augmentation
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyInstance {
    aiOrchestrator: AiOrchestrator | null;
    aiContextEngine: ContextEngine | null;
    aiWebSocketHandler: AiWebSocketHandler | null;
    chatSessionService: ChatSessionService | null;
    aiActionPlanner: ActionPlanner | null;
    aiActionExecutor: ActionExecutor | null;
    aiGuardrails: GuardrailsService | null;
    aiPredictionService: PredictionService | null;
    aiBriefingEngine: BriefingEngine | null;
    aiBriefingScheduler: BriefingScheduler | null;
    aiSuggestionsService: SuggestionsService | null;
    aiMemoryService: MemoryService | null;
    aiQueryExecutor: QueryExecutor | null;
    aiToolRegistry: ToolRegistry | null;
    aiSkillRouter: SkillRouter | null;
    aiDynamicContext: DynamicContextService | null;
    aiSkillsService: SkillsService | null;
    aiKnowledgeService: KnowledgeService | null;
    aiEntityTriggerService: EntityTriggerService | null;
    aiEntitySearchService: EntitySearchService | null;
    aiSkillOverrideService: SkillOverrideService | null;
    aiPatternDetection: PatternDetectionService | null;
    aiMemoryParser: MemoryParserService | null;
    aiMemoryCitation: MemoryCitationService | null;
    aiSemanticDedup: SemanticDedupService | null;
    aiPreCompaction: PreCompactionService | null;
    aiAutomationService: AutomationService | null;
    aiPromptRenderer: PromptRenderer | null;
    aiAdminModelService: AdminModelService | null;
    aiAdminPromptService: AdminPromptService | null;
    aiAdminDashboardService: AdminDashboardService | null;
    aiAdminAgentService: AdminAgentService | null;
    aiAdminSkillService: AdminSkillService | null;
    aiAdminTriggerTestService: AdminTriggerTestService | null;
    aiAdminAnalyticsService: AdminAnalyticsService | null;
    aiKnowledgeArticleService: KnowledgeArticleService | null;
    aiKnowledgeRagService: KnowledgeRagService | null;
    aiLearningSignalsService: LearningSignalsService | null;
    aiDb: typeof import('@nexa/db').prisma;
    aiEncryptionKey: string;
    aiCorrectionCaptureService: CorrectionCaptureService | null;
    aiCorrectionPatternService: CorrectionPatternService | null;
    aiTrainingExampleService: TrainingExampleService | null;
    aiTrainingExampleInjectionService: TrainingExampleInjectionService | null;
  }
}

// ---------------------------------------------------------------------------
// BYOK credential source backed by the Platform API (ISSUE #1 FIX)
// ---------------------------------------------------------------------------

/**
 * Fetches BYOK credentials from the Platform API.
 * Returns null when no BYOK key is configured for the tenant/provider.
 */
class PlatformByokSource implements ByokCredentialSource {
  constructor(
    private readonly platformApiUrl: string,
    private readonly serviceToken: string,
    private readonly logger: Logger,
  ) {}

  async getCredential(
    tenantId: string,
    providerId: string,
  ): Promise<{
    id: string;
    tenantId: string;
    providerId: string;
    encryptedKey: string;
    isActive: boolean;
  } | null> {
    const url = `${this.platformApiUrl}/platform/tenants/${tenantId}/credentials/${providerId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.serviceToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5_000),
      });

      if (response.status === 404) {
        // No BYOK key configured — fall through to vendor key
        return null;
      }

      if (!response.ok) {
        this.logger.warn(
          { tenantId, providerId, status: response.status },
          'PlatformByokSource: failed to fetch BYOK credential',
        );
        return null;
      }

      const json = (await response.json()) as { data?: any } & Record<string, unknown>;
      const data = json.data ?? json;

      return {
        id: data.id ?? '',
        tenantId: data.tenantId ?? tenantId,
        providerId: data.providerId ?? providerId,
        encryptedKey: data.encryptedKey ?? '',
        isActive: data.isActive ?? false,
      };
    } catch (err) {
      this.logger.warn(
        { tenantId, providerId, error: (err as Error).message },
        'PlatformByokSource: error fetching BYOK credential, falling back to vendor key',
      );
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// pgvector availability check (E5b-4 Task 9.2)
// ---------------------------------------------------------------------------

/**
 * Check if the pgvector extension is installed in the database.
 * Returns true if pgvector is available, false otherwise.
 * Used to gate VectorSearchService creation — if pgvector is not installed,
 * the system falls back to keyword-based search (graceful degradation).
 */
async function checkPgvectorAvailable(db: typeof prisma, logger: Logger): Promise<boolean> {
  try {
    const result = await db.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    return result.length > 0;
  } catch (err) {
    logger.warn(
      { error: (err as Error).message },
      'checkPgvectorAvailable: failed to query pg_extension — assuming pgvector is not available',
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// AI module plugin
// ---------------------------------------------------------------------------

/**
 * Register all AI routes inside an encapsulated scope.
 * This is necessary because the top-level aiPlugin uses fp() (fastify-plugin)
 * for decorator sharing, which breaks encapsulation and would cause routes to
 * lose their /ai prefix set by the caller in app.ts. By wrapping route
 * registrations in a regular (non-fp) plugin, routes stay scoped under /ai.
 */
async function registerAiRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(aiRoutesPlugin);
  await fastify.register(predictionRoutesPlugin);
  await fastify.register(briefingRoutesPlugin);
  await fastify.register(memoryRoutesPlugin);
  await fastify.register(skillsRoutesPlugin);
  await fastify.register(knowledgeRoutesPlugin);
  await fastify.register(entityTriggersRoutesPlugin);
  await fastify.register(skillOverridesRoutesPlugin);
  await fastify.register(knowledgeArticleRoutesPlugin);
  await fastify.register(correctionRoutesPlugin);
  await fastify.register(trainingExampleRoutesPlugin);
  await fastify.register(automationRoutesPlugin);
  // variablesRoutesPlugin removed — GET /variables is already in automationRoutesPlugin
  await fastify.register(adminRoutesPlugin, { prefix: '/admin' });
}

const aiPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  // Check if AI Gateway can be configured
  const platformApiUrl = process.env.PLATFORM_API_URL ?? 'http://localhost:5101/api/v1';
  const serviceToken = process.env.PLATFORM_SERVICE_TOKEN;
  const redisUrl = process.env.REDIS_URL;
  const aiEncryptionKeyRaw = process.env.AI_ENCRYPTION_KEY ?? '';
  // Derive a proper 32-byte hex key for AES-256-GCM encryption
  const aiEncryptionKey = aiEncryptionKeyRaw
    ? createHash('sha256').update(aiEncryptionKeyRaw).digest('hex')
    : '';

  if (!serviceToken) {
    fastify.log.warn('PLATFORM_SERVICE_TOKEN not set — AI module disabled (graceful degradation)');
    fastify.decorate('aiOrchestrator', null);
    fastify.decorate('aiContextEngine', null);
    fastify.decorate('aiWebSocketHandler', null);
    fastify.decorate('chatSessionService', null);
    fastify.decorate('aiActionPlanner', null);
    fastify.decorate('aiActionExecutor', null);
    fastify.decorate('aiGuardrails', null);
    fastify.decorate('aiPredictionService', null);
    fastify.decorate('aiBriefingEngine', null);
    fastify.decorate('aiBriefingScheduler', null);
    fastify.decorate('aiSuggestionsService', null);
    fastify.decorate('aiMemoryService', null);
    fastify.decorate('aiQueryExecutor', null);
    fastify.decorate('aiToolRegistry', null);
    fastify.decorate('aiSkillRouter', null);
    fastify.decorate('aiDynamicContext', null);
    fastify.decorate('aiSkillsService', null);
    fastify.decorate('aiKnowledgeService', null);
    fastify.decorate('aiEntityTriggerService', null);
    fastify.decorate('aiEntitySearchService', null);
    fastify.decorate('aiSkillOverrideService', null);
    fastify.decorate('aiPatternDetection', null);
    fastify.decorate('aiMemoryParser', null);
    fastify.decorate('aiMemoryCitation', null);
    fastify.decorate('aiSemanticDedup', null);
    fastify.decorate('aiPreCompaction', null);
    fastify.decorate('aiAutomationService', null);
    fastify.decorate('aiPromptRenderer', null);
    fastify.decorate('aiAdminModelService', null);
    fastify.decorate('aiAdminPromptService', null);
    fastify.decorate('aiAdminDashboardService', null);
    fastify.decorate('aiAdminAgentService', null);
    fastify.decorate('aiAdminSkillService', null);
    fastify.decorate('aiAdminTriggerTestService', null);
    fastify.decorate('aiAdminAnalyticsService', null);
    fastify.decorate('aiKnowledgeArticleService', null);
    fastify.decorate('aiKnowledgeRagService', null);
    fastify.decorate('aiLearningSignalsService', null);
    fastify.decorate('aiDb', prisma);
    fastify.decorate('aiCorrectionCaptureService', null);
    fastify.decorate('aiCorrectionPatternService', null);
    fastify.decorate('aiTrainingExampleService', null);
    fastify.decorate('aiTrainingExampleInjectionService', null);
    fastify.decorate('aiEncryptionKey', aiEncryptionKey);
    // Still register routes — they will return 503 when orchestrator/service is null
    // Use registerAiRoutes wrapper to preserve /ai prefix (see comment at line 226)
    await fastify.register(registerAiRoutes);
    return;
  }

  const logger = fastify.log as unknown as Logger;

  try {
    // Build Redis connection for context cache
    const redis = new Redis(redisUrl ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await redis.connect();

    // ISSUE #5 FIX: Call ModelRegistry with correct constructor shape
    const modelRegistry = new ModelRegistry();

    // ISSUE #2 FIX: Register provider adapters before use
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(new AnthropicAdapter());
    providerRegistry.register(new OpenAIAdapter());
    providerRegistry.register(new DeepSeekAdapter());

    // ISSUE #1 FIX: Construct CredentialResolver with correct arguments
    // Composite source: check tenant SystemSetting first, then Platform BYOK
    const platformByokSource = new PlatformByokSource(platformApiUrl, serviceToken, logger);
    const compositeByokSource: ByokCredentialSource = {
      async getCredential(tenantId: string, providerId: string): Promise<ByokCredential | null> {
        // 1. Check tenant SystemSetting for provider API key
        try {
          const setting = await prisma.systemSetting.findFirst({
            where: { key: `ai_provider_key_${providerId}` },
          });
          if (setting?.value) {
            return {
              id: setting.id,
              tenantId,
              providerId,
              encryptedKey: setting.value,
              isActive: true,
            };
          }
        } catch (err) {
          logger.warn(
            { providerId, error: (err as Error).message },
            'Failed to read provider key from SystemSetting, falling back to platform BYOK',
          );
        }
        // 2. Fall back to Platform BYOK
        return platformByokSource.getCredential(tenantId, providerId);
      },
    };
    const credentialResolver = new CredentialResolver(compositeByokSource, aiEncryptionKey);

    const quotaClient = new QuotaClientImpl({
      platformApiUrl,
      serviceToken,
      logger,
    });
    const usageRecorder = new UsageRecorderImpl({
      platformApiUrl,
      serviceToken,
      logger,
    });
    const fallbackHandler = new FallbackHandlerImpl(modelRegistry, logger);

    // Create AI Gateway
    const aiGateway = createAiGateway({
      platformApiUrl,
      serviceToken,
      providerRegistry,
      credentialResolver,
      modelRegistry,
      usageRecorder,
      quotaClient,
      logger,
      fallbackHandler,
    });

    // Create services
    const promptManager = new PromptManager(prisma, redis, logger);
    const responseParser = new ResponseParser(logger);
    const contextEngine = new ContextEngine(redis, prisma, logger);

    // Create orchestrator
    const orchestrator = new AiOrchestrator(
      aiGateway,
      promptManager,
      responseParser,
      prisma,
      redis,
      fastify.eventBus,
      logger,
    );

    // Create chat session service
    const chatSessionService = new ChatSessionService(prisma, logger);

    // Create action framework services (E5-3)
    const guardrails = new GuardrailsService(logger);
    const actionPlanner = new ActionPlanner(guardrails, logger);
    const actionExecutor = new ActionExecutor(prisma, fastify.eventBus, logger);

    // Register system module action handlers (Users, Access Groups)
    registerSystemActionHandlers(actionExecutor, fastify.eventBus, logger);

    // Register finance module action handlers (Journals, Budgets) — E14-S27
    registerFinanceActionHandlers(actionExecutor, fastify.eventBus, logger);

    // Create prediction service (E5-4)
    const predictionService = new PredictionService(orchestrator, prisma, logger);

    // Create briefing and suggestions services (E5-5)
    const briefingEngine = new BriefingEngine(orchestrator, contextEngine, prisma, redis, logger);
    const suggestionsService = new SuggestionsService(
      prisma,
      contextEngine,
      permissionService,
      logger,
    );

    // Create memory services (E5b-1)
    const memoryService = new MemoryService(prisma, fastify.eventBus, logger);
    const memoryInjectionService = new MemoryInjectionService(prisma, memoryService, logger);
    const conversationSummaryService = new ConversationSummaryService(
      prisma,
      aiGateway,
      fastify.eventBus,
      logger,
    );

    // Create memory pruning scheduler (E5b-1 AC-11) — optional, only if Redis is available
    let memoryPruningService: MemoryPruningService | null = null;
    if (redisUrl) {
      try {
        const pruningConnection = parseRedisUrl(redisUrl);
        memoryPruningService = new MemoryPruningService(
          memoryService,
          prisma,
          logger,
          pruningConnection,
          {
            cronExpression: process.env.MEMORY_PRUNING_CRON ?? '0 2 * * *',
          },
        );
        logger.info('MemoryPruningService initialized');
      } catch (pruningError) {
        logger.warn(
          { error: (pruningError as Error).message },
          'MemoryPruningService failed to initialize — pruning will not run automatically',
        );
      }
    }

    // Create briefing scheduler (E5-5 Task 6) — optional, only if Redis is available
    let briefingScheduler: BriefingScheduler | null = null;
    const tenantId = process.env.TENANT_ID ?? 'default';
    if (redisUrl) {
      try {
        const schedulerConnection = parseRedisUrl(redisUrl);
        briefingScheduler = new BriefingScheduler(
          briefingEngine,
          prisma,
          logger,
          schedulerConnection,
          {
            cronExpression: process.env.BRIEFING_SCHEDULE_CRON ?? '0 6 * * *',
            concurrency: parseInt(process.env.BRIEFING_CONCURRENCY ?? '5', 10) || 5,
            tenantId,
          },
        );
        logger.info('BriefingScheduler initialized');
      } catch (schedulerError) {
        logger.warn(
          { error: (schedulerError as Error).message },
          'BriefingScheduler failed to initialize — briefings will only generate on-demand',
        );
      }
    }

    // Create E5b-2 services: ToolRegistry, SkillRouter, QueryExecutor, DynamicContextService
    // These are optional — if any fail, the orchestrator continues without skill routing
    let toolRegistry: ToolRegistry | null = null;
    let skillRouter: SkillRouter | null = null;
    let queryExecutor: QueryExecutor | null = null;
    let dynamicContextService: DynamicContextService | null = null;

    try {
      toolRegistry = new ToolRegistry();
      skillRouter = new SkillRouter(prisma, logger, toolRegistry, fastify.eventBus);
      queryExecutor = new QueryExecutor(
        prisma,
        fastify.eventBus,
        permissionService,
        toolRegistry,
        logger,
      );
      dynamicContextService = new DynamicContextService(
        skillRouter,
        memoryInjectionService,
        toolRegistry,
        prisma,
        logger,
      );

      // Register E7 views module tools and query handlers (E5b-6 Task 7)
      registerViewsTools(toolRegistry);
      registerViewsQueryHandlers(queryExecutor, prisma);

      // Register E14-S27 finance module tools and query handlers
      registerFinanceTools(toolRegistry);
      registerFinanceQueryHandlers(queryExecutor, prisma);

      logger.info(
        'E5b-2 services initialized (ToolRegistry, SkillRouter, QueryExecutor, DynamicContextService)',
      );
    } catch (e5b2Error) {
      logger.warn(
        { error: (e5b2Error as Error).message },
        'E5b-2 services failed to initialize — skill routing and dynamic context will not be available',
      );
      // Leave as null — orchestrator falls back to basic memory injection only
    }

    // Create SkillsService for CRUD endpoints (E5b-2 Task 10)
    const skillsService = new SkillsService(prisma, logger);

    // Wire skill mutation callback to invalidate SkillRouter cache (ISSUE #7 fix)
    if (skillRouter) {
      skillsService.setMutationCallback(() => skillRouter.invalidateCache());
    }

    // Create KnowledgeService and EntityTriggerService for CRUD endpoints (E5b-2 Task 11)
    const knowledgeService = new KnowledgeService(prisma, logger);
    const entityTriggerService = new EntityTriggerService(prisma, logger);

    // Create EntitySearchService for entity search proxy (E5b-7 Task 1.4)
    const entitySearchService = new EntitySearchService(prisma, entityTriggerService, logger);

    // Create SkillOverrideService for CRUD endpoints (E5b-2 Task 12)
    const skillOverrideService = new SkillOverrideService(prisma, logger);

    // Create E5d knowledge article services (E5d-1 Tasks 3-5, 7, 9)
    const chunkingService = new ChunkingService(logger);
    const knowledgeArticleService = new KnowledgeArticleService(
      prisma,
      logger,
      chunkingService,
      null, // EmbeddingService wired via setter below if pgvector available
      fastify.eventBus,
    );
    const knowledgeRagService = new KnowledgeRagService(prisma, logger, knowledgeArticleService);

    // Create PatternDetectionService (E5b-3 Task 1) — optional, graceful degradation
    let patternDetectionService: PatternDetectionService | null = null;
    try {
      patternDetectionService = new PatternDetectionService(
        logger,
        fastify.eventBus,
        memoryService,
      );
      orchestrator.setPatternDetection(patternDetectionService);
      logger.info('PatternDetectionService initialized');
    } catch (patternError) {
      logger.warn(
        { error: (patternError as Error).message },
        'PatternDetectionService failed to initialize — implicit learning will not be available',
      );
    }

    // Create MemoryParserService (E5b-3 Task 2) — optional, graceful degradation
    let memoryParserService: MemoryParserService | null = null;
    try {
      memoryParserService = new MemoryParserService(
        prisma,
        logger,
        memoryService,
        fastify.eventBus,
      );
      orchestrator.setMemoryParser(memoryParserService);
      logger.info('MemoryParserService initialized');
    } catch (parserError) {
      logger.warn(
        { error: (parserError as Error).message },
        'MemoryParserService failed to initialize — explicit memory parsing will not be available',
      );
    }

    // Create MemoryCitationService (E5b-3 Task 3) — optional, graceful degradation
    let memoryCitationService: MemoryCitationService | null = null;
    try {
      memoryCitationService = new MemoryCitationService(logger, memoryService);
      orchestrator.setMemoryCitation(memoryCitationService);
      logger.info('MemoryCitationService initialized');
    } catch (citationError) {
      logger.warn(
        { error: (citationError as Error).message },
        'MemoryCitationService failed to initialize — memory citation tracking will not be available',
      );
    }

    // Create SemanticDedupService (E5b-3 Task 6) — optional, graceful degradation
    // Wired into PatternDetectionService and MemoryParserService for dedup checks
    let semanticDedupService: SemanticDedupService | null = null;
    try {
      semanticDedupService = new SemanticDedupService(prisma, logger);
      if (patternDetectionService) {
        patternDetectionService.setSemanticDedup(semanticDedupService);
      }
      if (memoryParserService) {
        memoryParserService.setSemanticDedup(semanticDedupService);
      }
      logger.info('SemanticDedupService initialized');
    } catch (dedupError) {
      logger.warn(
        { error: (dedupError as Error).message },
        'SemanticDedupService failed to initialize — memory deduplication will not be available',
      );
    }

    // Create PreCompactionService (E5b-3 Task 7) — optional, graceful degradation
    // Wired into orchestrator to extract facts before context trimming
    let preCompactionService: PreCompactionService | null = null;
    try {
      preCompactionService = new PreCompactionService(logger, memoryService, semanticDedupService);
      orchestrator.setPreCompaction(preCompactionService);
      logger.info('PreCompactionService initialized');
    } catch (preCompactionError) {
      logger.warn(
        { error: (preCompactionError as Error).message },
        'PreCompactionService failed to initialize — pre-compaction memory flush will not be available',
      );
    }

    // Create EmbeddingService + VectorSearchService + EmbeddingBackfillService (E5b-4 Tasks 2, 4, 5, 9) — optional
    // All wiring wrapped in try/catch — if any service fails, log warning and continue (graceful degradation)
    try {
      const embeddingService = new EmbeddingService(prisma, logger, credentialResolver);
      memoryService.setEmbeddingService(embeddingService);

      // Check if pgvector extension is installed before creating VectorSearchService
      const pgvectorAvailable = await checkPgvectorAvailable(prisma, logger);

      if (pgvectorAvailable) {
        const vectorSearchService = new VectorSearchService(prisma, logger, embeddingService);

        // Wire VectorSearchService into dependent services
        if (semanticDedupService) {
          semanticDedupService.setVectorSearchService(vectorSearchService);
        }
        memoryInjectionService.setVectorSearchService(vectorSearchService);
        memoryInjectionService.setEmbeddingService(embeddingService);
        if (memoryPruningService) {
          memoryPruningService.setVectorSearchService(vectorSearchService);
        }

        // Wire into E5d knowledge services (E5d-1 Task 9)
        knowledgeArticleService.setEmbeddingService(embeddingService);
        knowledgeRagService.setVectorSearchService(vectorSearchService);
        knowledgeRagService.setEmbeddingService(embeddingService);

        logger.info('VectorSearchService initialized and wired into dependent services');
      } else {
        logger.info('pgvector not available — using keyword-based memory search');
      }

      // Run embedding backfill in background only when pgvector is available
      // (backfill writes vector columns that don't exist without pgvector)
      if (pgvectorAvailable) {
        const backfillService = new EmbeddingBackfillService(prisma, logger, embeddingService);
        backfillService.backfillMemoryEmbeddings().catch((err) => {
          logger.warn(
            { error: (err as Error).message },
            'EmbeddingBackfillService: background backfill failed — will retry on next restart',
          );
        });
        logger.info('EmbeddingService initialized, background backfill started');
      } else {
        logger.info('EmbeddingService initialized (backfill skipped — pgvector not available)');
      }
    } catch (embeddingError) {
      logger.warn(
        { error: (embeddingError as Error).message },
        'EmbeddingService failed to initialize — embedding generation and vector search will not be available',
      );
    }

    // Wire ActionPlanner into orchestrator for guardrail evaluation
    orchestrator.setActionPlanner(actionPlanner);

    // Wire MemoryInjectionService into orchestrator for user context assembly (E5b-1)
    orchestrator.setMemoryInjection(memoryInjectionService);

    // Wire DynamicContextService into orchestrator for skill-aware context (E5b-2)
    if (dynamicContextService) {
      orchestrator.setDynamicContext(dynamicContextService);
    }

    // Wire conversation summarisation into session end hook (E5b-1 Task 3)
    chatSessionService.onSessionEnd(async (conversationId) => {
      await conversationSummaryService.summariseConversation(conversationId);
    });

    // Create WebSocket handler and attach to the Fastify HTTP server
    const wsHandler = new AiWebSocketHandler(fastify, logger);
    wsHandler.setActionPlanner(actionPlanner);
    wsHandler.setActionExecutor(actionExecutor);
    wsHandler.attach(fastify.server);

    // ISSUE #6 FIX: Decorate both orchestrator and contextEngine on Fastify instance
    fastify.decorate('aiOrchestrator', orchestrator);
    fastify.decorate('aiContextEngine', contextEngine);
    fastify.decorate('aiWebSocketHandler', wsHandler);
    fastify.decorate('chatSessionService', chatSessionService);
    fastify.decorate('aiActionPlanner', actionPlanner);
    fastify.decorate('aiActionExecutor', actionExecutor);
    fastify.decorate('aiGuardrails', guardrails);
    fastify.decorate('aiPredictionService', predictionService);
    fastify.decorate('aiBriefingEngine', briefingEngine);
    fastify.decorate('aiBriefingScheduler', briefingScheduler);
    fastify.decorate('aiSuggestionsService', suggestionsService);
    fastify.decorate('aiMemoryService', memoryService);
    fastify.decorate('aiQueryExecutor', queryExecutor);
    fastify.decorate('aiToolRegistry', toolRegistry);
    fastify.decorate('aiSkillRouter', skillRouter);
    fastify.decorate('aiDynamicContext', dynamicContextService);
    fastify.decorate('aiSkillsService', skillsService);
    fastify.decorate('aiKnowledgeService', knowledgeService);
    fastify.decorate('aiEntityTriggerService', entityTriggerService);
    fastify.decorate('aiEntitySearchService', entitySearchService);
    fastify.decorate('aiSkillOverrideService', skillOverrideService);
    fastify.decorate('aiPatternDetection', patternDetectionService);
    fastify.decorate('aiMemoryParser', memoryParserService);
    fastify.decorate('aiMemoryCitation', memoryCitationService);
    fastify.decorate('aiSemanticDedup', semanticDedupService);
    fastify.decorate('aiPreCompaction', preCompactionService);
    fastify.decorate('aiKnowledgeArticleService', knowledgeArticleService);
    fastify.decorate('aiKnowledgeRagService', knowledgeRagService);

    // Wire KnowledgeRagService into DynamicContextService (E5d-1 Task 9.2)
    if (dynamicContextService) {
      dynamicContextService.setKnowledgeRagService(knowledgeRagService);
    }

    // Create AutomationExecutor (step executor for automation runs)
    const automationStepExecutor = new AutomationStepExecutor(
      prisma,
      aiGateway,
      dynamicContextService,
      queryExecutor!,
      actionExecutor,
      toolRegistry,
      fastify.eventBus,
      logger,
    );

    // Wire PromptRenderer into automation executor (shared with orchestrator)
    // (Done after promptRenderer is created below — see setPromptRenderer call)

    // Create AutomationSchedulerService — optional, only if Redis is available
    let automationScheduler: AutomationSchedulerService | null = null;
    if (redisUrl) {
      try {
        const automationSchedulerConn = parseRedisUrl(redisUrl);
        automationScheduler = new AutomationSchedulerService(
          prisma,
          automationStepExecutor,
          logger,
          automationSchedulerConn,
          fastify.eventBus,
        );
        await automationScheduler.start();
        logger.info('AutomationSchedulerService initialized');
      } catch (schedulerError) {
        logger.warn(
          { error: (schedulerError as Error).message },
          'AutomationSchedulerService failed to initialize — scheduled automations will not run',
        );
      }
    }

    // Create AutomationEventListener — listens for business events to trigger automations
    let automationEventListener: AutomationEventListener | null = null;
    try {
      automationEventListener = new AutomationEventListener(
        prisma,
        automationStepExecutor,
        fastify.eventBus,
        logger,
      );
      await automationEventListener.start();
      logger.info('AutomationEventListener initialized');
    } catch (eventListenerError) {
      logger.warn(
        { error: (eventListenerError as Error).message },
        'AutomationEventListener failed to initialize — event-triggered automations will not run',
      );
    }

    // Create AutomationService (E5c-1 Task 10)
    const automationService = new AutomationService({
      db: prisma,
      eventBus: fastify.eventBus,
      logger,
      scheduler: automationScheduler,
      eventListener: automationEventListener,
      executor: automationStepExecutor,
    });
    fastify.decorate('aiAutomationService', automationService);

    // Create PromptRenderer (E5c-2 Task 6)
    const promptRenderer = new PromptRenderer(prisma, logger);
    fastify.decorate('aiPromptRenderer', promptRenderer);

    // Wire PromptRenderer into orchestrator and automation executor (E5c-2 Task 8)
    orchestrator.setPromptRenderer(promptRenderer);
    automationStepExecutor.setPromptRenderer(promptRenderer);

    // Create AI admin services (E5c-3 Task 5.2)
    const adminModelService = new AdminModelService(prisma, logger);
    const adminPromptService = new AdminPromptService(prisma, logger, promptRenderer);
    const adminDashboardService = new AdminDashboardService(prisma, logger);
    fastify.decorate('aiAdminModelService', adminModelService);
    fastify.decorate('aiAdminPromptService', adminPromptService);
    fastify.decorate('aiAdminDashboardService', adminDashboardService);

    // Create AI admin agent/skill/trigger services (E5c-4 Task 5.3)
    const adminAgentService = new AdminAgentService(prisma, logger);
    const adminSkillService = new AdminSkillService(prisma, logger);
    const adminTriggerTestService = new AdminTriggerTestService(prisma, logger);
    fastify.decorate('aiAdminAgentService', adminAgentService);
    fastify.decorate('aiAdminSkillService', adminSkillService);
    fastify.decorate('aiAdminTriggerTestService', adminTriggerTestService);

    // Create AI admin analytics service (E10 Task 11)
    const adminAnalyticsService = new AdminAnalyticsService();
    fastify.decorate('aiAdminAnalyticsService', adminAnalyticsService);

    // Create LearningSignalsService (E5d-2 Task 6)
    const learningSignalsService = new LearningSignalsService(prisma, logger, fastify.eventBus);
    fastify.decorate('aiLearningSignalsService', learningSignalsService);

    // Create E5d-2 correction loop & training example services (E5d-2 Task 8.2)
    const correctionCaptureService = new CorrectionCaptureService(prisma, logger, fastify.eventBus);
    const correctionPatternService = new CorrectionPatternService(
      prisma,
      logger,
      knowledgeArticleService,
      fastify.eventBus,
    );
    const trainingExampleService = new TrainingExampleService(prisma, logger);
    const trainingExampleInjectionService = new TrainingExampleInjectionService(prisma, logger);

    fastify.decorate('aiDb', prisma);
    fastify.decorate('aiCorrectionCaptureService', correctionCaptureService);
    fastify.decorate('aiCorrectionPatternService', correctionPatternService);
    fastify.decorate('aiTrainingExampleService', trainingExampleService);
    fastify.decorate('aiTrainingExampleInjectionService', trainingExampleInjectionService);
    fastify.decorate('aiEncryptionKey', aiEncryptionKey);

    // Wire TrainingExampleInjectionService into DynamicContextService (E5d-2 Task 5.4)
    if (dynamicContextService) {
      dynamicContextService.setTrainingExampleInjection(trainingExampleInjectionService);
    }

    // Register correction event handlers (E5d-2 Task 3.3)
    registerCorrectionEvents(fastify.eventBus, prisma, logger, correctionPatternService);

    // Register knowledge article event handlers (E5d-1 Task 9.4)
    registerKnowledgeArticleEvents(fastify.eventBus, prisma, logger);

    // Register audit mapping for AI action execution (AC: #5, NFR22)
    registerAuditMapping('ai.action.executed', (payload) => ({
      companyId: payload.companyId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      action: (payload.actionType as AuditAction) ?? 'CREATE',
      userId: payload.userId,
      isAiAction: true,
      aiConfidence: parseFloat(payload.confidence),
      correlationId: payload.conversationId,
    }));

    // Register AI routes — use registerAiRoutes wrapper to preserve /ai prefix
    await fastify.register(registerAiRoutes);

    // Graceful shutdown — close WebSocket handler, schedulers, and Redis connection
    fastify.addHook('onClose', async () => {
      await wsHandler.close();
      if (memoryPruningService) await memoryPruningService.close();
      if (briefingScheduler) await briefingScheduler.close();
      if (automationScheduler) await automationScheduler.stop();
      if (automationEventListener) automationEventListener.stop();
      await redis.quit();
    });

    fastify.log.info('AI module registered successfully');
  } catch (error) {
    // Graceful degradation — if AI setup fails, the API still runs
    fastify.log.warn(
      { error: (error as Error).message },
      'AI module failed to initialize — AI features disabled (graceful degradation)',
    );
    fastify.decorate('aiOrchestrator', null);
    fastify.decorate('aiContextEngine', null);
    fastify.decorate('aiWebSocketHandler', null);
    fastify.decorate('chatSessionService', null);
    fastify.decorate('aiActionPlanner', null);
    fastify.decorate('aiActionExecutor', null);
    fastify.decorate('aiGuardrails', null);
    fastify.decorate('aiPredictionService', null);
    fastify.decorate('aiBriefingEngine', null);
    fastify.decorate('aiBriefingScheduler', null);
    fastify.decorate('aiSuggestionsService', null);
    fastify.decorate('aiMemoryService', null);
    fastify.decorate('aiQueryExecutor', null);
    fastify.decorate('aiToolRegistry', null);
    fastify.decorate('aiSkillRouter', null);
    fastify.decorate('aiDynamicContext', null);
    fastify.decorate('aiSkillsService', null);
    fastify.decorate('aiKnowledgeService', null);
    fastify.decorate('aiEntityTriggerService', null);
    fastify.decorate('aiEntitySearchService', null);
    fastify.decorate('aiSkillOverrideService', null);
    fastify.decorate('aiPatternDetection', null);
    fastify.decorate('aiMemoryParser', null);
    fastify.decorate('aiMemoryCitation', null);
    fastify.decorate('aiSemanticDedup', null);
    fastify.decorate('aiPreCompaction', null);
    fastify.decorate('aiAutomationService', null);
    fastify.decorate('aiPromptRenderer', null);
    fastify.decorate('aiAdminModelService', null);
    fastify.decorate('aiAdminPromptService', null);
    fastify.decorate('aiAdminDashboardService', null);
    fastify.decorate('aiAdminAgentService', null);
    fastify.decorate('aiAdminSkillService', null);
    fastify.decorate('aiAdminTriggerTestService', null);
    fastify.decorate('aiAdminAnalyticsService', null);
    fastify.decorate('aiKnowledgeArticleService', null);
    fastify.decorate('aiKnowledgeRagService', null);
    fastify.decorate('aiLearningSignalsService', null);
    fastify.decorate('aiDb', prisma);
    fastify.decorate('aiCorrectionCaptureService', null);
    fastify.decorate('aiCorrectionPatternService', null);
    fastify.decorate('aiTrainingExampleService', null);
    fastify.decorate('aiTrainingExampleInjectionService', null);
    fastify.decorate('aiEncryptionKey', aiEncryptionKey);
    // Still register routes — they will return 503 when orchestrator/service is null
    // Use registerAiRoutes wrapper to preserve /ai prefix (see comment at line 226)
    await fastify.register(registerAiRoutes);
  }
};

// NOTE: Do NOT wrap with fp() — using fp breaks Fastify encapsulation and
// causes the /ai prefix (set in app.ts) to be ignored. The AI decorators are
// only accessed by routes within this plugin, so scope-sharing is not needed.
// Dependencies (event-bus, platform-client) are accessed via the parent scope
// which is inherited by default.
export const aiPlugin = aiPluginFn;
