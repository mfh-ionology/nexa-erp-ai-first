import { parse } from 'csv-parse/sync';
import type { MultipartFile } from '@fastify/multipart';
import type { PrismaClient } from '@nexa/db';
import type { ImportResult } from './import.schema.js';

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

/**
 * Parse a CSV buffer into an array of row objects.
 * Columns are derived from the first row (header row).
 */
export function parseCsv(buffer: Buffer): Record<string, string>[] {
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

// ---------------------------------------------------------------------------
// Batch Processor
// ---------------------------------------------------------------------------

export type RowProcessor<T> = (
  prisma: PrismaClient,
  companyId: string,
  row: T,
  rowIndex: number,
) => Promise<void>;

/**
 * Process rows in batches of `batchSize`, collecting per-row errors
 * without aborting the entire import.
 */
export async function processBatch<T>(
  prisma: PrismaClient,
  companyId: string,
  rows: T[],
  processor: RowProcessor<T>,
  batchSize = 100,
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    for (let j = 0; j < batch.length; j++) {
      const rowIndex = i + j + 2; // +2 for 1-indexed + header row
      try {
        await processor(prisma, companyId, batch[j]!, rowIndex);
        result.imported++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({ row: rowIndex, message });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Multipart File Helper
// ---------------------------------------------------------------------------

/**
 * Read the uploaded file buffer from a Fastify multipart request.
 */
export async function readUploadedFile(file: MultipartFile): Promise<Buffer> {
  return file.toBuffer();
}
