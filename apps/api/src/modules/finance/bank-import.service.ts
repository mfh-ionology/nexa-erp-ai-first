import { createHash } from 'node:crypto';
import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import { AppError, NotFoundError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedTransaction {
  transactionDate: Date;
  description: string;
  amount: number;
  reference: string | null;
  externalId: string;
  type: 'CREDIT' | 'DEBIT';
}

export interface ImportResult {
  importBatchId: string;
  total: number;
  imported: number;
  duplicatesSkipped: number;
  transactions: Array<{
    id: string;
    externalId: string | null;
    transactionDate: string;
    description: string;
    amount: number;
    reference: string | null;
    type: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// External ID generation — deterministic hash for duplicate detection
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic externalId from the transaction data.
 * Uses SHA-256 hash of (bankAccountId + date + amount + description).
 */
export function generateExternalId(
  bankAccountId: string,
  date: string,
  amount: string,
  description: string,
): string {
  const input = `${bankAccountId}|${date}|${amount}|${description}`;
  return createHash('sha256').update(input).digest('hex').substring(0, 40);
}

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

/**
 * Parse CSV content into transactions.
 * Expected format: Date,Description,Amount,Reference
 * - Positive amounts are CREDIT, negative are DEBIT
 * - Header row is required
 */
export function parseCSV(content: string, bankAccountId: string): ParsedTransaction[] {
  const lines = content.trim().split(/\r?\n/);

  if (lines.length < 2) {
    throw new AppError('INVALID_CSV', 'CSV must have a header row and at least one data row', 400);
  }

  // Validate header
  const headerLine = lines[0];
  if (!headerLine) {
    throw new AppError('INVALID_CSV', 'CSV must have a header row', 400);
  }
  const header = headerLine.toLowerCase().replace(/\s+/g, '');
  const expectedHeaders = ['date,description,amount,reference', 'date,description,amount'];
  if (!expectedHeaders.some((h) => header.startsWith(h))) {
    throw new AppError(
      'INVALID_CSV_HEADER',
      'CSV header must contain: Date, Description, Amount (and optionally Reference)',
      400,
    );
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    if (fields.length < 3) {
      throw new AppError(
        'INVALID_CSV_ROW',
        `Row ${i + 1}: expected at least 3 fields (Date, Description, Amount), got ${fields.length}`,
        400,
      );
    }

    const dateStr = fields[0] ?? '';
    const description = fields[1] ?? '';
    const amountStr = fields[2] ?? '';
    const reference = fields[3];

    // Parse and validate date
    const parsedDate = parseDate(dateStr);
    if (!parsedDate) {
      throw new AppError(
        'INVALID_CSV_DATE',
        `Row ${i + 1}: invalid date format "${dateStr}". Expected YYYY-MM-DD or DD/MM/YYYY`,
        400,
      );
    }

    // Parse and validate amount
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      throw new AppError('INVALID_CSV_AMOUNT', `Row ${i + 1}: invalid amount "${amountStr}"`, 400);
    }

    const type: 'CREDIT' | 'DEBIT' = amount >= 0 ? 'CREDIT' : 'DEBIT';

    const externalId = generateExternalId(
      bankAccountId,
      dateStr.trim(),
      amountStr.trim(),
      description.trim(),
    );

    transactions.push({
      transactionDate: parsedDate,
      description: description.trim(),
      amount,
      reference: reference?.trim() || null,
      externalId,
      type,
    });
  }

  if (transactions.length === 0) {
    throw new AppError('EMPTY_CSV', 'CSV contains no valid data rows', 400);
  }

  return transactions;
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// OFX Parser
// ---------------------------------------------------------------------------

/**
 * Parse OFX (Open Financial Exchange) content into transactions.
 * Supports OFX 1.x (SGML-style) and basic OFX 2.x (XML-style).
 */
export function parseOFX(content: string, bankAccountId: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Match <STMTTRN>...</STMTTRN> blocks
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1] ?? '';

    const dtPosted = extractOFXValue(block, 'DTPOSTED');
    const trnAmt = extractOFXValue(block, 'TRNAMT');
    const name = extractOFXValue(block, 'NAME') || extractOFXValue(block, 'MEMO') || '';
    const fitId = extractOFXValue(block, 'FITID');
    const checkNum = extractOFXValue(block, 'CHECKNUM');

    if (!dtPosted || !trnAmt) continue;

    const parsedDate = parseOFXDate(dtPosted);
    if (!parsedDate) continue;

    const amount = parseFloat(trnAmt);
    if (isNaN(amount)) continue;

    const type: 'CREDIT' | 'DEBIT' = amount >= 0 ? 'CREDIT' : 'DEBIT';

    // Use FITID as externalId if available, otherwise generate one
    const externalId = fitId ? fitId : generateExternalId(bankAccountId, dtPosted, trnAmt, name);

    transactions.push({
      transactionDate: parsedDate,
      description: name.trim(),
      amount,
      reference: checkNum?.trim() || null,
      externalId,
      type,
    });
  }

  if (transactions.length === 0) {
    throw new AppError('INVALID_OFX', 'No valid transactions found in OFX content', 400);
  }

  return transactions;
}

/**
 * Extract a value from an OFX SGML block.
 * Handles both `<TAG>value` (OFX 1.x) and `<TAG>value</TAG>` (OFX 2.x) patterns.
 */
function extractOFXValue(block: string, tag: string): string | null {
  // Try XML-style first: <TAG>value</TAG>
  const xmlRegex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const xmlMatch = xmlRegex.exec(block);
  if (xmlMatch?.[1] != null) return xmlMatch[1].trim();

  // Try SGML-style: <TAG>value\n
  const sgmlRegex = new RegExp(`<${tag}>([^\\n<]+)`, 'i');
  const sgmlMatch = sgmlRegex.exec(block);
  if (sgmlMatch?.[1] != null) return sgmlMatch[1].trim();

  return null;
}

/**
 * Parse OFX date format: YYYYMMDD[HHmmss[.xxx][gmt_offset]]
 */
function parseOFXDate(dateStr: string): Date | null {
  // Extract just the date portion (YYYYMMDD)
  const dateOnly = dateStr.substring(0, 8);
  if (dateOnly.length < 8) return null;

  const year = parseInt(dateOnly.substring(0, 4), 10);
  const month = parseInt(dateOnly.substring(4, 6), 10);
  const day = parseInt(dateOnly.substring(6, 8), 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return new Date(Date.UTC(year, month - 1, day));
}

// ---------------------------------------------------------------------------
// QIF Parser
// ---------------------------------------------------------------------------

/**
 * Parse QIF (Quicken Interchange Format) content into transactions.
 * Each record is delimited by ^ and fields are prefixed with a letter.
 */
export function parseQIF(content: string, bankAccountId: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Split on record delimiter
  const records = content.split('^').filter((r) => r.trim());

  for (const record of records) {
    const lines = record.trim().split(/\r?\n/);

    let date: string | null = null;
    let amount: string | null = null;
    let payee: string | null = null;
    let number: string | null = null;
    let memo: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('!')) continue;

      const prefix = trimmed[0];
      const value = trimmed.substring(1);

      switch (prefix) {
        case 'D':
          date = value;
          break;
        case 'T':
        case 'U':
          amount = value.replace(/,/g, '');
          break;
        case 'P':
          payee = value;
          break;
        case 'N':
          number = value;
          break;
        case 'M':
          memo = value;
          break;
      }
    }

    if (!date || !amount) continue;

    const parsedDate = parseDate(date);
    if (!parsedDate) continue;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) continue;

    const description = payee || memo || '';
    const type: 'CREDIT' | 'DEBIT' = parsedAmount >= 0 ? 'CREDIT' : 'DEBIT';

    const externalId = generateExternalId(bankAccountId, date, amount, description);

    transactions.push({
      transactionDate: parsedDate,
      description: description.trim(),
      amount: parsedAmount,
      reference: number?.trim() || null,
      externalId,
      type,
    });
  }

  if (transactions.length === 0) {
    throw new AppError('INVALID_QIF', 'No valid transactions found in QIF content', 400);
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// Date parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse date strings in common formats:
 * - YYYY-MM-DD (ISO)
 * - DD/MM/YYYY (UK)
 * - MM/DD/YYYY (US — fallback)
 */
function parseDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();

  // ISO format: YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (isoMatch?.[1] && isoMatch[2] && isoMatch[3]) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  // UK/US format: DD/MM/YYYY or D/M/YYYY
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashMatch?.[1] && slashMatch[2] && slashMatch[3]) {
    const first = parseInt(slashMatch[1], 10);
    const second = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);

    // UK format (DD/MM/YYYY) — preferred since this is a UK ERP
    if (first >= 1 && first <= 31 && second >= 1 && second <= 12) {
      return new Date(Date.UTC(year, second - 1, first));
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Import service
// ---------------------------------------------------------------------------

/**
 * Import bank statement transactions into a bank account.
 *
 * - Validates bank account exists and belongs to the company
 * - Parses file content based on format
 * - Detects duplicates via externalId (BR-FIN-008)
 * - Creates transactions atomically with import batch tracking
 * - Returns summary with total, imported, duplicates skipped
 */
export async function importBankStatement(
  prisma: PrismaClient,
  companyId: string,
  bankAccountId: string,
  content: string,
  format: 'csv' | 'ofx' | 'qif',
): Promise<ImportResult> {
  // Validate bank account exists and belongs to the company
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId },
    select: { id: true, name: true },
  });

  if (!bankAccount) {
    throw new NotFoundError('NOT_FOUND', 'Bank account not found');
  }

  // Parse content based on format
  let parsed: ParsedTransaction[];
  switch (format) {
    case 'csv':
      parsed = parseCSV(content, bankAccountId);
      break;
    case 'ofx':
      parsed = parseOFX(content, bankAccountId);
      break;
    case 'qif':
      parsed = parseQIF(content, bankAccountId);
      break;
    default:
      throw new AppError('UNSUPPORTED_FORMAT', `Unsupported import format: ${format}`, 400);
  }

  // Generate import batch ID
  const importBatchId = crypto.randomUUID();
  const importedAt = new Date();

  // Find existing externalIds for duplicate detection (BR-FIN-008)
  const externalIds = parsed.map((t) => t.externalId);
  const existingTransactions = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId,
      externalId: { in: externalIds },
    },
    select: { externalId: true },
  });

  const existingExternalIds = new Set(existingTransactions.map((t) => t.externalId));

  // Separate new vs duplicate transactions
  const newTransactions = parsed.filter((t) => !existingExternalIds.has(t.externalId));
  const duplicatesSkipped = parsed.length - newTransactions.length;

  // Import new transactions atomically
  const created = await prisma.$transaction(async (tx) => {
    const results = [];

    for (const txn of newTransactions) {
      const record = await tx.bankTransaction.create({
        data: {
          companyId,
          bankAccountId,
          externalId: txn.externalId,
          transactionDate: txn.transactionDate,
          description: txn.description,
          amount: new Prisma.Decimal(txn.amount.toFixed(4)),
          reference: txn.reference,
          type: txn.type,
          importBatchId,
          importedAt,
          isMatched: false,
        },
        select: {
          id: true,
          externalId: true,
          transactionDate: true,
          description: true,
          amount: true,
          reference: true,
          type: true,
        },
      });

      results.push(record);
    }

    return results;
  });

  // Map results to response shape
  const transactions = created.map((r) => ({
    id: r.id,
    externalId: r.externalId,
    transactionDate:
      r.transactionDate instanceof Date
        ? r.transactionDate.toISOString().split('T')[0]
        : String(r.transactionDate),
    description: r.description,
    amount: typeof r.amount === 'number' ? r.amount : Number(r.amount),
    reference: r.reference,
    type: r.type,
  }));

  return {
    importBatchId,
    total: parsed.length,
    imported: newTransactions.length,
    duplicatesSkipped,
    transactions,
  };
}
