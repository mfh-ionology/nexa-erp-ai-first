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
import { aiRoutesPlugin } from './ai.routes.js';
import { predictionRoutesPlugin } from './prediction.routes.js';
import { briefingRoutesPlugin } from './briefing.routes.js';
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
  ): Promise<{ id: string; tenantId: string; providerId: string; encryptedKey: string; isActive: boolean } | null> {
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
// AI module plugin
// ---------------------------------------------------------------------------

const aiPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  // Check if AI Gateway can be configured
  const platformApiUrl = process.env.PLATFORM_API_URL ?? 'http://localhost:3001/api/v1';
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
    // Still register routes — they will return 503 when orchestrator/service is null
    await fastify.register(aiRoutesPlugin);
    await fastify.register(predictionRoutesPlugin);
    await fastify.register(briefingRoutesPlugin);
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
    const credentialResolver = new CredentialResolver(
      byokSource,
      aiEncryptionKey,
    );

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
    const fallbackHandler = new FallbackHandlerImpl(
      modelRegistry,
      logger,
    );

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
    const suggestionsService = new SuggestionsService(prisma, contextEngine, permissionService, logger);

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

    // Wire ActionPlanner into orchestrator for guardrail evaluation
    orchestrator.setActionPlanner(actionPlanner);

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

    // Graceful shutdown — close WebSocket handler, scheduler, and Redis connection
    fastify.addHook('onClose', async () => {
      await wsHandler.close();
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
    // Still register routes — they will return 503 when orchestrator/service is null
    await fastify.register(aiRoutesPlugin);
    await fastify.register(predictionRoutesPlugin);
    await fastify.register(briefingRoutesPlugin);
  }
};

export const aiPlugin = fp(aiPluginFn, {
  name: 'ai-module',
  dependencies: ['event-bus', 'platform-client'],
});
