// ---------------------------------------------------------------------------
// Unit tests for EmailQueueService — E10-1 Task 10.2
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEnqueueEmailSend } = vi.hoisted(() => ({
  mockPrisma: {
    emailMessage: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    emailQueue: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockEnqueueEmailSend: vi.fn(),
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  EmailMessageStatus: {
    DRAFT: 'DRAFT',
    QUEUED: 'QUEUED',
    SENT: 'SENT',
    FAILED: 'FAILED',
    BOUNCED: 'BOUNCED',
  },
  EmailQueueStatus: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SENT: 'SENT',
    FAILED: 'FAILED',
    RETRYING: 'RETRYING',
  },
}));

vi.mock('./email-send.queue.js', () => ({
  enqueueEmailSend: mockEnqueueEmailSend,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { EmailQueueService } from './email-queue.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueueEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    emailMessageId: randomUUID(),
    status: 'PENDING',
    priority: 0,
    attempts: 0,
    maxAttempts: 3,
    lastError: null,
    nextRetryAt: null,
    smtpResponse: null,
    deliveredAt: null,
    queuedAt: new Date(),
    processedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailQueueService', () => {
  let service: EmailQueueService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default $transaction: pass mockPrisma as the tx object
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );

    service = new EmailQueueService(mockPrisma as never, mockLogger);
  });

  // -------------------------------------------------------------------------
  // queueEmail — DRAFT → QUEUED
  // -------------------------------------------------------------------------

  describe('queueEmail', () => {
    it('transitions DRAFT email to QUEUED and creates queue entry', async () => {
      const emailId = randomUUID();
      const queueEntry = makeQueueEntry({ emailMessageId: emailId });

      mockPrisma.emailMessage.findFirst.mockResolvedValue({
        id: emailId,
        status: 'DRAFT',
      });
      mockPrisma.emailMessage.update.mockResolvedValue({ id: emailId, status: 'QUEUED' });
      mockPrisma.emailQueue.create.mockResolvedValue(queueEntry);
      mockEnqueueEmailSend.mockResolvedValue(undefined);

      const result = await service.queueEmail(emailId, TEST_COMPANY_ID);

      expect(result).toEqual(queueEntry);
      expect(mockPrisma.emailMessage.update).toHaveBeenCalledWith({
        where: { id: emailId },
        data: { status: 'QUEUED' },
      });
      expect(mockPrisma.emailQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          emailMessageId: emailId,
          status: 'PENDING',
          priority: 0,
          attempts: 0,
          maxAttempts: 3,
        }),
      });
    });

    it('enqueues BullMQ job with correct payload', async () => {
      const emailId = randomUUID();
      const queueEntry = makeQueueEntry({ emailMessageId: emailId });

      mockPrisma.emailMessage.findFirst.mockResolvedValue({
        id: emailId,
        status: 'DRAFT',
      });
      mockPrisma.emailMessage.update.mockResolvedValue({});
      mockPrisma.emailQueue.create.mockResolvedValue(queueEntry);
      mockEnqueueEmailSend.mockResolvedValue(undefined);

      await service.queueEmail(emailId, TEST_COMPANY_ID);

      expect(mockEnqueueEmailSend).toHaveBeenCalledWith(queueEntry.id);
    });

    it('throws 404 when email not found', async () => {
      mockPrisma.emailMessage.findFirst.mockResolvedValue(null);

      await expect(service.queueEmail(randomUUID(), TEST_COMPANY_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'EMAIL_NOT_FOUND',
          statusCode: 404,
        }),
      );
    });

    it('rejects queuing SENT emails per BR-COM-003', async () => {
      const emailId = randomUUID();
      mockPrisma.emailMessage.findFirst.mockResolvedValue({
        id: emailId,
        status: 'SENT',
      });

      await expect(service.queueEmail(emailId, TEST_COMPANY_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'EMAIL_ALREADY_SENT',
          statusCode: 409,
        }),
      );
    });

    it('rejects double-queuing already QUEUED emails', async () => {
      const emailId = randomUUID();
      mockPrisma.emailMessage.findFirst.mockResolvedValue({
        id: emailId,
        status: 'QUEUED',
      });

      await expect(service.queueEmail(emailId, TEST_COMPANY_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'EMAIL_ALREADY_QUEUED',
          statusCode: 409,
        }),
      );
    });

    it('allows re-queuing FAILED emails — resets attempts', async () => {
      const emailId = randomUUID();
      const updatedQueueEntry = makeQueueEntry({
        emailMessageId: emailId,
        attempts: 0,
        lastError: null,
      });

      mockPrisma.emailMessage.findFirst.mockResolvedValue({
        id: emailId,
        status: 'FAILED',
      });
      mockPrisma.emailMessage.update.mockResolvedValue({ id: emailId, status: 'QUEUED' });
      mockPrisma.emailQueue.update.mockResolvedValue(updatedQueueEntry);
      mockEnqueueEmailSend.mockResolvedValue(undefined);

      const result = await service.queueEmail(emailId, TEST_COMPANY_ID);

      expect(result).toEqual(updatedQueueEntry);
      expect(mockPrisma.emailQueue.update).toHaveBeenCalledWith({
        where: { emailMessageId: emailId },
        data: expect.objectContaining({
          status: 'PENDING',
          attempts: 0,
          lastError: null,
          nextRetryAt: null,
        }),
      });
      expect(mockEnqueueEmailSend).toHaveBeenCalledWith(updatedQueueEntry.id);
    });

    it('rejects emails with invalid status (e.g. BOUNCED)', async () => {
      const emailId = randomUUID();
      mockPrisma.emailMessage.findFirst.mockResolvedValue({
        id: emailId,
        status: 'BOUNCED',
      });

      await expect(service.queueEmail(emailId, TEST_COMPANY_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'EMAIL_INVALID_STATUS',
          statusCode: 409,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getQueueStatus
  // -------------------------------------------------------------------------

  describe('getQueueStatus', () => {
    it('returns queue entry for an email message', async () => {
      const emailId = randomUUID();
      const queueEntry = makeQueueEntry({ emailMessageId: emailId });
      mockPrisma.emailQueue.findUnique.mockResolvedValue(queueEntry);

      const result = await service.getQueueStatus(emailId);

      expect(result).toEqual(queueEntry);
      expect(mockPrisma.emailQueue.findUnique).toHaveBeenCalledWith({
        where: { emailMessageId: emailId },
      });
    });

    it('returns null when no queue entry exists', async () => {
      mockPrisma.emailQueue.findUnique.mockResolvedValue(null);

      const result = await service.getQueueStatus(randomUUID());

      expect(result).toBeNull();
    });
  });
});
