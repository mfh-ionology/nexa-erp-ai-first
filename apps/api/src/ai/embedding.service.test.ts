import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockCredentialResolver } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockCredentialResolver: {
    resolve: vi.fn(),
  },
}));

// Mock OpenAI — must be vi.hoisted to work with vi.mock
const { mockEmbeddingsCreate } = vi.hoisted(() => ({
  mockEmbeddingsCreate: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    embeddings = { create: mockEmbeddingsCreate };
    constructor(_opts: unknown) {}
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { EmbeddingService } from './embedding.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new EmbeddingService(mockPrisma as any, mockLogger as any, mockCredentialResolver as any);
}

/** Make a fake embedding response matching OpenAI's format */
function makeEmbeddingResponse(embeddings: number[][]) {
  return {
    data: embeddings.map((embedding, index) => ({ embedding, index })),
  };
}

const FAKE_EMBEDDING = Array.from({ length: 1536 }, (_, i) => i * 0.001);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();

    // Default happy-path mocks
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        provider: 'openai',
        model_id: 'text-embedding-3-small',
        config: { dimensions: 1536 },
      },
    ]);
    mockCredentialResolver.resolve.mockResolvedValue({ apiKey: 'test-key' });
    mockEmbeddingsCreate.mockResolvedValue(makeEmbeddingResponse([FAKE_EMBEDDING]));
  });

  // ─── Single embedding generation ──────────────────────────────────────

  describe('generateEmbedding()', () => {
    it('generates an embedding for a single text', async () => {
      const result = await service.generateEmbedding('Hello world');

      expect(result).toEqual(FAKE_EMBEDDING);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['Hello world'],
        dimensions: 1536,
      });
    });

    it('returns null on AI Gateway failure (graceful degradation)', async () => {
      mockEmbeddingsCreate.mockRejectedValue(new Error('Connection refused'));

      const result = await service.generateEmbedding('Hello world');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Connection refused' }),
        expect.stringContaining('failed to generate embedding'),
      );
    });

    it('returns null when no embedding model is configured', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]); // No models found

      const result = await service.generateEmbedding('Hello world');

      expect(result).toBeNull();
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('no embedding model configured'),
      );
    });

    it('returns null for unsupported provider', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { provider: 'anthropic', model_id: 'claude-embed', config: null },
      ]);

      const result = await service.generateEmbedding('Hello world');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'anthropic' }),
        expect.stringContaining('unsupported embedding provider'),
      );
    });

    it('returns null when credential resolution fails', async () => {
      mockCredentialResolver.resolve.mockRejectedValue(new Error('No credential'));

      const result = await service.generateEmbedding('Hello world');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'No credential' }),
        expect.stringContaining('failed to resolve OpenAI credentials'),
      );
    });
  });

  // ─── Caching ──────────────────────────────────────────────────────────

  describe('caching', () => {
    it('returns cached embedding for same text without second API call', async () => {
      const result1 = await service.generateEmbedding('Hello world');
      const result2 = await service.generateEmbedding('Hello world');

      expect(result1).toEqual(FAKE_EMBEDDING);
      expect(result2).toEqual(FAKE_EMBEDDING);
      // Only one API call — second one served from cache
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1);
    });

    it('makes a new API call for different text', async () => {
      const embedding2 = Array.from({ length: 1536 }, (_, i) => i * 0.002);
      mockEmbeddingsCreate
        .mockResolvedValueOnce(makeEmbeddingResponse([FAKE_EMBEDDING]))
        .mockResolvedValueOnce(makeEmbeddingResponse([embedding2]));

      const result1 = await service.generateEmbedding('Hello world');
      const result2 = await service.generateEmbedding('Different text');

      expect(result1).toEqual(FAKE_EMBEDDING);
      expect(result2).toEqual(embedding2);
      expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Batch embedding generation ───────────────────────────────────────

  describe('generateEmbeddings()', () => {
    it('generates embeddings for multiple texts in batch', async () => {
      const emb1 = Array.from({ length: 1536 }, () => 0.1);
      const emb2 = Array.from({ length: 1536 }, () => 0.2);
      mockEmbeddingsCreate.mockResolvedValue(makeEmbeddingResponse([emb1, emb2]));

      const results = await service.generateEmbeddings(['Text 1', 'Text 2']);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(emb1);
      expect(results[1]).toEqual(emb2);
    });

    it('returns empty array for empty input', async () => {
      const results = await service.generateEmbeddings([]);

      expect(results).toEqual([]);
      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
    });

    it('returns all nulls when no model is configured', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const results = await service.generateEmbeddings(['A', 'B', 'C']);

      expect(results).toEqual([null, null, null]);
    });

    it('handles partial batch failures — fills nulls for failed embeddings', async () => {
      mockEmbeddingsCreate.mockRejectedValue(new Error('Rate limited'));

      const results = await service.generateEmbeddings(['A', 'B']);

      expect(results).toEqual([null, null]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns all nulls on top-level failure', async () => {
      // Force the model resolution to throw
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      // Create fresh service so model config is not cached
      const fresh = createService();

      const results = await fresh.generateEmbeddings(['A', 'B']);

      expect(results).toEqual([null, null]);
    });
  });

  // ─── Model resolution ─────────────────────────────────────────────────

  describe('model resolution', () => {
    it('reads dimensions from model config', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { provider: 'openai', model_id: 'text-embedding-3-large', config: { dimensions: 3072 } },
      ]);
      const fresh = createService();

      await fresh.generateEmbedding('test');

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ dimensions: 3072 }),
      );
    });

    it('defaults to 1536 dimensions when config is null', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { provider: 'openai', model_id: 'text-embedding-3-small', config: null },
      ]);
      const fresh = createService();

      await fresh.generateEmbedding('test');

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ dimensions: 1536 }),
      );
    });

    it('caches model resolution — only queries DB once', async () => {
      await service.generateEmbedding('first');
      await service.generateEmbedding('second');

      // $queryRaw called once for model resolution (cached after first call)
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getDimensions ────────────────────────────────────────────────────

  describe('getDimensions()', () => {
    it('returns configured dimensions from model', async () => {
      const dims = await service.getDimensions();
      expect(dims).toBe(1536);
    });

    it('returns default 1536 when no model is configured', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      const fresh = createService();

      const dims = await fresh.getDimensions();
      expect(dims).toBe(1536);
    });
  });
});
