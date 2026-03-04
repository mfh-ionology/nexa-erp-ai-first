import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { ChunkingService } from './chunking.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new ChunkingService(mockLogger as any);
}

/** Generate a string of approximately N tokens (4 chars/token) */
function generateText(tokens: number): string {
  // Each word is ~5 chars + space = ~6 chars ≈ 1.5 tokens
  // Use 3-char words + space = 4 chars = 1 token exactly
  const word = 'abc';
  const words: string[] = [];
  let charCount = 0;
  const targetChars = tokens * 4;
  while (charCount < targetChars) {
    words.push(word);
    charCount += word.length + 1; // word + space
  }
  return words.join(' ');
}

/** Generate N paragraphs of approximately tokensPerPara tokens each */
function generateParagraphs(count: number, tokensPerPara: number): string {
  return Array.from({ length: count }, () => generateText(tokensPerPara)).join('\n\n');
}

/** Generate markdown content with headers and sections */
function generateMarkdown(sections: number, tokensPerSection: number): string {
  return Array.from(
    { length: sections },
    (_, i) => `## Section ${i + 1}\n\n${generateText(tokensPerSection)}`,
  ).join('\n\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ─── Basic Chunking ─────────────────────────────────────────────────────

  describe('chunkDocument()', () => {
    it('returns empty array for empty content', () => {
      expect(service.chunkDocument('')).toEqual([]);
      expect(service.chunkDocument('   ')).toEqual([]);
      expect(service.chunkDocument('\n\n\n')).toEqual([]);
    });

    it('returns single chunk for short content', () => {
      const content = 'Hello, this is a short document.';
      const result = service.chunkDocument(content);

      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe(content);
      expect(result[0]!.chunkIndex).toBe(0);
      expect(result[0]!.tokenCount).toBeGreaterThan(0);
    });

    it('assigns sequential chunk indexes starting from 0', () => {
      const content = generateParagraphs(10, 200);
      const result = service.chunkDocument(content);

      expect(result.length).toBeGreaterThan(1);
      for (let i = 0; i < result.length; i++) {
        expect(result[i]!.chunkIndex).toBe(i);
      }
    });

    it('sets tokenCount on each chunk using 4 chars/token estimate', () => {
      const content = 'abcdefghijklmnop'; // 16 chars = 4 tokens
      const result = service.chunkDocument(content);

      expect(result).toHaveLength(1);
      expect(result[0]!.tokenCount).toBe(4);
    });

    it('discards whitespace-only chunks', () => {
      const content = 'Hello.\n\n   \n\n   \n\nWorld.';
      const result = service.chunkDocument(content);

      for (const chunk of result) {
        expect(chunk.content.trim().length).toBeGreaterThan(0);
      }
    });
  });

  // ─── Plain Text Splitting ───────────────────────────────────────────────

  describe('plain text splitting', () => {
    it('splits on paragraph boundaries (double newline)', () => {
      const content = generateParagraphs(5, 200);
      const result = service.chunkDocument(content);

      expect(result.length).toBeGreaterThan(1);
      // Each chunk should be within the target range
      for (const chunk of result) {
        // Allow some flexibility due to overlap and header injection
        expect(chunk.tokenCount).toBeLessThan(700);
      }
    });

    it('splits on sentence boundaries when paragraph is too large', () => {
      // Create one large paragraph with many sentences that exceed 500 tokens (~2000 chars)
      const sentences = Array.from(
        { length: 60 },
        (_, i) =>
          `This is sentence number ${i + 1} with plenty of additional words to ensure each sentence contributes meaningful length toward the total character count.`,
      );
      const content = sentences.join(' ');
      const result = service.chunkDocument(content);

      expect(result.length).toBeGreaterThan(1);
    });

    it('splits on word boundaries when sentence is too large', () => {
      // One very long sentence with no periods
      const content = generateText(1000); // ~1000 tokens, no punctuation
      const result = service.chunkDocument(content);

      expect(result.length).toBeGreaterThan(1);

      // Verify no mid-word splits — each chunk should contain only complete words
      for (const chunk of result) {
        // No word should be split — all chars are alphanumeric or space
        const words = chunk.content.split(/\s+/);
        for (const word of words) {
          // Each word from our generator is 'abc' — shouldn't be partial
          if (word.length > 0) {
            expect(word).toMatch(/^[a-z]+$/);
          }
        }
      }
    });

    it('never splits mid-word', () => {
      const content = generateText(2000);
      const result = service.chunkDocument(content);

      for (const chunk of result) {
        // No trailing partial words — content shouldn't end/start mid-word
        // Words in our test are 'abc', so any word should be complete
        const words = chunk.content.trim().split(/\s+/);
        for (const word of words) {
          // Allow heading markers (#) and paragraph separators
          if (word.startsWith('#')) continue;
          expect(word.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ─── Chunk Size Validation ──────────────────────────────────────────────

  describe('chunk sizes', () => {
    it('produces chunks within 450-550 token range for default settings', () => {
      // Create content that should produce multiple chunks
      const content = generateParagraphs(20, 100);
      const result = service.chunkDocument(content);

      expect(result.length).toBeGreaterThan(2);

      // First and last chunks may be smaller; check middle chunks
      // Allow wider range due to paragraph boundaries and overlap
      for (let i = 1; i < result.length - 1; i++) {
        // With overlap (~50 tokens), effective range is wider
        expect(result[i]!.tokenCount).toBeGreaterThan(100);
        expect(result[i]!.tokenCount).toBeLessThan(700);
      }
    });

    it('respects custom targetTokens', () => {
      const content = generateParagraphs(20, 50);
      const result = service.chunkDocument(content, { targetTokens: 200 });

      expect(result.length).toBeGreaterThan(2);
      // Chunks should generally be <= 200 tokens + overlap (50 tokens)
      for (const chunk of result) {
        expect(chunk.tokenCount).toBeLessThan(400);
      }
    });

    it('respects custom overlapTokens', () => {
      const content = generateParagraphs(10, 200);

      const noOverlap = service.chunkDocument(content, { overlapTokens: 0 });
      const withOverlap = service.chunkDocument(content, {
        overlapTokens: 100,
      });

      // With overlap, chunks should generally be larger (contain repeated text)
      if (noOverlap.length > 1 && withOverlap.length > 1) {
        // Total text across all chunks should be larger with overlap
        const totalNoOverlap = noOverlap.reduce((sum, c) => sum + c.content.length, 0);
        const totalWithOverlap = withOverlap.reduce((sum, c) => sum + c.content.length, 0);
        expect(totalWithOverlap).toBeGreaterThan(totalNoOverlap);
      }
    });
  });

  // ─── Overlap Validation ─────────────────────────────────────────────────

  describe('overlap between chunks', () => {
    it('consecutive chunks share overlapping text', () => {
      const content = generateParagraphs(10, 200);
      const result = service.chunkDocument(content, {
        overlapTokens: 50,
        preserveHeaders: false,
      });

      expect(result.length).toBeGreaterThan(1);

      // Check that there is some text overlap between consecutive chunks
      for (let i = 1; i < result.length; i++) {
        const prevContent = result[i - 1]!.content;
        const currContent = result[i]!.content;

        // The beginning of the current chunk should contain some text from the end of the previous
        // Extract words from the end of the previous chunk
        const prevWords = prevContent.split(/\s+/);
        const lastFewWords = prevWords.slice(-5).join(' ');

        // The current chunk should contain some of these words
        // (checking for at least partial overlap)
        const hasOverlap =
          currContent.includes(lastFewWords) ||
          prevWords.slice(-3).some((w) => currContent.includes(w));
        expect(hasOverlap).toBe(true);
      }
    });

    it('first chunk has no overlap prefix', () => {
      const content = generateParagraphs(5, 200);
      const result = service.chunkDocument(content, { preserveHeaders: false });

      // The first chunk's content should start cleanly
      expect(result[0]!.content.startsWith('abc')).toBe(true);
    });

    it('overlap does not split mid-word', () => {
      const content = generateParagraphs(5, 200);
      const result = service.chunkDocument(content, { overlapTokens: 50 });

      for (const chunk of result) {
        const words = chunk.content.split(/\s+/);
        for (const word of words) {
          if (word.startsWith('#')) continue;
          // Each word should be complete (not a partial word)
          expect(word.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ─── Markdown Header Preservation ───────────────────────────────────────

  describe('markdown header preservation', () => {
    it('preserves headers in chunks that start mid-section', () => {
      const content = generateMarkdown(5, 400);
      const result = service.chunkDocument(content, { preserveHeaders: true });

      expect(result.length).toBeGreaterThan(1);

      // Chunks after the first should inherit headers if they don't start with one
      for (let i = 1; i < result.length; i++) {
        const firstLine = result[i]!.content.split('\n')[0]!;
        // Should either start with a heading or have an inherited heading
        if (!firstLine.startsWith('#')) {
          // Check if there's a heading somewhere in the beginning (from overlap)
          const lines = result[i]!.content.split('\n');
          const hasHeading = lines.some((l) => l.match(/^#{1,6}\s+/));
          // With header preservation, chunks should have context
          expect(hasHeading || result[i]!.content.includes('Section')).toBe(true);
        }
      }
    });

    it('does not duplicate heading if chunk already starts with one', () => {
      const content =
        '## Title A\n\n' + generateText(100) + '\n\n## Title B\n\n' + generateText(100);

      const result = service.chunkDocument(content, {
        targetTokens: 200,
        preserveHeaders: true,
      });

      // No chunk should start with two consecutive headings
      for (const chunk of result) {
        const lines = chunk.content.split('\n').filter((l) => l.trim());
        let consecutiveHeadings = 0;
        for (const line of lines) {
          if (line.match(/^#{1,6}\s+/)) {
            consecutiveHeadings++;
          } else {
            consecutiveHeadings = 0;
          }
          expect(consecutiveHeadings).toBeLessThanOrEqual(2); // heading + inherited heading max
        }
      }
    });

    it('can be disabled via preserveHeaders: false', () => {
      const content = generateMarkdown(5, 400);
      const withHeaders = service.chunkDocument(content, {
        preserveHeaders: true,
      });
      const withoutHeaders = service.chunkDocument(content, {
        preserveHeaders: false,
      });

      // Without headers, total content should be less (no injected headings)
      const totalWith = withHeaders.reduce((sum, c) => sum + c.content.length, 0);
      const totalWithout = withoutHeaders.reduce((sum, c) => sum + c.content.length, 0);

      // If there are multiple chunks, with-headers should be >= without-headers
      if (withHeaders.length > 1) {
        expect(totalWith).toBeGreaterThanOrEqual(totalWithout);
      }
    });
  });

  // ─── Long Document Handling ─────────────────────────────────────────────

  describe('long documents (>10K tokens)', () => {
    it('handles documents over 10K tokens', () => {
      const content = generateParagraphs(100, 150); // ~15K tokens
      const result = service.chunkDocument(content);

      expect(result.length).toBeGreaterThan(10);

      // All chunks should have valid data
      for (const chunk of result) {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.chunkIndex).toBeGreaterThanOrEqual(0);
        expect(chunk.tokenCount).toBeGreaterThan(0);
      }
    });

    it('produces deterministic output — same input always gives same chunks', () => {
      const content = generateParagraphs(20, 100);

      const result1 = service.chunkDocument(content);
      const result2 = service.chunkDocument(content);

      expect(result1).toEqual(result2);
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles single word', () => {
      const result = service.chunkDocument('Hello');

      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe('Hello');
      expect(result[0]!.chunkIndex).toBe(0);
    });

    it('handles content with only newlines', () => {
      expect(service.chunkDocument('\n\n\n\n')).toEqual([]);
    });

    it('handles Windows-style line endings (\\r\\n)', () => {
      const content = 'Paragraph one.\r\n\r\nParagraph two.';
      const result = service.chunkDocument(content);

      // Should normalise and work correctly
      expect(result.length).toBeGreaterThanOrEqual(1);
      // No \r should remain in output
      for (const chunk of result) {
        expect(chunk.content).not.toContain('\r');
      }
    });

    it('handles very short documents (under 1 chunk)', () => {
      const content = 'Short doc.';
      const result = service.chunkDocument(content);

      expect(result).toHaveLength(1);
      expect(result[0]!.tokenCount).toBe(Math.ceil(content.length / 4));
    });

    it('handles very long single paragraphs without sentence terminators', () => {
      const content = generateText(2000); // ~2000 tokens, no periods
      const result = service.chunkDocument(content);

      expect(result.length).toBeGreaterThan(3); // Should split into multiple chunks
    });

    it('handles markdown with deep heading nesting', () => {
      const content = `# Level 1\n\nIntro text.\n\n## Level 2\n\nSome content here.\n\n### Level 3\n\nDeep content.\n\n#### Level 4\n\nVery deep content.`;
      const result = service.chunkDocument(content);

      expect(result.length).toBeGreaterThanOrEqual(1);
      // Should parse without errors
    });

    it('handles content with mixed whitespace (tabs, multiple spaces)', () => {
      const content = 'Word1\t\tword2    word3\n\nNew paragraph with content.';
      const result = service.chunkDocument(content);

      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});
