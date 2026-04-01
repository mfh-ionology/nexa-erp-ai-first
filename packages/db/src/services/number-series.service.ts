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
 * When `transactionDate` is provided, selects the most specific date-range
 * sub-range whose `valid_from`/`valid_to` window covers the date. If no
 * date-specific range matches, falls back to the default series (null dates).
 * When `transactionDate` is omitted, the default (null dates) series is used
 * directly — preserving full backward compatibility.
 *
 * If a matching series has `sub_range_prefix` set, that prefix replaces the
 * main `prefix` in the formatted output.
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
 * @param entityType - e.g. 'INVOICE', 'PURCHASE_ORDER', 'JOURNAL_ENTRY'
 * @param transactionDate - Optional date to select a date-range sub-range
 * @returns Formatted number string, e.g. "INV-00001" or "INV-2026-00001"
 */
export async function nextNumber(
  tx: TransactionClient,
  companyId: string,
  entityType: string,
  transactionDate?: Date,
): Promise<string> {
  // ---------------------------------------------------------------------------
  // Step 1: Atomically update the best-matching series via CTE.
  //
  // The CTE selects the single best row (most specific date range first, then
  // the default null-dates fallback), and the UPDATE targets only that row by id.
  // This preserves the atomic row-level lock for gap-free numbering.
  // ---------------------------------------------------------------------------

  type ResultRow = {
    prefix: string;
    allocated: bigint;
    padding: number;
    suffix: string | null;
    sub_range_prefix: string | null;
  };

  let result: ResultRow[];

  if (transactionDate) {
    // Date-aware path: find the best matching series for the given date.
    // Preference order: specific date range (valid_from IS NOT NULL) > default (valid_from IS NULL).
    result = await (tx as PrismaClient).$queryRaw<ResultRow[]>(
      Prisma.sql`
        WITH best_series AS (
          SELECT id
          FROM number_series
          WHERE company_id = ${companyId}
            AND entity_type = ${entityType}
            AND is_active = true
            AND (valid_from IS NULL OR valid_from <= ${transactionDate})
            AND (valid_to IS NULL OR valid_to >= ${transactionDate})
          ORDER BY valid_from DESC NULLS LAST
          LIMIT 1
        )
        UPDATE number_series ns
        SET next_value = ns.next_value + 1, updated_at = NOW()
        FROM best_series bs
        WHERE ns.id = bs.id
        RETURNING ns.prefix, ns.next_value - 1 AS allocated, ns.padding, ns.suffix, ns.sub_range_prefix
      `,
    );
  } else {
    // Legacy path (no transactionDate): pick any active series for this entity type.
    // For backward compatibility, this matches the original behaviour — when there
    // is only one series per entity type (the normal case), it works identically.
    // When sub-ranges exist, it prefers the default (null valid_from) series.
    result = await (tx as PrismaClient).$queryRaw<ResultRow[]>(
      Prisma.sql`
        WITH best_series AS (
          SELECT id
          FROM number_series
          WHERE company_id = ${companyId}
            AND entity_type = ${entityType}
            AND is_active = true
          ORDER BY valid_from ASC NULLS FIRST
          LIMIT 1
        )
        UPDATE number_series ns
        SET next_value = ns.next_value + 1, updated_at = NOW()
        FROM best_series bs
        WHERE ns.id = bs.id
        RETURNING ns.prefix, ns.next_value - 1 AS allocated, ns.padding, ns.suffix, ns.sub_range_prefix
      `,
    );
  }

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

  const effectivePrefix = row.sub_range_prefix ?? row.prefix;
  return `${effectivePrefix}${Number(row.allocated).toString().padStart(row.padding, '0')}${row.suffix ?? ''}`;
}
