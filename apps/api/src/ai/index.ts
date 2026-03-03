import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
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
} from '@nexa/ai-gateway';
import type { ByokCredentialSource } from '@nexa/ai-gateway';

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
import { PromptRenderer } from './prompt-renderer.js';
import { AdminModelService } from './admin/admin-model.service.js';
import { AdminPromptService } from './admin/admin-prompt.service.js';
import { AdminDashboardService } from './admin/admin-dashboard.service.js';
import { adminRoutesPlugin } from './admin/admin.routes.js';
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

const aiPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  // Check if AI Gateway can be configured
  const platformApiUrl = process.env.PLATFORM_API_URL ?? 'http://localhost:5101/api/v1';
  const serviceToken = process.env.PLATFORM_SERVICE_TOKEN;
  const redisUrl = process.env.REDIS_URL;
  const aiEncryptionKey = process.env.AI_ENCRYPTION_KEY ?? '';

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
    // Still register routes — they will return 503 when orchestrator/service is null
    await fastify.register(aiRoutesPlugin);
    await fastify.register(predictionRoutesPlugin);
    await fastify.register(briefingRoutesPlugin);
    await fastify.register(memoryRoutesPlugin);
    await fastify.register(skillsRoutesPlugin);
    await fastify.register(knowledgeRoutesPlugin);
    await fastify.register(entityTriggersRoutesPlugin);
    await fastify.register(skillOverridesRoutesPlugin);
    await fastify.register(automationRoutesPlugin);
    await fastify.register(adminRoutesPlugin, { prefix: '/admin' });
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

    // ISSUE #1 FIX: Construct CredentialResolver with correct arguments
    const byokSource = new PlatformByokSource(platformApiUrl, serviceToken, logger);
    const credentialResolver = new CredentialResolver(byokSource, aiEncryptionKey);

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

    // Create AutomationService (E5c-1 Task 10)
    const automationService = new AutomationService({
      db: prisma,
      eventBus: fastify.eventBus,
      logger,
      scheduler: null, // AutomationSchedulerService created elsewhere if Redis is available
      eventListener: null, // AutomationEventListener created elsewhere
      executor: null, // AutomationExecutor requires full wiring — set later if available
    });
    fastify.decorate('aiAutomationService', automationService);

    // Create PromptRenderer (E5c-2 Task 6)
    const promptRenderer = new PromptRenderer(prisma, logger);
    fastify.decorate('aiPromptRenderer', promptRenderer);

    // Wire PromptRenderer into orchestrator for AiPromptVariable resolution (E5c-2 Task 8)
    orchestrator.setPromptRenderer(promptRenderer);

    // Create AI admin services (E5c-3 Task 5.2)
    const adminModelService = new AdminModelService(prisma, logger);
    const adminPromptService = new AdminPromptService(prisma, logger, promptRenderer);
    const adminDashboardService = new AdminDashboardService(prisma, logger);
    fastify.decorate('aiAdminModelService', adminModelService);
    fastify.decorate('aiAdminPromptService', adminPromptService);
    fastify.decorate('aiAdminDashboardService', adminDashboardService);

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

    // Register AI routes under /ai prefix (set by the caller in app.ts)
    await fastify.register(aiRoutesPlugin);
    await fastify.register(predictionRoutesPlugin);
    await fastify.register(briefingRoutesPlugin);
    await fastify.register(memoryRoutesPlugin);
    await fastify.register(skillsRoutesPlugin);
    await fastify.register(knowledgeRoutesPlugin);
    await fastify.register(entityTriggersRoutesPlugin);
    await fastify.register(skillOverridesRoutesPlugin);
    await fastify.register(automationRoutesPlugin);
    await fastify.register(adminRoutesPlugin, { prefix: '/admin' });

    // Graceful shutdown — close WebSocket handler, schedulers, and Redis connection
    fastify.addHook('onClose', async () => {
      await wsHandler.close();
      if (memoryPruningService) await memoryPruningService.close();
      if (briefingScheduler) await briefingScheduler.close();
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
    // Still register routes — they will return 503 when orchestrator/service is null
    await fastify.register(aiRoutesPlugin);
    await fastify.register(predictionRoutesPlugin);
    await fastify.register(briefingRoutesPlugin);
    await fastify.register(memoryRoutesPlugin);
    await fastify.register(skillsRoutesPlugin);
    await fastify.register(knowledgeRoutesPlugin);
    await fastify.register(entityTriggersRoutesPlugin);
    await fastify.register(skillOverridesRoutesPlugin);
    await fastify.register(automationRoutesPlugin);
    await fastify.register(adminRoutesPlugin, { prefix: '/admin' });
  }
};

export const aiPlugin = fp(aiPluginFn, {
  name: 'ai-module',
  dependencies: ['event-bus', 'platform-client'],
});
