// ---------------------------------------------------------------------------
// Open Banking Provider Client — STUB for MVP
// ---------------------------------------------------------------------------
// This module provides a stub implementation of Open Banking connectivity.
// In production, this would integrate with a real Open Banking provider
// (e.g., TrueLayer, Plaid, Yapily) via their API.
// ---------------------------------------------------------------------------

export interface OpenBankingTransaction {
  externalId: string;
  date: string;
  description: string;
  amount: number;
  reference?: string;
}

export interface OpenBankingConnection {
  connectionId: string;
  provider: string;
  status: 'CONNECTED' | 'PENDING' | 'ERROR';
}

/**
 * Connect a bank account to an Open Banking provider.
 * STUB: returns a mock connection ID.
 */
export async function connectAccount(
  bankAccountId: string,
  provider: string,
): Promise<OpenBankingConnection> {
  // STUB: returns mock connection
  return {
    connectionId: `OB-${provider}-${Date.now()}`,
    provider,
    status: 'CONNECTED',
  };
}

/**
 * Sync transactions from an Open Banking connection.
 * STUB: returns empty array (no new transactions).
 */
export async function syncTransactions(_connectionId: string): Promise<OpenBankingTransaction[]> {
  // STUB: returns empty array — no new transactions from provider
  return [];
}

/**
 * Disconnect a bank account from its Open Banking provider.
 * STUB: always succeeds.
 */
export async function disconnectAccount(_connectionId: string): Promise<{ success: boolean }> {
  // STUB: always succeeds
  return { success: true };
}
