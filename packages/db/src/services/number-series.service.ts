import type { PrismaClient } from '../../generated/prisma/client';
import { Prisma } from '../../generated/prisma/client';

// ---------------------------------------------------------------------------
// TransactionClient type — the Prisma interactive-transaction client type
// ---------------------------------------------------------------------------
export type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class NumberSeriesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NumberSeriesError';
  }
}

export class NumberSeriesNotFoundError extends NumberSeriesError {
  constructor(companyId: string, entityType: string) {
    super(`No active number series found for company=${companyId}, entityType=${entityType}`);
    this.name = 'NumberSeriesNotFoundError';
  }
}

export class NumberSeriesInactiveError extends NumberSeriesError {
  constructor(companyId: string, entityType: string) {
    super(`Number series is inactive for company=${companyId}, entityType=${entityType}`);
    this.name = 'NumberSeriesInactiveError';
  }
}

// ---------------------------------------------------------------------------
// nextNumber — atomic number generation via UPDATE...RETURNING
// ---------------------------------------------------------------------------

/**
 * Atomically allocate the next sequential number for a given entity type.
 *
 * Uses `UPDATE ... SET next_value = next_value + 1 ... RETURNING` which
 * acquires an implicit row-level lock in PostgreSQL, ensuring concurrent
 * callers receive unique, gap-free numbers.
 *
 * **CRITICAL**: This function does NOT create its own transaction. The caller
 * MUST pass an interactive transaction client (`tx`) so that number allocation
 * is part of the same transaction that creates the document. If the document
 * creation fails and the transaction rolls back, the number is never consumed
 * — guaranteeing gap-free numbering.
 *
 * Accepting only TransactionClient (not bare PrismaClient) enforces at the
 * type level that callers wrap number allocation in a transaction.
 *
 * @param tx - Prisma interactive transaction client (from prisma.$transaction)
 * @param companyId - The company UUID
 * @param entityType - e.g. 'INVOICE', 'PURCHASE_ORDER', 'JOURNAL'
 * @returns Formatted number string, e.g. "INV-00001"
 */
export async function nextNumber(
  tx: TransactionClient,
  companyId: string,
  entityType: string,
): Promise<string> {
  const result = await (tx as PrismaClient).$queryRaw<
    Array<{
      prefix: string;
      allocated: bigint;
      padding: number;
      suffix: string | null;
    }>
  >(
    Prisma.sql`
      UPDATE number_series
      SET next_value = next_value + 1, updated_at = NOW()
      WHERE company_id = ${companyId}
        AND entity_type = ${entityType}
        AND is_active = true
      RETURNING prefix, next_value - 1 AS allocated, padding, suffix
    `,
  );

  const row = result[0];
  if (!row) {
    // Distinguish inactive from missing: check if the series exists at all
    const existing = await (tx as PrismaClient).$queryRaw<
      // eslint-disable-next-line @typescript-eslint/naming-convention -- raw SQL column name
      Array<{ is_active: boolean }>
    >(
      Prisma.sql`
        SELECT is_active FROM number_series
        WHERE company_id = ${companyId} AND entity_type = ${entityType}
        LIMIT 1
      `,
    );
    if (existing[0] && !existing[0].is_active) {
      throw new NumberSeriesInactiveError(companyId, entityType);
    }
    throw new NumberSeriesNotFoundError(companyId, entityType);
  }

  const { prefix, allocated, padding, suffix } = row;
  return `${prefix}${Number(allocated).toString().padStart(padding, '0')}${suffix ?? ''}`;
}
