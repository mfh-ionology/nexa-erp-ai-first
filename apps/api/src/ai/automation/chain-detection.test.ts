import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectCycleInChain, ChainCycleError, ChainDepthExceededError } from './chain-detection.js';

// ─── Mock DB ────────────────────────────────────────────────────────────────

function createMockDb(chainMap: Record<string, string | null>) {
  return {
    aiAutomation: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        const id = where.id;
        if (id in chainMap) {
          return Promise.resolve({ id, chainNextId: chainMap[id] });
        }
        return Promise.resolve(null);
      }),
    },
  } as any;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('detectCycleInChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Self-reference (A→A)
  // =========================================================================

  describe('self-reference', () => {
    it('throws ChainCycleError for self-referencing chain (A→A)', async () => {
      const db = createMockDb({});

      await expect(detectCycleInChain(db, 'A', 'A')).rejects.toThrow(ChainCycleError);
      await expect(detectCycleInChain(db, 'A', 'A')).rejects.toThrow(/Circular chain detected/);
    });

    it('ChainCycleError has statusCode 422', async () => {
      const db = createMockDb({});

      try {
        await detectCycleInChain(db, 'A', 'A');
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as ChainCycleError).statusCode).toBe(422);
      }
    });
  });

  // =========================================================================
  // Simple cycle (A→B→A)
  // =========================================================================

  describe('simple cycle', () => {
    it('throws ChainCycleError for A→B→A cycle', async () => {
      // B's chainNextId points back to A
      const db = createMockDb({
        B: 'A', // B → A
      });

      await expect(detectCycleInChain(db, 'A', 'B')).rejects.toThrow(ChainCycleError);
    });

    it('includes the cycle path in the error message', async () => {
      const db = createMockDb({ B: 'A' });

      try {
        await detectCycleInChain(db, 'A', 'B');
        expect.fail('Should have thrown');
      } catch (err) {
        const message = (err as ChainCycleError).message;
        expect(message).toContain('A');
        expect(message).toContain('B');
      }
    });
  });

  // =========================================================================
  // Transitive cycle (A→B→C→A)
  // =========================================================================

  describe('transitive cycle', () => {
    it('throws ChainCycleError for A→B→C→A cycle', async () => {
      const db = createMockDb({
        B: 'C', // B → C
        C: 'A', // C → A (back to origin)
      });

      await expect(detectCycleInChain(db, 'A', 'B')).rejects.toThrow(ChainCycleError);
    });

    it('detects longer transitive cycles (A→B→C→D→A)', async () => {
      const db = createMockDb({
        B: 'C',
        C: 'D',
        D: 'A', // back to origin
      });

      await expect(detectCycleInChain(db, 'A', 'B')).rejects.toThrow(ChainCycleError);
    });
  });

  // =========================================================================
  // No cycle (A→B→C)
  // =========================================================================

  describe('no cycle', () => {
    it('does not throw for safe chain A→B→C with no cycle', async () => {
      const db = createMockDb({
        B: 'C', // B → C
        C: null, // C ends the chain
      });

      await expect(detectCycleInChain(db, 'A', 'B')).resolves.toBeUndefined();
    });

    it('does not throw for single-link chain A→B (B has no chainNextId)', async () => {
      const db = createMockDb({
        B: null,
      });

      await expect(detectCycleInChain(db, 'A', 'B')).resolves.toBeUndefined();
    });

    it('does not throw when target node does not exist in DB', async () => {
      const db = createMockDb({});

      await expect(detectCycleInChain(db, 'A', 'B')).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // Max depth exceeded (chain depth > 10)
  // =========================================================================

  describe('max depth exceeded', () => {
    it('throws ChainDepthExceededError when chain depth exceeds 10', async () => {
      // Build a chain of 11 nodes: A → B1 → B2 → ... → B11
      const chainMap: Record<string, string | null> = {};
      for (let i = 1; i <= 11; i++) {
        chainMap[`B${i}`] = i < 11 ? `B${i + 1}` : null;
      }

      const db = createMockDb(chainMap);

      await expect(detectCycleInChain(db, 'A', 'B1')).rejects.toThrow(ChainDepthExceededError);
    });

    it('ChainDepthExceededError has statusCode 422', async () => {
      const chainMap: Record<string, string | null> = {};
      for (let i = 1; i <= 11; i++) {
        chainMap[`B${i}`] = i < 11 ? `B${i + 1}` : null;
      }

      const db = createMockDb(chainMap);

      try {
        await detectCycleInChain(db, 'A', 'B1');
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as ChainDepthExceededError).statusCode).toBe(422);
        expect((err as ChainDepthExceededError).message).toContain('10');
      }
    });

    it('does not throw when chain depth is exactly 10', async () => {
      // Build a chain of exactly 10 nodes: A → B1 → B2 → ... → B10
      const chainMap: Record<string, string | null> = {};
      for (let i = 1; i <= 10; i++) {
        chainMap[`B${i}`] = i < 10 ? `B${i + 1}` : null;
      }

      const db = createMockDb(chainMap);

      await expect(detectCycleInChain(db, 'A', 'B1')).resolves.toBeUndefined();
    });
  });
});
