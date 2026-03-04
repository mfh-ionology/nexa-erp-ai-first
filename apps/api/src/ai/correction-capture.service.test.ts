// ---------------------------------------------------------------------------
// Unit tests for CorrectionCaptureService — E5d-2 Task 8.3
// Tests: correction creation, auto-categorisation, companyId scoping,
// event emission, immutability (no update/delete methods)
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockEventBus } = vi.hoisted(() => ({
  mockPrisma: {
    aiCorrectionLog: {
      create: vi.fn(),
    },
  },
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  CorrectionCaptureService,
  categorise,
  VALID_CORRECTION_TYPES,
  type CaptureInput,
} from './correction-capture.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = 'company-001';
const TEST_USER_ID = 'user-001';

function createService() {
  return new CorrectionCaptureService(mockPrisma as any, mockLogger as any, mockEventBus as any);
}

function makeCorrectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'correction-1',
    companyId: TEST_COMPANY_ID,
    userId: TEST_USER_ID,
    conversationId: null,
    messageId: null,
    skillKey: null,
    originalResponse: 'Original AI response',
    correctedResponse: 'Corrected response',
    correctionType: 'OTHER',
    wasAutoResolved: false,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CorrectionCaptureService', () => {
  let service: CorrectionCaptureService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // captureCorrection
  // ═══════════════════════════════════════════════════════════════════════

  describe('captureCorrection()', () => {
    it('creates a correction record with valid input', async () => {
      const row = makeCorrectionRow();
      mockPrisma.aiCorrectionLog.create.mockResolvedValue(row);

      const input: CaptureInput = {
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        originalResponse: 'Original AI response',
        correctedResponse: 'Corrected response',
      };

      const result = await service.captureCorrection(input);

      expect(result.id).toBe('correction-1');
      expect(result.companyId).toBe(TEST_COMPANY_ID);
      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.wasAutoResolved).toBe(false);
    });

    it('enforces companyId scoping in the create call', async () => {
      mockPrisma.aiCorrectionLog.create.mockResolvedValue(makeCorrectionRow());

      await service.captureCorrection({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        originalResponse: 'orig',
        correctedResponse: 'corrected',
      });

      expect(mockPrisma.aiCorrectionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: TEST_COMPANY_ID }),
        }),
      );
    });

    it('auto-categorises the correction type', async () => {
      mockPrisma.aiCorrectionLog.create.mockResolvedValue(
        makeCorrectionRow({ correctionType: 'TERMINOLOGY' }),
      );

      await service.captureCorrection({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        originalResponse: 'The item code is X',
        correctedResponse: 'We call this abbreviation ABC, not X',
      });

      expect(mockPrisma.aiCorrectionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ correctionType: 'TERMINOLOGY' }),
        }),
      );
    });

    it('sets optional fields to null when not provided', async () => {
      mockPrisma.aiCorrectionLog.create.mockResolvedValue(makeCorrectionRow());

      await service.captureCorrection({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        originalResponse: 'orig',
        correctedResponse: 'corrected',
      });

      expect(mockPrisma.aiCorrectionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: null,
            messageId: null,
            skillKey: null,
          }),
        }),
      );
    });

    it('passes optional fields when provided', async () => {
      mockPrisma.aiCorrectionLog.create.mockResolvedValue(
        makeCorrectionRow({
          conversationId: 'conv-1',
          messageId: 'msg-1',
          skillKey: 'create_invoice',
        }),
      );

      await service.captureCorrection({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        conversationId: 'conv-1',
        messageId: 'msg-1',
        skillKey: 'create_invoice',
        originalResponse: 'orig',
        correctedResponse: 'corrected',
      });

      expect(mockPrisma.aiCorrectionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv-1',
            messageId: 'msg-1',
            skillKey: 'create_invoice',
          }),
        }),
      );
    });

    it('emits ai.correction.logged event after creation', async () => {
      mockPrisma.aiCorrectionLog.create.mockResolvedValue(makeCorrectionRow());

      await service.captureCorrection({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        originalResponse: 'orig',
        correctedResponse: 'corrected',
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.correction.logged',
        expect.objectContaining({
          correctionId: 'correction-1',
          companyId: TEST_COMPANY_ID,
          userId: TEST_USER_ID,
        }),
      );
    });

    it('logs info on successful capture', async () => {
      mockPrisma.aiCorrectionLog.create.mockResolvedValue(makeCorrectionRow());

      await service.captureCorrection({
        companyId: TEST_COMPANY_ID,
        userId: TEST_USER_ID,
        originalResponse: 'orig',
        correctedResponse: 'corrected',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ correctionId: 'correction-1', companyId: TEST_COMPANY_ID }),
        'Correction captured',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Immutability — no update or delete methods
  // ═══════════════════════════════════════════════════════════════════════

  describe('immutability', () => {
    it('does not expose updateCorrection method', () => {
      expect((service as any).updateCorrection).toBeUndefined();
    });

    it('does not expose deleteCorrection method', () => {
      expect((service as any).deleteCorrection).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// categorise() — pure function tests (AC #2)
// ═══════════════════════════════════════════════════════════════════════

describe('categorise() — auto-categorisation (AC #2)', () => {
  it('returns TERMINOLOGY for keyword matches like "called", "abbreviation"', () => {
    expect(categorise('Use code X', 'We say this is called ABC abbreviation')).toBe('TERMINOLOGY');
  });

  it('returns PROCESS for keyword matches like "step", "workflow", "approval"', () => {
    expect(categorise('Do A then B', 'The workflow step should be: approval then process')).toBe(
      'PROCESS',
    );
  });

  it('returns DATA for keyword matches like "amount", "account", "value"', () => {
    expect(categorise('The total is 100', 'The amount value for account 123 is different')).toBe(
      'DATA',
    );
  });

  it('returns PREFERENCE for keyword matches like "prefer", "always", "default"', () => {
    expect(categorise('Show list view', 'I prefer to always display in default sort order')).toBe(
      'PREFERENCE',
    );
  });

  it('returns OTHER when no strong keyword match exists', () => {
    expect(categorise('Hello world', 'Goodbye planet')).toBe('OTHER');
  });

  it('is deterministic — same input produces same output', () => {
    const result1 = categorise('Input A', 'The account code is wrong');
    const result2 = categorise('Input A', 'The account code is wrong');
    expect(result1).toBe(result2);
  });

  it('checks correctedResponse as primary signal', () => {
    // "abbreviation" keyword in correctedResponse → TERMINOLOGY
    expect(categorise('nothing here', 'this abbreviation is correct')).toBe('TERMINOLOGY');
  });

  it('also checks the diff text between original and corrected', () => {
    // "code" keyword only appears in the diff (not in original) → matches DATA
    expect(categorise('the item is X', 'the item code is X')).toBe('DATA');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// VALID_CORRECTION_TYPES constant
// ═══════════════════════════════════════════════════════════════════════

describe('VALID_CORRECTION_TYPES', () => {
  it('contains exactly 5 types', () => {
    expect(VALID_CORRECTION_TYPES).toHaveLength(5);
  });

  it('includes all expected types', () => {
    expect(VALID_CORRECTION_TYPES).toContain('TERMINOLOGY');
    expect(VALID_CORRECTION_TYPES).toContain('PROCESS');
    expect(VALID_CORRECTION_TYPES).toContain('DATA');
    expect(VALID_CORRECTION_TYPES).toContain('PREFERENCE');
    expect(VALID_CORRECTION_TYPES).toContain('OTHER');
  });
});
