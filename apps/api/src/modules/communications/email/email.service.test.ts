// ---------------------------------------------------------------------------
// Unit tests for EmailService — E10-1 Task 10.1
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEventBus } = vi.hoisted(() => ({
  mockPrisma: {
    emailMessage: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    emailRecipient: {
      updateMany: vi.fn(),
    },
    emailSignature: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    setLogger: vi.fn(),
  },
}));

const mockNextNumber = vi.hoisted(() => vi.fn());

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  nextNumber: mockNextNumber,
  Prisma: { EmailMessageWhereInput: {} },
  EmailMessageStatus: {
    DRAFT: 'DRAFT',
    QUEUED: 'QUEUED',
    SENT: 'SENT',
    FAILED: 'FAILED',
    BOUNCED: 'BOUNCED',
  },
  EmailDirection: {
    INBOUND: 'INBOUND',
    OUTBOUND: 'OUTBOUND',
  },
  EmailRecipientType: {
    FROM: 'FROM',
    TO: 'TO',
    CC: 'CC',
    BCC: 'BCC',
  },
  EmailRecipientStatus: {
    UNREAD: 'UNREAD',
    READ: 'READ',
    DELETED: 'DELETED',
    ARCHIVED: 'ARCHIVED',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { EmailService } from './email.service.js';
import type { CreateEmailInput } from './email.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidInput(overrides: Partial<CreateEmailInput> = {}): CreateEmailInput {
  return {
    subject: 'Test Email Subject',
    bodyHtml: '<p>Hello</p>',
    bodyText: 'Hello',
    recipients: [
      { recipientType: 'FROM', emailAddress: 'sender@company.com' },
      { recipientType: 'TO', emailAddress: 'recipient@example.com' },
    ],
    ...overrides,
  };
}

function makeEmailRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    messageNumber: 'EM-00001',
    subject: 'Test Email Subject',
    bodyHtml: '<p>Hello</p>',
    bodyText: 'Hello',
    direction: 'OUTBOUND',
    status: 'DRAFT',
    companyId: TEST_COMPANY_ID,
    createdBy: TEST_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    recipients: [],
    queueEntry: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default $transaction implementation: pass mockPrisma as the tx object
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );

    service = new EmailService(mockPrisma as never, mockLogger, mockEventBus as never);
  });

  // -------------------------------------------------------------------------
  // createEmail
  // -------------------------------------------------------------------------

  describe('createEmail', () => {
    it('creates email with valid recipients and auto-generated messageNumber', async () => {
      const input = makeValidInput();
      const expectedEmail = makeEmailRecord({
        recipients: [
          { id: randomUUID(), recipientType: 'FROM', emailAddress: 'sender@company.com' },
          { id: randomUUID(), recipientType: 'TO', emailAddress: 'recipient@example.com' },
        ],
      });

      mockNextNumber.mockResolvedValue('EM-00001');
      mockPrisma.emailMessage.create.mockResolvedValue(expectedEmail);

      const result = await service.createEmail(TEST_COMPANY_ID, TEST_USER_ID, input);

      expect(result).toEqual(expectedEmail);
      expect(mockNextNumber).toHaveBeenCalledWith(mockPrisma, TEST_COMPANY_ID, 'EmailMessage');
      expect(mockPrisma.emailMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messageNumber: 'EM-00001',
            subject: 'Test Email Subject',
            direction: 'OUTBOUND',
            status: 'DRAFT',
            companyId: TEST_COMPANY_ID,
            createdBy: TEST_USER_ID,
          }),
          include: { recipients: true, queueEntry: true },
        }),
      );
    });

    it('populates sourceEntityType and sourceEntityId when provided', async () => {
      const input = makeValidInput({
        sourceEntityType: 'CustomerInvoice',
        sourceEntityId: randomUUID(),
      });

      mockNextNumber.mockResolvedValue('EM-00002');
      mockPrisma.emailMessage.create.mockResolvedValue(makeEmailRecord());

      await service.createEmail(TEST_COMPANY_ID, TEST_USER_ID, input);

      expect(mockPrisma.emailMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceEntityType: input.sourceEntityType,
            sourceEntityId: input.sourceEntityId,
          }),
        }),
      );
    });

    it('rejects invalid email format per BR-COM-001', async () => {
      const input = makeValidInput({
        recipients: [{ recipientType: 'TO', emailAddress: 'not-an-email' }],
      });

      await expect(service.createEmail(TEST_COMPANY_ID, TEST_USER_ID, input)).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        }),
      );
    });

    it('rejects recipient with non-existent userId per BR-COM-001', async () => {
      const fakeUserId = randomUUID();
      const input = makeValidInput({
        recipients: [{ recipientType: 'TO', emailAddress: 'user@example.com', userId: fakeUserId }],
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.createEmail(TEST_COMPANY_ID, TEST_USER_ID, input)).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        }),
      );
    });

    it('accepts recipient with valid userId', async () => {
      const userId = randomUUID();
      const input = makeValidInput({
        recipients: [{ recipientType: 'TO', emailAddress: 'user@example.com', userId }],
      });

      mockPrisma.user.findUnique.mockResolvedValue({ id: userId });
      mockNextNumber.mockResolvedValue('EM-00003');
      mockPrisma.emailMessage.create.mockResolvedValue(makeEmailRecord());

      await expect(
        service.createEmail(TEST_COMPANY_ID, TEST_USER_ID, input),
      ).resolves.toBeDefined();
    });

    it('rejects duplicate recipients per BR-COM-002', async () => {
      const input = makeValidInput({
        recipients: [
          { recipientType: 'TO', emailAddress: 'dupe@example.com' },
          { recipientType: 'TO', emailAddress: 'dupe@example.com' },
        ],
      });

      await expect(service.createEmail(TEST_COMPANY_ID, TEST_USER_ID, input)).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        }),
      );
    });

    it('allows same email address with different recipientTypes', async () => {
      const input = makeValidInput({
        recipients: [
          { recipientType: 'TO', emailAddress: 'user@example.com' },
          { recipientType: 'CC', emailAddress: 'user@example.com' },
        ],
      });

      mockNextNumber.mockResolvedValue('EM-00004');
      mockPrisma.emailMessage.create.mockResolvedValue(makeEmailRecord());

      await expect(
        service.createEmail(TEST_COMPANY_ID, TEST_USER_ID, input),
      ).resolves.toBeDefined();
    });

    it('logs after successful creation', async () => {
      const input = makeValidInput();
      const email = makeEmailRecord();
      mockNextNumber.mockResolvedValue('EM-00005');
      mockPrisma.emailMessage.create.mockResolvedValue(email);

      await service.createEmail(TEST_COMPANY_ID, TEST_USER_ID, input);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ emailMessageId: email.id }),
        'email message created',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getEmail
  // -------------------------------------------------------------------------

  describe('getEmail', () => {
    it('returns email with recipients and queue entry when found', async () => {
      const email = makeEmailRecord();
      mockPrisma.emailMessage.findFirst.mockResolvedValue(email);

      const result = await service.getEmail(email.id as string, TEST_COMPANY_ID);

      expect(result).toEqual(email);
      expect(mockPrisma.emailMessage.findFirst).toHaveBeenCalledWith({
        where: { id: email.id, companyId: TEST_COMPANY_ID },
        include: { recipients: true, queueEntry: true },
      });
    });

    it('returns null when email not found (companyId scoping)', async () => {
      mockPrisma.emailMessage.findFirst.mockResolvedValue(null);

      const result = await service.getEmail(randomUUID(), TEST_COMPANY_ID);

      expect(result).toBeNull();
    });

    it('enforces companyId scoping — returns null for wrong company', async () => {
      mockPrisma.emailMessage.findFirst.mockResolvedValue(null);
      const wrongCompanyId = '22222222-2222-4000-a000-222222222222';

      const result = await service.getEmail(randomUUID(), wrongCompanyId);

      expect(result).toBeNull();
      expect(mockPrisma.emailMessage.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: wrongCompanyId }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // listEmails
  // -------------------------------------------------------------------------

  describe('listEmails', () => {
    it('returns paginated results with companyId scoping', async () => {
      const emails = [makeEmailRecord(), makeEmailRecord()];
      mockPrisma.emailMessage.findMany.mockResolvedValue(emails);

      const result = await service.listEmails(TEST_COMPANY_ID, {});

      expect(result.items).toHaveLength(2);
      expect(result.meta.hasMore).toBe(false);
      expect(mockPrisma.emailMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: TEST_COMPANY_ID },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('filters by status', async () => {
      mockPrisma.emailMessage.findMany.mockResolvedValue([]);

      await service.listEmails(TEST_COMPANY_ID, { status: 'SENT' as never });

      expect(mockPrisma.emailMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('filters by direction', async () => {
      mockPrisma.emailMessage.findMany.mockResolvedValue([]);

      await service.listEmails(TEST_COMPANY_ID, { direction: 'OUTBOUND' as never });

      expect(mockPrisma.emailMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ direction: 'OUTBOUND' }),
        }),
      );
    });

    it('supports cursor-based pagination', async () => {
      const cursorId = randomUUID();
      mockPrisma.emailMessage.findMany.mockResolvedValue([]);

      await service.listEmails(TEST_COMPANY_ID, { cursor: cursorId, limit: 10 });

      expect(mockPrisma.emailMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: cursorId },
          skip: 1,
          take: 11, // limit + 1 for hasMore detection
        }),
      );
    });

    it('sets hasMore when more results exist', async () => {
      // Return 21 items when limit is 20 → hasMore = true
      const emails = Array.from({ length: 21 }, () => makeEmailRecord());
      mockPrisma.emailMessage.findMany.mockResolvedValue(emails);

      const result = await service.listEmails(TEST_COMPANY_ID, { limit: 20 });

      expect(result.items).toHaveLength(20);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // appendSignature
  // -------------------------------------------------------------------------

  describe('appendSignature', () => {
    it('appends user default signature to email body', async () => {
      const emailId = randomUUID();
      mockPrisma.emailMessage.findFirst.mockResolvedValue({
        id: emailId,
        bodyHtml: '<p>Hello</p>',
        bodyText: 'Hello',
      });
      mockPrisma.emailSignature.findFirst.mockResolvedValue({
        bodyHtml: '<p>Best regards, User</p>',
        bodyText: 'Best regards, User',
      });
      mockPrisma.emailMessage.update.mockResolvedValue({});

      await service.appendSignature(emailId, TEST_COMPANY_ID, TEST_USER_ID);

      expect(mockPrisma.emailMessage.update).toHaveBeenCalledWith({
        where: { id: emailId },
        data: expect.objectContaining({
          bodyHtml: expect.stringContaining('Best regards, User'),
        }),
      });
    });

    it('prevents double-append per BR-COM-009 (signature marker check)', async () => {
      const emailId = randomUUID();
      mockPrisma.emailMessage.findFirst.mockResolvedValue({
        id: emailId,
        bodyHtml: '<p>Hello</p><!-- nexa-email-signature --><br/>---<br/><p>Sig</p>',
        bodyText: 'Hello',
      });

      await service.appendSignature(emailId, TEST_COMPANY_ID, TEST_USER_ID);

      // Should NOT call update again — signature already present
      expect(mockPrisma.emailMessage.update).not.toHaveBeenCalled();
    });

    it('skips silently when user has no default signature', async () => {
      const emailId = randomUUID();
      mockPrisma.emailMessage.findFirst.mockResolvedValue({
        id: emailId,
        bodyHtml: '<p>Hello</p>',
        bodyText: 'Hello',
      });
      mockPrisma.emailSignature.findFirst.mockResolvedValue(null);

      await service.appendSignature(emailId, TEST_COMPANY_ID, TEST_USER_ID);

      expect(mockPrisma.emailMessage.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when email does not exist or wrong company', async () => {
      mockPrisma.emailMessage.findFirst.mockResolvedValue(null);

      await expect(
        service.appendSignature(randomUUID(), TEST_COMPANY_ID, TEST_USER_ID),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'EMAIL_NOT_FOUND',
          statusCode: 404,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteEmail (soft-delete)
  // -------------------------------------------------------------------------

  describe('deleteEmail', () => {
    it('soft-deletes by setting recipient status to DELETED', async () => {
      const emailId = randomUUID();
      mockPrisma.emailMessage.findFirst.mockResolvedValue({ id: emailId });
      mockPrisma.emailRecipient.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteEmail(emailId, TEST_COMPANY_ID, TEST_USER_ID);

      expect(result).toBe(true);
      expect(mockPrisma.emailRecipient.updateMany).toHaveBeenCalledWith({
        where: { emailMessageId: emailId, userId: TEST_USER_ID },
        data: { status: 'DELETED' },
      });
    });

    it('does NOT delete the EmailMessage record', async () => {
      const emailId = randomUUID();
      mockPrisma.emailMessage.findFirst.mockResolvedValue({ id: emailId });
      mockPrisma.emailRecipient.updateMany.mockResolvedValue({ count: 1 });

      await service.deleteEmail(emailId, TEST_COMPANY_ID, TEST_USER_ID);

      // EmailMessage itself should never be deleted — only recipient status changes
      expect(mockPrisma.emailMessage.update).not.toHaveBeenCalled();
    });

    it('returns false when email not found or wrong company', async () => {
      mockPrisma.emailMessage.findFirst.mockResolvedValue(null);

      const result = await service.deleteEmail(randomUUID(), TEST_COMPANY_ID, TEST_USER_ID);

      expect(result).toBe(false);
    });
  });
});
