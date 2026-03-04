// ---------------------------------------------------------------------------
// Unit tests for email-send worker — E10-1 Task 10.3
// Tests resolveSmtpConfig() and the worker processor logic.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockNodemailerTransport,
  mockEventBusEmit,
  mockGeneratePresignedGetUrl,
  mockGetEmailConfig,
  mockIsEmailConfigured,
  mockEnqueueNotificationDelivery,
  MockWorker,
} = vi.hoisted(() => {
  const transport = {
    sendMail: vi.fn(),
    close: vi.fn(),
  };

  // BullMQ Worker mock — must be a class so it can be called with `new`
  class _MockWorker {
    static instances: _MockWorker[] = [];
    processor: unknown;
    on = vi.fn();
    close = vi.fn();

    constructor(_name: string, processor: unknown) {
      this.processor = processor;
      _MockWorker.instances.push(this);
    }
  }

  return {
    mockPrisma: {
      emailQueue: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      emailMessage: {
        update: vi.fn(),
      },
      systemSetting: {
        findMany: vi.fn(),
      },
      attachment: {
        findMany: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    mockNodemailerTransport: transport,
    mockEventBusEmit: vi.fn(),
    mockGeneratePresignedGetUrl: vi.fn(),
    mockGetEmailConfig: vi.fn(),
    mockIsEmailConfigured: vi.fn(),
    mockEnqueueNotificationDelivery: vi.fn(),
    MockWorker: _MockWorker,
  };
});

vi.mock('@nexa/db', () => ({
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
  NotificationChannel: { IN_APP: 'IN_APP' },
  NotificationPriority: { HIGH: 'HIGH' },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => mockNodemailerTransport),
  },
}));

vi.mock('../../../core/storage/index.js', () => ({
  generatePresignedGetUrl: mockGeneratePresignedGetUrl,
}));

vi.mock('../../../core/events/event-bus.js', () => ({}));

vi.mock('../notifications/notification-dispatch.queue.js', () => ({
  enqueueNotificationDelivery: mockEnqueueNotificationDelivery,
}));

vi.mock('./email-config.js', () => ({
  getEmailConfig: mockGetEmailConfig,
  isEmailConfigured: mockIsEmailConfigured,
}));

// We mock BullMQ Worker/Queue to avoid needing Redis
vi.mock('bullmq', () => ({
  Worker: MockWorker,
  Queue: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { resolveSmtpConfig } from './email-send.worker.js';

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

function makeEmailMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    companyId: TEST_COMPANY_ID,
    subject: 'Test Invoice Email',
    bodyHtml: '<p>Please find your invoice attached.</p>',
    bodyText: 'Please find your invoice attached.',
    createdBy: TEST_USER_ID,
    sourceEntityType: null,
    recipients: [
      { recipientType: 'FROM', emailAddress: 'billing@company.com' },
      { recipientType: 'TO', emailAddress: 'client@example.com' },
    ],
    ...overrides,
  };
}

function makeQueueEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    emailMessageId: randomUUID(),
    status: 'PENDING',
    priority: 0,
    attempts: 0,
    maxAttempts: 3,
    lastError: null,
    emailMessage: makeEmailMessage(),
    ...overrides,
  };
}

const GLOBAL_SMTP_CONFIG = {
  host: 'smtp.global.com',
  port: 587,
  secure: false,
  user: 'global@company.com',
  pass: 'globalpass',
  fromName: 'Nexa ERP',
  fromEmail: 'noreply@nexa-erp.com',
};

// ---------------------------------------------------------------------------
// Tests: resolveSmtpConfig
// ---------------------------------------------------------------------------

describe('resolveSmtpConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns per-company SMTP config when smtp.host exists in SystemSettings', async () => {
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'smtp.host', value: 'smtp.company-a.com' },
      { key: 'smtp.port', value: '465' },
      { key: 'smtp.secure', value: 'true' },
      { key: 'smtp.user', value: 'user@company-a.com' },
      { key: 'smtp.pass', value: 'secret123' },
      { key: 'smtp.fromName', value: 'Company A' },
      { key: 'smtp.fromEmail', value: 'noreply@company-a.com' },
    ]);

    const config = await resolveSmtpConfig(mockPrisma as never, TEST_COMPANY_ID);

    expect(config).toEqual({
      host: 'smtp.company-a.com',
      port: 465,
      secure: true,
      user: 'user@company-a.com',
      pass: 'secret123',
      fromName: 'Company A',
      fromEmail: 'noreply@company-a.com',
    });
  });

  it('falls back to global env-based config when no per-company smtp.host', async () => {
    mockPrisma.systemSetting.findMany.mockResolvedValue([]);
    mockIsEmailConfigured.mockReturnValue(true);
    mockGetEmailConfig.mockReturnValue(GLOBAL_SMTP_CONFIG);

    const config = await resolveSmtpConfig(mockPrisma as never, TEST_COMPANY_ID);

    expect(config).toEqual(GLOBAL_SMTP_CONFIG);
  });

  it('returns null when neither per-company nor global SMTP configured', async () => {
    mockPrisma.systemSetting.findMany.mockResolvedValue([]);
    mockIsEmailConfigured.mockReturnValue(false);

    const config = await resolveSmtpConfig(mockPrisma as never, TEST_COMPANY_ID);

    expect(config).toBeNull();
  });

  it('uses default port 587 when smtp.port not set', async () => {
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'smtp.host', value: 'smtp.example.com' },
      { key: 'smtp.fromEmail', value: 'noreply@example.com' },
    ]);

    const config = await resolveSmtpConfig(mockPrisma as never, TEST_COMPANY_ID);

    expect(config?.port).toBe(587);
  });

  it('defaults secure to false when not set', async () => {
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'smtp.host', value: 'smtp.example.com' },
      { key: 'smtp.fromEmail', value: 'noreply@example.com' },
    ]);

    const config = await resolveSmtpConfig(mockPrisma as never, TEST_COMPANY_ID);

    expect(config?.secure).toBe(false);
  });

  it('falls back to global config when smtp.fromEmail is missing (host alone is insufficient)', async () => {
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'smtp.host', value: 'smtp.example.com' },
    ]);
    mockIsEmailConfigured.mockReturnValue(true);
    mockGetEmailConfig.mockReturnValue(GLOBAL_SMTP_CONFIG);

    const config = await resolveSmtpConfig(mockPrisma as never, TEST_COMPANY_ID);

    // Should fall through to global config since fromEmail is required for per-company
    expect(config).toEqual(GLOBAL_SMTP_CONFIG);
  });
});

// ---------------------------------------------------------------------------
// Tests: createEmailSendWorker processor logic
//
// Since the worker processor is a closure passed to BullMQ Worker constructor,
// we test it by extracting the processor from the mock Worker instantiation.
// ---------------------------------------------------------------------------

describe('email-send worker processor', () => {
  let processor: (job: {
    data: { emailQueueId: string };
    attemptsMade: number;
    opts: { attempts?: number };
  }) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    MockWorker.instances = [];

    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );

    // Import createEmailSendWorker which triggers Worker constructor mock
    const { createEmailSendWorker } = await import('./email-send.worker.js');

    createEmailSendWorker(
      mockPrisma as never,
      mockLogger,
      {} as never,
      { emit: mockEventBusEmit } as never,
    );

    // Extract the processor function from the MockWorker instance
    const workerInstance = MockWorker.instances[0]!;
    processor = workerInstance.processor as typeof processor;
  });

  it('sends email successfully and updates statuses to SENT', async () => {
    const emailMessage = makeEmailMessage();
    const queueEntry = makeQueueEntry({
      emailMessage,
      emailMessageId: emailMessage.id,
    });

    mockPrisma.emailQueue.findUnique.mockResolvedValue(queueEntry);
    mockPrisma.emailQueue.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'smtp.host', value: 'smtp.test.com' },
      { key: 'smtp.fromEmail', value: 'noreply@test.com' },
    ]);
    mockPrisma.attachment.findMany.mockResolvedValue([]);
    mockNodemailerTransport.sendMail.mockResolvedValue({
      response: '250 OK',
      messageId: '<test@smtp.test.com>',
    });
    mockPrisma.emailMessage.update.mockResolvedValue({});
    mockPrisma.emailQueue.update.mockResolvedValue({});

    await processor({
      data: { emailQueueId: queueEntry.id as string },
      attemptsMade: 0,
      opts: { attempts: 3 },
    });

    // Verify SMTP send was called
    expect(mockNodemailerTransport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: 'Test Invoice Email',
      }),
    );

    // Verify status updates
    expect(mockPrisma.emailMessage.update).toHaveBeenCalledWith({
      where: { id: emailMessage.id },
      data: expect.objectContaining({ status: 'SENT' }),
    });

    // Verify email.sent event emission
    expect(mockEventBusEmit).toHaveBeenCalledWith('email.sent', {
      emailMessageId: emailMessage.id,
      recipientEmail: 'client@example.com',
      subject: 'Test Invoice Email',
      documentType: undefined,
    });
  });

  it('skips processing when queue entry not found', async () => {
    mockPrisma.emailQueue.findUnique.mockResolvedValue(null);

    await processor({
      data: { emailQueueId: randomUUID() },
      attemptsMade: 0,
      opts: { attempts: 3 },
    });

    expect(mockNodemailerTransport.sendMail).not.toHaveBeenCalled();
  });

  it('skips when queue entry is not PENDING or RETRYING', async () => {
    const queueEntry = makeQueueEntry({ status: 'SENT' });
    mockPrisma.emailQueue.findUnique.mockResolvedValue(queueEntry);

    await processor({
      data: { emailQueueId: queueEntry.id as string },
      attemptsMade: 0,
      opts: { attempts: 3 },
    });

    expect(mockNodemailerTransport.sendMail).not.toHaveBeenCalled();
  });

  it('skips when another worker already claimed the entry (updateMany count=0)', async () => {
    const emailMessage = makeEmailMessage();
    const queueEntry = makeQueueEntry({ emailMessage, status: 'PENDING' });
    mockPrisma.emailQueue.findUnique.mockResolvedValue(queueEntry);
    mockPrisma.emailQueue.updateMany.mockResolvedValue({ count: 0 });

    await processor({
      data: { emailQueueId: queueEntry.id as string },
      attemptsMade: 0,
      opts: { attempts: 3 },
    });

    expect(mockNodemailerTransport.sendMail).not.toHaveBeenCalled();
  });

  it('marks FAILED when no SMTP config is available', async () => {
    const emailMessage = makeEmailMessage();
    const queueEntry = makeQueueEntry({
      emailMessage,
      emailMessageId: emailMessage.id,
      status: 'PENDING',
    });

    mockPrisma.emailQueue.findUnique.mockResolvedValue(queueEntry);
    mockPrisma.emailQueue.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.systemSetting.findMany.mockResolvedValue([]);
    mockIsEmailConfigured.mockReturnValue(false);
    mockPrisma.emailMessage.update.mockResolvedValue({});
    mockPrisma.emailQueue.update.mockResolvedValue({});

    await processor({
      data: { emailQueueId: queueEntry.id as string },
      attemptsMade: 0,
      opts: { attempts: 3 },
    });

    // Should mark as FAILED — both EmailMessage and EmailQueue
    expect(mockPrisma.emailMessage.update).toHaveBeenCalledWith({
      where: { id: emailMessage.id },
      data: { status: 'FAILED' },
    });
    expect(mockPrisma.emailQueue.update).toHaveBeenCalledWith({
      where: { id: queueEntry.id },
      data: expect.objectContaining({
        status: 'FAILED',
        lastError: 'No SMTP configuration available',
      }),
    });
  });

  it('throws on SMTP failure for BullMQ retry handling', async () => {
    const emailMessage = makeEmailMessage();
    const queueEntry = makeQueueEntry({
      emailMessage,
      emailMessageId: emailMessage.id,
      status: 'PENDING',
    });

    mockPrisma.emailQueue.findUnique.mockResolvedValue(queueEntry);
    mockPrisma.emailQueue.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'smtp.host', value: 'smtp.test.com' },
      { key: 'smtp.fromEmail', value: 'noreply@test.com' },
    ]);
    mockPrisma.attachment.findMany.mockResolvedValue([]);
    mockNodemailerTransport.sendMail.mockRejectedValue(new Error('SMTP connection refused'));
    mockPrisma.emailQueue.update.mockResolvedValue({});

    await expect(
      processor({
        data: { emailQueueId: queueEntry.id as string },
        attemptsMade: 0,
        opts: { attempts: 3 },
      }),
    ).rejects.toThrow('SMTP connection refused');

    // Verify retry metadata was stored
    expect(mockPrisma.emailQueue.update).toHaveBeenCalledWith({
      where: { id: queueEntry.id },
      data: expect.objectContaining({
        status: 'RETRYING',
        attempts: 1,
        lastError: 'SMTP connection refused',
      }),
    });
  });

  it('handles attachments via presigned URLs', async () => {
    const emailMessage = makeEmailMessage();
    const queueEntry = makeQueueEntry({
      emailMessage,
      emailMessageId: emailMessage.id,
      status: 'PENDING',
    });

    mockPrisma.emailQueue.findUnique.mockResolvedValue(queueEntry);
    mockPrisma.emailQueue.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'smtp.host', value: 'smtp.test.com' },
      { key: 'smtp.fromEmail', value: 'noreply@test.com' },
    ]);
    mockPrisma.attachment.findMany.mockResolvedValue([
      {
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        storageKey: 'emails/invoice.pdf',
        storageBucket: 'attachments',
      },
    ]);
    mockGeneratePresignedGetUrl.mockResolvedValue({
      url: 'https://s3.example.com/invoice.pdf?token=abc',
    });
    mockNodemailerTransport.sendMail.mockResolvedValue({
      response: '250 OK',
    });
    mockPrisma.emailMessage.update.mockResolvedValue({});
    mockPrisma.emailQueue.update.mockResolvedValue({});

    await processor({
      data: { emailQueueId: queueEntry.id as string },
      attemptsMade: 0,
      opts: { attempts: 3 },
    });

    expect(mockGeneratePresignedGetUrl).toHaveBeenCalledWith(
      'attachments',
      'emails/invoice.pdf',
      3600,
    );
    expect(mockNodemailerTransport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: 'invoice.pdf',
            path: 'https://s3.example.com/invoice.pdf?token=abc',
            contentType: 'application/pdf',
          },
        ],
      }),
    );
  });

  it('uses per-company SMTP config (Company A uses Company A settings)', async () => {
    const companyAId = '33333333-3333-4000-a000-333333333333';
    const emailMessage = makeEmailMessage({ companyId: companyAId });
    const queueEntry = makeQueueEntry({
      emailMessage,
      emailMessageId: emailMessage.id,
      status: 'PENDING',
    });

    mockPrisma.emailQueue.findUnique.mockResolvedValue(queueEntry);
    mockPrisma.emailQueue.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'smtp.host', value: 'smtp.company-a.com' },
      { key: 'smtp.fromEmail', value: 'noreply@company-a.com' },
      { key: 'smtp.fromName', value: 'Company A' },
    ]);
    mockPrisma.attachment.findMany.mockResolvedValue([]);
    mockNodemailerTransport.sendMail.mockResolvedValue({ response: '250 OK' });
    mockPrisma.emailMessage.update.mockResolvedValue({});
    mockPrisma.emailQueue.update.mockResolvedValue({});

    await processor({
      data: { emailQueueId: queueEntry.id as string },
      attemptsMade: 0,
      opts: { attempts: 3 },
    });

    // Verify the SMTP config query was scoped to companyAId
    expect(mockPrisma.systemSetting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: companyAId }),
      }),
    );
  });

  it('resolves CC and BCC recipients correctly', async () => {
    const emailMessage = makeEmailMessage({
      recipients: [
        { recipientType: 'FROM', emailAddress: 'sender@company.com' },
        { recipientType: 'TO', emailAddress: 'client@example.com' },
        { recipientType: 'CC', emailAddress: 'cc@example.com' },
        { recipientType: 'BCC', emailAddress: 'bcc@example.com' },
      ],
    });
    const queueEntry = makeQueueEntry({
      emailMessage,
      emailMessageId: emailMessage.id,
      status: 'PENDING',
    });

    mockPrisma.emailQueue.findUnique.mockResolvedValue(queueEntry);
    mockPrisma.emailQueue.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.systemSetting.findMany.mockResolvedValue([
      { key: 'smtp.host', value: 'smtp.test.com' },
      { key: 'smtp.fromEmail', value: 'noreply@test.com' },
    ]);
    mockPrisma.attachment.findMany.mockResolvedValue([]);
    mockNodemailerTransport.sendMail.mockResolvedValue({ response: '250 OK' });
    mockPrisma.emailMessage.update.mockResolvedValue({});
    mockPrisma.emailQueue.update.mockResolvedValue({});

    await processor({
      data: { emailQueueId: queueEntry.id as string },
      attemptsMade: 0,
      opts: { attempts: 3 },
    });

    expect(mockNodemailerTransport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
      }),
    );
  });
});
