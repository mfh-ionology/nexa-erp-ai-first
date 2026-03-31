import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import { AppError, NotFoundError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BankTransactionRow {
  id: string;
  transactionDate: Date;
  description: string;
  amount: Prisma.Decimal | number;
  reference: string | null;
  type: string | null;
}

interface JournalLineCandidate {
  id: string;
  journalEntryId: string;
  accountCode: string;
  description: string | null;
  debit: Prisma.Decimal | number;
  credit: Prisma.Decimal | number;
  journalEntry: {
    transactionDate: Date;
    reference: string | null;
    description: string;
    entryNumber: string;
  };
}

interface MatchCandidate {
  journalLineId: string;
  score: number;
}

export interface AutoMatchSummary {
  total: number;
  autoMatched: number;
  suggested: number;
  unmatched: number;
  matches: Array<{
    bankTransactionId: string;
    journalLineId: string | null;
    matchType: string;
    confidence: number;
  }>;
}

// ---------------------------------------------------------------------------
// Thresholds (BR-FIN-010)
// ---------------------------------------------------------------------------

/** Score >= 95 => auto-match */
const AUTO_MATCH_THRESHOLD = 95;
/** Score 60-94 => suggested match */
const SUGGESTED_THRESHOLD = 60;
/** Date proximity window in days */
const DATE_PROXIMITY_DAYS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/**
 * Calculate the number of calendar days between two dates (absolute).
 */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / msPerDay));
}

/**
 * Simple text similarity: checks if any non-trivial words from `needle`
 * appear in `haystack`. Returns a ratio [0, 1] of matched words.
 */
function wordOverlap(needle: string, haystack: string): number {
  if (!needle || !haystack) return 0;

  const normalise = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2); // skip tiny words

  const needleWords = normalise(needle);
  const haystackWords = new Set(normalise(haystack));

  if (needleWords.length === 0) return 0;

  const matched = needleWords.filter((w) => haystackWords.has(w)).length;
  return matched / needleWords.length;
}

// ---------------------------------------------------------------------------
// Scoring algorithm
// ---------------------------------------------------------------------------

/**
 * Calculate a match score (0-100) between a bank transaction and a journal line.
 *
 * Scoring breakdown:
 *  - Exact amount match: +40 points
 *  - Date within 3 days: +20 points (proportional)
 *  - Description similarity: +20 points (word overlap)
 *  - Reference exact match: +20 points
 */
export function calculateMatchScore(
  bankTx: BankTransactionRow,
  journalLine: JournalLineCandidate,
): number {
  let score = 0;
  const bankAmount = Math.abs(toNumber(bankTx.amount));
  const lineDebit = toNumber(journalLine.debit);
  const lineCredit = toNumber(journalLine.credit);

  // --- Exact amount match: +40 points ---
  // Compare absolute bank amount to whichever side (debit or credit) is non-zero
  const lineAmount = lineDebit > 0 ? lineDebit : lineCredit;
  if (lineAmount > 0 && Math.abs(bankAmount - lineAmount) < 0.01) {
    score += 40;
  }

  // --- Date proximity: +20 points ---
  const days = daysBetween(bankTx.transactionDate, journalLine.journalEntry.transactionDate);
  if (days <= DATE_PROXIMITY_DAYS) {
    // Full 20 for same day, proportionally less for further days
    score += Math.round(20 * (1 - days / (DATE_PROXIMITY_DAYS + 1)));
  }

  // --- Description similarity: +20 points ---
  const bankDesc = bankTx.description || '';
  const journalDesc = journalLine.description || journalLine.journalEntry.description || '';
  const entryNumber = journalLine.journalEntry.entryNumber || '';

  // Check bank description against journal line description AND entry number
  const descOverlap = Math.max(
    wordOverlap(bankDesc, journalDesc),
    wordOverlap(bankDesc, entryNumber),
  );
  score += Math.round(20 * descOverlap);

  // --- Reference exact match: +20 points ---
  const bankRef = (bankTx.reference || '').trim().toLowerCase();
  const journalRef = (journalLine.journalEntry.reference || '').trim().toLowerCase();
  if (bankRef && journalRef && bankRef === journalRef) {
    score += 20;
  }

  return Math.min(score, 100);
}

// ---------------------------------------------------------------------------
// Main auto-match function
// ---------------------------------------------------------------------------

export async function autoMatchBankTransactions(
  prisma: PrismaClient,
  companyId: string,
  bankAccountId: string,
  userId: string,
): Promise<AutoMatchSummary> {
  // Validate bank account exists and belongs to company
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId },
    select: { id: true, glAccountCode: true },
  });

  if (!bankAccount) {
    throw new NotFoundError('NOT_FOUND', 'Bank account not found');
  }

  // Fetch all unmatched bank transactions for this account
  const unmatchedTransactions = await prisma.bankTransaction.findMany({
    where: {
      companyId,
      bankAccountId,
      isMatched: false,
    },
    select: {
      id: true,
      transactionDate: true,
      description: true,
      amount: true,
      reference: true,
      type: true,
    },
    orderBy: { transactionDate: 'asc' },
  });

  if (unmatchedTransactions.length === 0) {
    return {
      total: 0,
      autoMatched: 0,
      suggested: 0,
      unmatched: 0,
      matches: [],
    };
  }

  // Fetch candidate journal lines: posted entries for the bank GL account that are not yet matched
  // We get all journal lines for this bank account's GL code
  const existingMatchedLineIds = await prisma.bankTransactionMatch.findMany({
    where: { companyId },
    select: { journalLineId: true },
  });
  const matchedLineIdSet = new Set(
    existingMatchedLineIds.map((m) => m.journalLineId).filter(Boolean),
  );

  const candidateJournalLines = await prisma.journalLine.findMany({
    where: {
      companyId,
      accountCode: bankAccount.glAccountCode,
    },
    select: {
      id: true,
      journalEntryId: true,
      accountCode: true,
      description: true,
      debit: true,
      credit: true,
      journalEntry: {
        select: {
          transactionDate: true,
          reference: true,
          description: true,
          entryNumber: true,
          status: true,
        },
      },
    },
  });

  // Filter out already-matched journal lines and non-posted entries
  const availableLines = candidateJournalLines.filter(
    (jl) => !matchedLineIdSet.has(jl.id) && jl.journalEntry.status === 'POSTED',
  );

  // Track which journal lines have been claimed by an auto-match
  const claimedLineIds = new Set<string>();

  const summary: AutoMatchSummary = {
    total: unmatchedTransactions.length,
    autoMatched: 0,
    suggested: 0,
    unmatched: 0,
    matches: [],
  };

  // Score each unmatched transaction against available journal lines
  for (const bankTx of unmatchedTransactions) {
    const candidates: MatchCandidate[] = [];

    for (const jl of availableLines) {
      if (claimedLineIds.has(jl.id)) continue;

      const score = calculateMatchScore(
        bankTx as unknown as BankTransactionRow,
        jl as unknown as JournalLineCandidate,
      );

      if (score >= SUGGESTED_THRESHOLD) {
        candidates.push({ journalLineId: jl.id, score });
      }
    }

    // Sort by score descending, take best candidate
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    if (best && best.score >= AUTO_MATCH_THRESHOLD) {
      // Auto-match: create the match record immediately
      claimedLineIds.add(best.journalLineId);
      summary.autoMatched += 1;
      summary.matches.push({
        bankTransactionId: bankTx.id,
        journalLineId: best.journalLineId,
        matchType: 'AUTO',
        confidence: best.score,
      });
    } else if (best && best.score >= SUGGESTED_THRESHOLD) {
      // Suggested match: create as AI_SUGGESTED
      claimedLineIds.add(best.journalLineId);
      summary.suggested += 1;
      summary.matches.push({
        bankTransactionId: bankTx.id,
        journalLineId: best.journalLineId,
        matchType: 'AI_SUGGESTED',
        confidence: best.score,
      });
    } else {
      // No match found
      summary.unmatched += 1;
      summary.matches.push({
        bankTransactionId: bankTx.id,
        journalLineId: null,
        matchType: 'UNMATCHED',
        confidence: best ? best.score : 0,
      });
    }
  }

  // Persist auto-matched records in a transaction
  const autoMatches = summary.matches.filter((m) => m.matchType === 'AUTO');
  const suggestedMatches = summary.matches.filter((m) => m.matchType === 'AI_SUGGESTED');

  if (autoMatches.length > 0 || suggestedMatches.length > 0) {
    await prisma.$transaction(async (tx) => {
      // Create BankTransactionMatch records for auto-matched
      for (const match of autoMatches) {
        await tx.bankTransactionMatch.create({
          data: {
            companyId,
            bankTransactionId: match.bankTransactionId,
            journalLineId: match.journalLineId,
            matchType: 'AUTO',
            confidence: new Prisma.Decimal(match.confidence.toFixed(2)),
            matchedBy: userId,
          },
        });

        // Mark bank transaction as matched
        await tx.bankTransaction.update({
          where: { id: match.bankTransactionId },
          data: { isMatched: true },
        });
      }

      // Create BankTransactionMatch records for suggested (do NOT mark isMatched — user must approve)
      for (const match of suggestedMatches) {
        await tx.bankTransactionMatch.create({
          data: {
            companyId,
            bankTransactionId: match.bankTransactionId,
            journalLineId: match.journalLineId,
            matchType: 'AI_SUGGESTED',
            confidence: new Prisma.Decimal(match.confidence.toFixed(2)),
            matchedBy: userId,
          },
        });
      }

      // If there's an active reconciliation, add auto-matched lines to it
      const activeReconciliation = await tx.bankReconciliation.findFirst({
        where: {
          companyId,
          bankAccountId,
          status: 'IN_PROGRESS',
        },
        select: { id: true },
      });

      if (activeReconciliation && autoMatches.length > 0) {
        // Fetch the newly created match IDs
        const newMatches = await tx.bankTransactionMatch.findMany({
          where: {
            companyId,
            bankTransactionId: { in: autoMatches.map((m) => m.bankTransactionId) },
            matchType: 'AUTO',
          },
          select: { id: true },
        });

        for (const m of newMatches) {
          await tx.bankReconciliationLine.create({
            data: {
              reconciliationId: activeReconciliation.id,
              matchId: m.id,
            },
          });
        }
      }
    });
  }

  return summary;
}
