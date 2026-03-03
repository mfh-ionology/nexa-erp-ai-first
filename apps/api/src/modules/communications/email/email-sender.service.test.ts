import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

const mockSendMail = vi.fn();
const mockVerify = vi.fn();
const mockClose = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
      verify: mockVerify,
      close: mockClose,
    })),
  },
}));

vi.mock('../../../core/errors/index.js', () => ({
  AppError: class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode: number) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
      this.name = 'AppError';
    }
  },
}));

// Import after mocks
import nodemailer from 'nodemailer';
import { createEmailSender } from './email-sender.service.js';
import type { EmailConfig } from './email-config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function testConfig(): EmailConfig {
  return {
    host: 'smtp.test.io',
    port: 587,
    secure: false,
    user: 'test-user',
    pass: 'test-pass',
    fromName: 'Nexa ERP',
    fromEmail: 'noreply@nexa-erp.com',
  };
}

function mockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockSendMail.mockResolvedValue({ messageId: 'test-msg-id' });
  mockVerify.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createEmailSender', () => {
  it('should create a Nodemailer transport with correct config', () => {
    const config = testConfig();
    const logger = mockLogger();

    createEmailSender(config, logger);

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test.io',
      port: 587,
      secure: false,
      auth: {
        user: 'test-user',
        pass: 'test-pass',
      },
      connectionTimeout: 30_000,
      greetingTimeout: 15_000,
      socketTimeout: 60_000,
    });
  });

  describe('sendEmail', () => {
    it('should call sendMail with correct from, to, subject, html, text fields', async () => {
      const config = testConfig();
      const logger = mockLogger();
      const sender = createEmailSender(config, logger);

      await sender.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: 'Hello',
        replyTo: 'reply@example.com',
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'Nexa ERP <noreply@nexa-erp.com>',
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: 'Hello',
        replyTo: 'reply@example.com',
      });
    });

    it('should send email without optional text and replyTo', async () => {
      const config = testConfig();
      const logger = mockLogger();
      const sender = createEmailSender(config, logger);

      await sender.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'Nexa ERP <noreply@nexa-erp.com>',
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
        text: undefined,
        replyTo: undefined,
      });
    });

    it('should throw AppError with EMAIL_SEND_FAILED on Nodemailer failure', async () => {
      const config = testConfig();
      const logger = mockLogger();
      const sender = createEmailSender(config, logger);

      mockSendMail.mockRejectedValue(new Error('Connection refused'));

      await expect(
        sender.sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Hi</p>',
        }),
      ).rejects.toMatchObject({
        code: 'EMAIL_SEND_FAILED',
        statusCode: 502,
        message: expect.stringContaining('Connection refused'),
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test',
          error: 'Connection refused',
        }),
        'email-sender: send failed',
      );
    });

    it('should handle non-Error throw values', async () => {
      const config = testConfig();
      const logger = mockLogger();
      const sender = createEmailSender(config, logger);

      mockSendMail.mockRejectedValue('string error');

      await expect(
        sender.sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Hi</p>',
        }),
      ).rejects.toMatchObject({
        code: 'EMAIL_SEND_FAILED',
        message: expect.stringContaining('string error'),
      });
    });
  });

  describe('verifyConnection', () => {
    it('should return true on successful verification', async () => {
      const config = testConfig();
      const logger = mockLogger();
      const sender = createEmailSender(config, logger);

      mockVerify.mockResolvedValue(true);

      const result = await sender.verifyConnection();

      expect(result).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('email-sender: SMTP connection verified');
    });

    it('should return false on verification failure without throwing', async () => {
      const config = testConfig();
      const logger = mockLogger();
      const sender = createEmailSender(config, logger);

      mockVerify.mockRejectedValue(new Error('SMTP unreachable'));

      const result = await sender.verifyConnection();

      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        { error: 'SMTP unreachable' },
        'email-sender: SMTP connection verification failed — emails may not be delivered',
      );
    });
  });

  describe('close', () => {
    it('should close the transport', () => {
      const config = testConfig();
      const logger = mockLogger();
      const sender = createEmailSender(config, logger);

      sender.close();

      expect(mockClose).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('email-sender: transport closed');
    });
  });
});
