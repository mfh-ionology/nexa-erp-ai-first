// ---------------------------------------------------------------------------
// EmbeddingService — Generates embeddings via AI providers for vector search
// E5b-4 Task 2 (AC: #3)
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { CredentialResolver } from '@nexa/ai-gateway';
import OpenAI from 'openai';

// ─── Types ────────────────────────────────────────────────────────────────

/** Resolved embedding model configuration */
interface EmbeddingModelConfig {
  provider: string;
  modelId: string;
  dimensions: number;
}

/** LRU cache entry */
interface CacheEntry {
  embedding: number[];
  expiresAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Default embedding dimensions (OpenAI text-embedding-3-small) */
const DEFAULT_DIMENSIONS = 1536;

/** Maximum texts per batch API call */
const BATCH_SIZE = 100;

/** LRU cache max entries */
const CACHE_MAX_ENTRIES = 100;

/** LRU cache TTL in milliseconds (60 seconds) */
const CACHE_TTL_MS = 60_000;

/** Tenant ID for credential resolution (single-tenant dev setup) */
const DEFAULT_TENANT_ID = 'default';

/** Model config cache TTL in milliseconds (5 minutes — matches SkillRouter convention) */
const MODEL_CONFIG_TTL_MS = 5 * 60_000;

// ─── EmbeddingService ─────────────────────────────────────────────────────

export class EmbeddingService {
  /** In-memory LRU cache: SHA-256(text) → embedding */
  private readonly cache = new Map<string, CacheEntry>();

  /** Cached model config to avoid repeated DB queries (TTL-based) */
  private modelConfig: EmbeddingModelConfig | null | undefined = undefined;
  private modelConfigResolvedAt = 0;

  /** OpenAI client cache (keyed by hashed API key) */
  private openaiClient: OpenAI | null = null;

  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly credentialResolver: CredentialResolver,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Generate an embedding for a single text.
   *
   * Returns null on failure (never throws — fire-and-forget pattern for callers).
   * Logs errors at warn level (embedding failure is non-critical per IMP-006).
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      // Check cache first
      const cacheKey = this.computeCacheKey(text);
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Resolve model config
      const config = await this.resolveModelConfig();
      if (!config) return null;

      // Generate embedding via provider
      const embedding = await this.callProvider(config, [text]);
      if (!embedding || embedding.length === 0 || !embedding[0]) return null;

      // Store in cache
      this.putInCache(cacheKey, embedding[0]);

      return embedding[0];
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'EmbeddingService: failed to generate embedding',
      );
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch.
   *
   * Chunks requests into batches of 100 texts (provider limit).
   * Returns array with null for any failed individual embeddings.
   * Used by the backfill job (Task 5) for efficiency.
   */
  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (texts.length === 0) return [];

    try {
      const config = await this.resolveModelConfig();
      if (!config) return texts.map(() => null);

      const results: (number[] | null)[] = new Array(texts.length).fill(null);

      // Process in batches of BATCH_SIZE
      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batchTexts = texts.slice(i, i + BATCH_SIZE);
        const batchIndices: number[] = [];
        const uncachedTexts: string[] = [];
        const uncachedBatchPositions: number[] = [];

        // Check cache for each text in the batch
        for (let j = 0; j < batchTexts.length; j++) {
          const text = batchTexts[j]!;
          const cacheKey = this.computeCacheKey(text);
          const cached = this.getFromCache(cacheKey);
          if (cached) {
            results[i + j] = cached;
          } else {
            uncachedTexts.push(text);
            uncachedBatchPositions.push(j);
          }
          batchIndices.push(i + j);
        }

        // Call provider for uncached texts only
        if (uncachedTexts.length > 0) {
          try {
            const embeddings = await this.callProvider(config, uncachedTexts);
            if (embeddings) {
              for (let k = 0; k < embeddings.length; k++) {
                const globalIdx = i + uncachedBatchPositions[k]!;
                const embedding = embeddings[k];
                results[globalIdx] = embedding ?? null;

                // Cache successful embeddings
                if (embedding) {
                  const cacheKey = this.computeCacheKey(uncachedTexts[k]!);
                  this.putInCache(cacheKey, embedding);
                }
              }
            }
          } catch (err) {
            this.logger.warn(
              { error: (err as Error).message, batchStart: i, batchSize: uncachedTexts.length },
              'EmbeddingService: batch embedding call failed',
            );
            // Leave nulls for this batch — already initialized
          }
        }
      }

      return results;
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message, count: texts.length },
        'EmbeddingService: failed to generate batch embeddings',
      );
      return texts.map(() => null);
    }
  }

  /**
   * Get the configured embedding dimensions.
   * Returns the model's configured dimensions or the default (1536).
   */
  async getDimensions(): Promise<number> {
    const config = await this.resolveModelConfig();
    return config?.dimensions ?? DEFAULT_DIMENSIONS;
  }

  // ─── Model Resolution (Task 2.4) ───────────────────────────────────────

  /**
   * Resolve the embedding model from the AiModel table.
   *
   * Queries for models where capabilities JSON includes 'embedding'.
   * Returns null (graceful degradation) if no embedding model is configured.
   * Caches the result with a 5-minute TTL — picks up model changes without restart.
   */
  private async resolveModelConfig(): Promise<EmbeddingModelConfig | null> {
    // Return cached result if still within TTL (null means "resolved, but no model found")
    if (
      this.modelConfig !== undefined &&
      Date.now() - this.modelConfigResolvedAt < MODEL_CONFIG_TTL_MS
    ) {
      return this.modelConfig;
    }

    try {
      // Query AiModel table for an active model with 'embedding' capability
      // capabilities is stored as JSON array — use raw SQL for JSON containment
      const models = await this.db.$queryRaw<
        Array<{
          provider: string;
          model_id: string;
          config: unknown;
        }>
      >`
        SELECT provider, model_id, config
        FROM ai_models
        WHERE is_active = true
          AND capabilities::jsonb @> '"embedding"'::jsonb
        ORDER BY is_default DESC
        LIMIT 1
      `;

      const model = models[0];
      if (!model) {
        this.logger.info('EmbeddingService: no embedding model configured — embeddings disabled');
        this.modelConfig = null;
        this.modelConfigResolvedAt = Date.now();
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- config is flexible JSON
      const modelJsonConfig = model.config as Record<string, any> | null;
      const dimensions = modelJsonConfig?.dimensions ?? DEFAULT_DIMENSIONS;

      this.modelConfig = {
        provider: model.provider,
        modelId: model.model_id,
        dimensions,
      };
      this.modelConfigResolvedAt = Date.now();

      this.logger.info(
        { provider: this.modelConfig.provider, modelId: this.modelConfig.modelId, dimensions },
        'EmbeddingService: resolved embedding model',
      );

      return this.modelConfig;
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'EmbeddingService: failed to resolve embedding model',
      );
      this.modelConfig = null;
      this.modelConfigResolvedAt = Date.now();
      return null;
    }
  }

  // ─── Provider Call ──────────────────────────────────────────────────────

  /**
   * Call the embedding provider API to generate embeddings.
   *
   * Currently supports OpenAI-compatible providers.
   * Returns array of embeddings in the same order as inputs.
   */
  private async callProvider(
    config: EmbeddingModelConfig,
    texts: string[],
  ): Promise<number[][] | null> {
    if (config.provider !== 'openai') {
      this.logger.warn(
        { provider: config.provider },
        'EmbeddingService: unsupported embedding provider — only openai is supported',
      );
      return null;
    }

    const client = await this.getOpenAIClient();
    if (!client) return null;

    const response = await client.embeddings.create({
      model: config.modelId,
      input: texts,
      dimensions: config.dimensions,
    });

    // Sort by index to ensure order matches input
    const sorted = response.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }

  /**
   * Get or create an OpenAI client using resolved credentials.
   */
  private async getOpenAIClient(): Promise<OpenAI | null> {
    if (this.openaiClient) return this.openaiClient;

    try {
      const tenantId = process.env.TENANT_ID ?? DEFAULT_TENANT_ID;
      const credential = await this.credentialResolver.resolve(tenantId, 'openai');

      this.openaiClient = new OpenAI({
        apiKey: credential.apiKey,
        timeout: 30_000,
      });

      return this.openaiClient;
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'EmbeddingService: failed to resolve OpenAI credentials — embeddings disabled',
      );
      return null;
    }
  }

  // ─── LRU Cache (Task 2.3) ──────────────────────────────────────────────

  /**
   * Compute a cache key from input text using SHA-256 hash.
   */
  private computeCacheKey(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  /**
   * Get an embedding from cache if present and not expired.
   */
  private getFromCache(key: string): number[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU refresh) — Map preserves insertion order
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.embedding;
  }

  /**
   * Store an embedding in cache, evicting the oldest entry if at capacity.
   */
  private putInCache(key: string, embedding: number[]): void {
    // Evict oldest entry if at capacity
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      embedding,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
}
