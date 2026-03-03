// ---------------------------------------------------------------------------
// Circular chain detection for automation chaining (AC-7).
// Validates that setting chainNextId does not create a cycle and that
// the total chain depth does not exceed MAX_CHAIN_DEPTH (10).
// E5c-1 Task 8.2
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';

/** Maximum allowed chain depth before rejecting */
const MAX_CHAIN_DEPTH = 10;

export class ChainCycleError extends Error {
  public readonly statusCode = 422;

  constructor(path: string[]) {
    super(`Circular chain detected: ${path.join(' → ')}`);
    this.name = 'ChainCycleError';
  }
}

export class ChainDepthExceededError extends Error {
  public readonly statusCode = 422;

  constructor(depth: number) {
    super(`Chain depth exceeds maximum of ${MAX_CHAIN_DEPTH} (found ${depth})`);
    this.name = 'ChainDepthExceededError';
  }
}

/**
 * Detect circular chains and enforce max depth when setting chainNextId.
 *
 * Algorithm:
 * 1. Starting from `chainNextId`, traverse the chain via each automation's
 *    `chainNextId` pointer.
 * 2. If any node equals `automationId` → cycle detected → throw 422.
 * 3. If traversal depth exceeds MAX_CHAIN_DEPTH → reject → throw 422.
 * 4. If traversal ends (null chainNextId) within depth → safe.
 *
 * @param db          Prisma client
 * @param automationId  The automation being created/updated
 * @param chainNextId   The proposed chainNextId value
 * @throws ChainCycleError if a cycle is detected
 * @throws ChainDepthExceededError if chain depth exceeds MAX_CHAIN_DEPTH
 */
export async function detectCycleInChain(
  db: PrismaClient,
  automationId: string,
  chainNextId: string,
): Promise<void> {
  // Self-reference is the simplest cycle
  if (automationId === chainNextId) {
    throw new ChainCycleError([automationId, chainNextId]);
  }

  const visited: string[] = [automationId, chainNextId];
  let currentId: string | null = chainNextId;
  let depth = 1; // The proposed link counts as depth 1

  while (currentId) {
    const node: { id: string; chainNextId: string | null } | null =
      await db.aiAutomation.findUnique({
        where: { id: currentId },
        select: { id: true, chainNextId: true },
      });

    if (!node || !node.chainNextId) {
      // End of chain — no cycle, depth is within limits
      break;
    }

    depth++;

    if (depth > MAX_CHAIN_DEPTH) {
      throw new ChainDepthExceededError(depth);
    }

    // Check for cycle: does the next node loop back to the origin?
    if (node.chainNextId === automationId) {
      visited.push(node.chainNextId);
      throw new ChainCycleError(visited);
    }

    visited.push(node.chainNextId);
    currentId = node.chainNextId;
  }
}
