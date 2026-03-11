// ---------------------------------------------------------------------------
// Impersonation Context — Request-scoped impersonation metadata
// Uses AsyncLocalStorage so the audit service can access it without
// requiring impersonation data to flow through every event payload.
// Story: E13b.5 Task 6.4 (BR-PLT-015 dual audit logging)
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from 'node:async_hooks';

export interface ImpersonationContext {
  platformUserId: string;
  sessionId: string;
}

const storage = new AsyncLocalStorage<ImpersonationContext>();

/**
 * Run a function within an impersonation context.
 * All code within the callback (including async continuations)
 * can access the impersonation metadata via `getImpersonationContext()`.
 */
export function runWithImpersonation<T>(ctx: ImpersonationContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Get the current impersonation context, if any.
 * Returns null if the current execution is not within an impersonation session.
 */
export function getImpersonationContext(): ImpersonationContext | null {
  return storage.getStore() ?? null;
}
