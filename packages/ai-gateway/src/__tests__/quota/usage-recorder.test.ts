import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UsageRecorder } from '../../quota/usage-recorder.js';
import type { UsageRecord } from '../../types/index.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Helper to build a valid UsageRecord. */
function makeUsageRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    tenantId: 'tenant-001',
    userId: 'user-001',
    featureKey: 'chat',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    promptTokens: 500,
    completionTokens: 200,
    totalTokens: 700,
    costEstimate: 0.01,
    requestId: 'req-' + Math.random().toString(36).slice(2, 10),
    isByok: false,
    latencyMs: 450,
    fallbackUsed: false,
    ...overrides,
  };
}

/** Helper to create a successful fetch Response. */
function okResponse(data: Record<string, unknown> = { recorded: true, quotaPct: 45 }): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data }),
    text: () => Promise.resolve(JSON.stringify({ data })),
  } as unknown as Response;
}

/** Helper to create a failed fetch Response. */
function errorResponse(status: number, body = ''): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: body }),
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('UsageRecorder', () => {
  const baseConfig = {
    platformApiUrl: 'http://localhost:3001/api/v1',
    serviceToken: 'test-service-token',
    maxRetries: 3, // Low for testing
    // No redisUrl → in-memory fallback
  };

  let recorder: UsageRecorder;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    recorder = new UsageRecorder(baseConfig);
  });

  afterEach(async () => {
    await recorder.close();
    vi.useRealTimers();
  });

  // ─── Successful recording ─────────────────────────────────────────────

  describe('successful recording', () => {
    it('sends HTTP POST to Platform API on success', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());
      const data = makeUsageRecord();

      recorder.record(data);

      // Let the async operation complete
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3001/api/v1/platform/tenants/${data.tenantId}/ai/record`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-service-token',
          },
          body: expect.any(String),
        },
      );

      // Verify the body contains all fields
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        userId: data.userId,
        featureKey: data.featureKey,
        provider: data.provider,
        model: data.model,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        costEstimate: data.costEstimate,
        requestId: data.requestId,
        isByok: data.isByok,
        latencyMs: data.latencyMs,
        fallbackUsed: data.fallbackUsed,
        fallbackFrom: undefined,
      });
    });

    it('does not enqueue to retry when recording succeeds', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());

      recorder.record(makeUsageRecord());
      await vi.advanceTimersByTimeAsync(0);

      expect(recorder.pendingInMemoryCount).toBe(0);
    });

    it('strips trailing slash from platform URL', async () => {
      const recorderWithSlash = new UsageRecorder({
        ...baseConfig,
        platformApiUrl: 'http://localhost:3001/api/v1/',
      });

      mockFetch.mockResolvedValueOnce(okResponse());
      recorderWithSlash.record(makeUsageRecord({ tenantId: 'tenant-slash' }));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/platform/tenants/tenant-slash/ai/record',
        expect.any(Object),
      );

      await recorderWithSlash.close();
    });
  });

  // ─── Fire-and-forget guarantee ─────────────────────────────────────────

  describe('fire-and-forget guarantee', () => {
    it('record() never throws even on network error', () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      // record() is synchronous and must not throw
      expect(() => recorder.record(makeUsageRecord())).not.toThrow();
    });

    it('record() never throws even on HTTP error', () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, 'Internal server error'));

      expect(() => recorder.record(makeUsageRecord())).not.toThrow();
    });

    it('record() never throws even when fetch throws synchronously', () => {
      mockFetch.mockImplementationOnce(() => {
        throw new Error('Sync error in fetch');
      });

      expect(() => recorder.record(makeUsageRecord())).not.toThrow();
    });
  });

  // ─── Failed recording → retry queue ────────────────────────────────────

  describe('failed recording → enqueued for retry', () => {
    it('enqueues to in-memory queue when HTTP recording fails', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, 'Internal server error'));

      recorder.record(makeUsageRecord());
      await vi.advanceTimersByTimeAsync(0);

      expect(recorder.pendingInMemoryCount).toBe(1);
    });

    it('enqueues to in-memory queue when fetch rejects', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      recorder.record(makeUsageRecord());
      await vi.advanceTimersByTimeAsync(0);

      expect(recorder.pendingInMemoryCount).toBe(1);
    });
  });

  // ─── Retry succeeds on 2nd attempt ────────────────────────────────────

  describe('retry succeeds on subsequent attempt', () => {
    it('retries and succeeds on 2nd attempt', async () => {
      // First attempt fails
      mockFetch.mockResolvedValueOnce(errorResponse(503, 'Service unavailable'));

      const data = makeUsageRecord({ requestId: 'req-retry-success' });
      recorder.record(data);
      await vi.advanceTimersByTimeAsync(0);

      expect(recorder.pendingInMemoryCount).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Set up success for retry
      mockFetch.mockResolvedValueOnce(okResponse());

      // Advance past the 1s backoff for attempt 1
      await vi.advanceTimersByTimeAsync(1100);
      await recorder.processInMemoryRetries();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(recorder.pendingInMemoryCount).toBe(0);
    });
  });

  // ─── Max retries exceeded → dead letter queue ─────────────────────────

  describe('max retries exceeded → dead letter queue', () => {
    it('moves to dead letter queue after max retries', async () => {
      // Create recorder with maxRetries=2 for easier testing
      const smallRetryRecorder = new UsageRecorder({
        ...baseConfig,
        maxRetries: 2,
      });

      // Always fail
      mockFetch.mockResolvedValue(errorResponse(500, 'Server error'));

      const data = makeUsageRecord({ requestId: 'req-dead-letter' });
      smallRetryRecorder.record(data);
      await vi.advanceTimersByTimeAsync(0);

      // Attempt 1 retry (attempt=1, after 1s backoff)
      await vi.advanceTimersByTimeAsync(1100);
      await smallRetryRecorder.processInMemoryRetries();

      // Attempt 2 retry (attempt=2, after 2s backoff) → max reached
      await vi.advanceTimersByTimeAsync(2100);
      await smallRetryRecorder.processInMemoryRetries();

      expect(smallRetryRecorder.pendingInMemoryCount).toBe(0);
      expect(smallRetryRecorder.deadLetterCount).toBe(1);

      const dlItems = smallRetryRecorder.getDeadLetterItems();
      expect(dlItems).toHaveLength(1);
      expect(dlItems[0].requestId).toBe('req-dead-letter');

      await smallRetryRecorder.close();
    });
  });

  // ─── Redis unavailable → in-memory fallback ───────────────────────────

  describe('Redis unavailable → in-memory fallback', () => {
    it('uses in-memory queue when no Redis URL provided', () => {
      expect(recorder.isDurable).toBe(false);
    });

    it('in-memory fallback works for recording and retry', async () => {
      // Initial send fails
      mockFetch.mockResolvedValueOnce(errorResponse(502, 'Bad gateway'));

      const data = makeUsageRecord({ requestId: 'req-inmem-retry' });
      recorder.record(data);
      await vi.advanceTimersByTimeAsync(0);

      expect(recorder.isDurable).toBe(false);
      expect(recorder.pendingInMemoryCount).toBe(1);

      // Retry succeeds
      mockFetch.mockResolvedValueOnce(okResponse());
      await vi.advanceTimersByTimeAsync(1100);
      await recorder.processInMemoryRetries();

      expect(recorder.pendingInMemoryCount).toBe(0);
    });
  });

  // ─── Multiple records ──────────────────────────────────────────────────

  describe('multiple concurrent records', () => {
    it('handles multiple simultaneous recordings', async () => {
      mockFetch.mockResolvedValue(okResponse());

      const records = Array.from({ length: 5 }, (_, i) =>
        makeUsageRecord({ requestId: `req-multi-${i}` }),
      );

      for (const r of records) {
        recorder.record(r);
      }

      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetch).toHaveBeenCalledTimes(5);
      expect(recorder.pendingInMemoryCount).toBe(0);
    });

    it('enqueues all failed records independently', async () => {
      mockFetch.mockResolvedValue(errorResponse(500, 'Error'));

      const records = Array.from({ length: 3 }, (_, i) =>
        makeUsageRecord({ requestId: `req-fail-${i}` }),
      );

      for (const r of records) {
        recorder.record(r);
      }

      await vi.advanceTimersByTimeAsync(0);

      expect(recorder.pendingInMemoryCount).toBe(3);
    });
  });

  // ─── BYOK records ──────────────────────────────────────────────────────

  describe('BYOK records', () => {
    it('sends isByok: true in the request body for BYOK records', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());

      const data = makeUsageRecord({ isByok: true });
      recorder.record(data);
      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.isByok).toBe(true);
    });
  });

  // ─── Fallback fields ──────────────────────────────────────────────────

  describe('fallback fields', () => {
    it('sends fallback fields in the request body', async () => {
      mockFetch.mockResolvedValueOnce(okResponse());

      const data = makeUsageRecord({
        fallbackUsed: true,
        fallbackFrom: 'claude-opus-4-6',
      });
      recorder.record(data);
      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.fallbackUsed).toBe(true);
      expect(body.fallbackFrom).toBe('claude-opus-4-6');
    });
  });

  // ─── Exponential backoff ──────────────────────────────────────────────

  describe('exponential backoff', () => {
    it('retries with increasing delays', async () => {
      const smallRetryRecorder = new UsageRecorder({
        ...baseConfig,
        maxRetries: 5,
      });

      // All attempts fail
      mockFetch.mockResolvedValue(errorResponse(500, 'Error'));

      const data = makeUsageRecord({ requestId: 'req-backoff' });
      smallRetryRecorder.record(data);
      await vi.advanceTimersByTimeAsync(0);

      // Attempt 1 added with delay ~1s
      expect(smallRetryRecorder.pendingInMemoryCount).toBe(1);

      // Process after 1s — should retry (fails again, re-enqueued with ~2s delay)
      await vi.advanceTimersByTimeAsync(1100);
      await smallRetryRecorder.processInMemoryRetries();
      expect(smallRetryRecorder.pendingInMemoryCount).toBe(1);

      // Process after 2s — should retry (fails again, re-enqueued with ~4s delay)
      await vi.advanceTimersByTimeAsync(2100);
      await smallRetryRecorder.processInMemoryRetries();
      expect(smallRetryRecorder.pendingInMemoryCount).toBe(1);

      // Process after 4s — should retry (fails again, re-enqueued with ~8s delay)
      await vi.advanceTimersByTimeAsync(4100);
      await smallRetryRecorder.processInMemoryRetries();
      expect(smallRetryRecorder.pendingInMemoryCount).toBe(1);

      // Process after 8s — should retry (fails, attempt 4 → re-enqueued with ~16s delay)
      await vi.advanceTimersByTimeAsync(8100);
      await smallRetryRecorder.processInMemoryRetries();
      expect(smallRetryRecorder.pendingInMemoryCount).toBe(1);

      // Process after 16s — attempt 5 = maxRetries → dead letter
      await vi.advanceTimersByTimeAsync(16100);
      await smallRetryRecorder.processInMemoryRetries();
      expect(smallRetryRecorder.pendingInMemoryCount).toBe(0);
      expect(smallRetryRecorder.deadLetterCount).toBe(1);

      await smallRetryRecorder.close();
    });
  });
});
