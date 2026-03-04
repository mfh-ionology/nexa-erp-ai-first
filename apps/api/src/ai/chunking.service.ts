/**
 * ChunkingService — Recursive text splitting for RAG knowledge base
 *
 * Splits documents into overlapping chunks suitable for embedding and retrieval.
 * Uses paragraph > sentence > word split hierarchy with markdown header preservation.
 *
 * @epic E5d-1 Task 3
 */
import type { Logger } from 'pino';
import { estimateTokens } from './dynamic-context.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChunkingOptions {
  /** Target tokens per chunk (~4 chars/token). Default: 500 */
  targetTokens?: number;
  /** Overlap tokens between consecutive chunks. Default: 50 */
  overlapTokens?: number;
  /** Preserve markdown headers at chunk boundaries. Default: true */
  preserveHeaders?: boolean;
}

export interface ChunkResult {
  /** The chunk text content (including overlap and inherited headers) */
  content: string;
  /** 0-based index of this chunk in the sequence */
  chunkIndex: number;
  /** Estimated token count (4 chars/token) */
  tokenCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TARGET_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;
const CHARS_PER_TOKEN = 4;

/** Sentence-ending patterns — split after punctuation followed by whitespace */
const SENTENCE_TERMINATORS = /(?<=[.!?])\s+/;

/** Markdown heading pattern — captures the full heading line */
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;

// ─── Service ──────────────────────────────────────────────────────────────────

export class ChunkingService {
  constructor(_logger: Logger) {}

  /**
   * Split a document into overlapping chunks for embedding.
   *
   * Algorithm:
   * 1. Split into paragraphs (double newline)
   * 2. If a paragraph exceeds target size, split into sentences
   * 3. If a sentence exceeds target size, split on word boundaries
   * 4. Accumulate segments into chunks up to targetTokens
   * 5. Apply overlap from previous chunk to the start of the next
   * 6. Optionally prepend the last-seen markdown header
   */
  chunkDocument(content: string, opts?: ChunkingOptions): ChunkResult[] {
    const targetTokens = opts?.targetTokens ?? DEFAULT_TARGET_TOKENS;
    const overlapTokens = opts?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
    const preserveHeaders = opts?.preserveHeaders ?? true;

    const targetChars = targetTokens * CHARS_PER_TOKEN;
    const overlapChars = overlapTokens * CHARS_PER_TOKEN;

    // Normalise line endings and trim
    const normalised = content.replace(/\r\n/g, '\n').trim();

    if (!normalised) {
      return [];
    }

    // Split into atomic segments (paragraphs → sentences → words as needed)
    const segments = this.splitIntoSegments(normalised, targetChars);

    if (segments.length === 0) {
      return [];
    }

    // Accumulate segments into chunks
    const rawChunks = this.accumulateChunks(segments, targetChars);

    // Apply overlap and header preservation
    const results = this.applyOverlapAndHeaders(rawChunks, overlapChars, preserveHeaders);

    // Filter empty/whitespace-only and assign indexes
    return results
      .filter((text) => text.trim().length > 0)
      .map((text, idx) => ({
        content: text,
        chunkIndex: idx,
        tokenCount: estimateTokens(text),
      }));
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Recursively split text into segments that are each <= targetChars.
   * Split hierarchy: paragraph (\n\n) > sentence (.!?) > word (space)
   */
  private splitIntoSegments(text: string, targetChars: number): string[] {
    // If the text fits in one chunk, return as-is
    if (text.length <= targetChars) {
      return [text];
    }

    // Try splitting by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    if (paragraphs.length > 1) {
      const segments: string[] = [];
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;
        if (trimmed.length <= targetChars) {
          segments.push(trimmed);
        } else {
          // Paragraph too large — split into sentences
          segments.push(...this.splitBySentences(trimmed, targetChars));
        }
      }
      return segments;
    }

    // Single paragraph — split by sentences
    return this.splitBySentences(text, targetChars);
  }

  /**
   * Split text by sentence boundaries. Falls back to word splitting for long sentences.
   */
  private splitBySentences(text: string, targetChars: number): string[] {
    const sentences = text.split(SENTENCE_TERMINATORS);
    if (sentences.length > 1) {
      const segments: string[] = [];
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;
        if (trimmed.length <= targetChars) {
          segments.push(trimmed);
        } else {
          // Sentence too large — split by words
          segments.push(...this.splitByWords(trimmed, targetChars));
        }
      }
      return segments;
    }

    // Single sentence — split by words
    return this.splitByWords(text, targetChars);
  }

  /**
   * Split text by word boundaries, never mid-word.
   * Each resulting segment is <= targetChars.
   */
  private splitByWords(text: string, targetChars: number): string[] {
    const words = text.split(/\s+/);
    const segments: string[] = [];
    let current = '';

    for (const word of words) {
      if (!word) continue;

      const candidate = current ? `${current} ${word}` : word;

      if (candidate.length <= targetChars) {
        current = candidate;
      } else {
        // Push accumulated words as a segment
        if (current) {
          segments.push(current);
        }
        // If a single word exceeds targetChars, it becomes its own segment
        // (we never split mid-word)
        current = word;
      }
    }

    if (current) {
      segments.push(current);
    }

    return segments;
  }

  /**
   * Accumulate segments into chunks, each up to targetChars.
   * Joins segments with double newline (paragraph separator) when possible.
   */
  private accumulateChunks(segments: string[], targetChars: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const segment of segments) {
      const separator = currentChunk ? '\n\n' : '';
      const candidate = currentChunk + separator + segment;

      if (candidate.length <= targetChars) {
        currentChunk = candidate;
      } else {
        // Current chunk is full — push it and start new one
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = segment;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Apply overlap and markdown header preservation to raw chunks.
   *
   * - Each chunk (except the first) is prepended with the tail of the previous chunk
   * - If preserveHeaders is true, the last-seen markdown heading is prepended
   */
  private applyOverlapAndHeaders(
    rawChunks: string[],
    overlapChars: number,
    preserveHeaders: boolean,
  ): string[] {
    if (rawChunks.length === 0) return [];

    // Track the last seen heading across chunks
    let lastHeading = '';
    const results: string[] = [];

    for (let i = 0; i < rawChunks.length; i++) {
      let chunk = rawChunks[i];

      // Apply overlap from previous chunk (except for the first chunk)
      if (i > 0 && overlapChars > 0) {
        const prevChunk = rawChunks[i - 1];
        const overlapText = this.extractOverlap(prevChunk!, overlapChars);

        if (overlapText) {
          chunk = overlapText + '\n\n' + chunk;
        }
      }

      // Prepend inherited heading if this chunk doesn't start with one
      if (preserveHeaders && lastHeading) {
        const firstLine = chunk!.split('\n')[0];
        if (!HEADING_PATTERN.test(firstLine!)) {
          chunk = lastHeading + '\n\n' + chunk;
        }
      }

      results.push(chunk!);

      // Update last heading by scanning the raw chunk (not overlap)
      const headingInChunk = this.findLastHeading(rawChunks[i]!);
      if (headingInChunk) {
        lastHeading = headingInChunk;
      }
    }

    return results;
  }

  /**
   * Extract the last ~overlapChars of text, ending at a word boundary.
   */
  private extractOverlap(text: string, overlapChars: number): string {
    if (text.length <= overlapChars) {
      return text;
    }

    // Take the tail
    const tail = text.slice(-overlapChars);

    // Find the first word boundary (space) to avoid mid-word overlap
    const firstSpace = tail.indexOf(' ');
    if (firstSpace === -1) {
      return tail;
    }

    return tail.slice(firstSpace + 1);
  }

  /**
   * Find the last markdown heading in a text block.
   * Returns the full heading line (e.g., "## Section Title") or empty string.
   */
  private findLastHeading(text: string): string {
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const match = lines[i]!.trim().match(HEADING_PATTERN);
      if (match) {
        return lines[i]!.trim();
      }
    }
    return '';
  }
}
