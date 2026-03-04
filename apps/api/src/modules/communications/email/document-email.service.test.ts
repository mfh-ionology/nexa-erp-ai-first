// ---------------------------------------------------------------------------
// Unit tests for DocumentEmailService — E10-3 Task 10.1
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted ensures they exist when vi.mock is hoisted)
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockEventBus,
  mockEmailService,
  mockEmailQueueService,
  mockEmailTemplateService,
  mockEmailTemplateEngine,
  mockValidateEntityExists,
  mockPutObject,
  mockGetDefaultBucket,
  mockCreateSystemLink,
} = vi.hoisted(() => ({
  mockPrisma: {
    attachment: { create: vi.fn() },
    emailMessage: { update: vi.fn() },
    companyProfile: { findFirst: vi.fn() },
    systemSetting: { findFirst: vi.fn() },
    customerInvoice: { findFirst: vi.fn() },
    customer: { findFirst: vi.fn() },
    contact: { findFirst: vi.fn() },
    purchaseOrder: { findFirst: vi.fn() },
    supplier: { findFirst: vi.fn() },
    salesQuote: { findFirst: vi.fn() },
    payslip: { findFirst: vi.fn() },
    employee: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    setLogger: vi.fn(),
  },
  mockEmailService: {
    createEmail: vi.fn(),
    appendSignature: vi.fn(),
  },
  mockEmailQueueService: {
    queueEmail: vi.fn(),
  },
  mockEmailTemplateService: {
    getTemplate: vi.fn(),
    resolveTemplate: vi.fn(),
  },
  mockEmailTemplateEngine: {
    compileTemplate: vi.fn(),
  },
  mockValidateEntityExists: vi.fn(),
  mockPutObject: vi.fn(),
  mockGetDefaultBucket: vi.fn(),
  mockCreateSystemLink: vi.fn(),
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  RecordLinkType: { RELATES_TO: 'RELATES_TO', PARENT_CHILD: 'PARENT_CHILD' },
}));

vi.mock('../../../core/entity-registry/index.js', () => ({
  validateEntityExists: mockValidateEntityExists,
}));

vi.mock('../../../core/storage/index.js', () => ({
  putObject: mockPutObject,
  getDefaultBucket: mockGetDefaultBucket,
}));

vi.mock('../../cross-cutting/record-link.service.js', () => ({
  createSystemLink: mockCreateSystemLink,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  DocumentEmailService,
  SENDABLE_STATUS_MAP,
  PDF_FILENAME_MAP,
} from './document-email.service.js';

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';
const TEST_RECORD_ID = randomUUID();
const TEST_EMAIL_MESSAGE_ID = randomUUID();
const TEST_TEMPLATE_ID = randomUUID();

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_TEMPLATE_ID,
    code: 'INVOICE_SEND',
    name: 'Invoice Send',
    documentType: 'CustomerInvoice',
    subjectTemplate: 'Invoice {{invoiceNumber}}',
    bodyHtmlTemplate: '<p>Dear {{customerName}},</p>',
    languageCode: 'en',
    isActive: true,
    isDefault: true,
    attachPdf: true,
    autoSend: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEmailMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_EMAIL_MESSAGE_ID,
    companyId: TEST_COMPANY_ID,
    subject: 'Invoice INV-001',
    bodyHtml: '<p>Dear Customer,</p>',
    status: 'DRAFT',
    direction: 'OUTBOUND',
    hasAttachments: false,
    recipients: [],
    ...overrides,
  };
}

function makeCompanyProfile(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Company',
    email: 'accounts@testcompany.co.uk',
    phone: '01onal234567',
    addressLine1: '123 High Street',
    addressLine2: null,
    city: 'London',
    county: null,
    postcode: 'EC1A 1BB',
    countryCode: 'GB',
    baseCurrencyCode: 'GBP',
    ...overrides,
  };
}

function setupDefaults() {
  mockGetDefaultBucket.mockReturnValue('nexa-attachments');
  mockPutObject.mockResolvedValue(undefined);
  mockValidateEntityExists.mockResolvedValue(undefined);
  mockCreateSystemLink.mockResolvedValue({ id: randomUUID() });

  mockEmailTemplateService.resolveTemplate.mockResolvedValue(makeTemplate());
  mockEmailTemplateEngine.compileTemplate.mockReturnValue({
    renderSubject: (data: Record<string, unknown>) => `Invoice ${data.invoiceNumber}`,
    renderBody: (data: Record<string, unknown>) => `<p>Dear ${data.customerName},</p>`,
  });

  // Document exists and is POSTED
  mockPrisma.customerInvoice.findFirst.mockResolvedValue({
    id: TEST_RECORD_ID,
    companyId: TEST_COMPANY_ID,
    status: 'POSTED',
    customerId: 'cust-001',
    invoiceNumber: 'INV-001',
    totalAmount: 1000,
    dueDate: new Date(),
    issueDate: new Date(),
  });

  // Customer email
  mockPrisma.customer.findFirst.mockResolvedValue({
    id: 'cust-001',
    email: 'customer@example.com',
  });

  // FROM address from SystemSetting
  mockPrisma.systemSetting.findFirst.mockResolvedValue({
    value: 'invoices@testcompany.co.uk',
  });

  // Company profile
  mockPrisma.companyProfile.findFirst.mockResolvedValue(makeCompanyProfile());

  // EmailService.createEmail
  mockEmailService.createEmail.mockResolvedValue(makeEmailMessage());
  mockEmailService.appendSignature.mockResolvedValue(undefined);

  // EmailQueueService.queueEmail
  mockEmailQueueService.queueEmail.mockResolvedValue({ id: randomUUID(), status: 'PENDING' });

  // Attachment
  mockPrisma.attachment.create.mockResolvedValue({ id: randomUUID() });
  mockPrisma.emailMessage.update.mockResolvedValue({
    id: TEST_EMAIL_MESSAGE_ID,
    hasAttachments: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentEmailService', () => {
  let service: DocumentEmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentEmailService(
      mockPrisma as never,
      mockLogger,
      mockEventBus as never,
      mockEmailService as never,
      mockEmailQueueService as never,
      mockEmailTemplateService as never,
      mockEmailTemplateEngine as never,
    );
    setupDefaults();
  });

  // =========================================================================
  // sendDocumentEmail — happy path
  // =========================================================================

  describe('sendDocumentEmail', () => {
    it('sends document email with valid document — creates EmailMessage, RecordLink', async () => {
      const result = await service.sendDocumentEmail(
        { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
        { documentType: 'CustomerInvoice', recordId: TEST_RECORD_ID },
      );

      // Validates entity exists
      expect(mockValidateEntityExists).toHaveBeenCalledWith(
        mockPrisma,
        'CustomerInvoice',
        TEST_RECORD_ID,
        TEST_COMPANY_ID,
      );

      // Creates email
      expect(mockEmailService.createEmail).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEST_USER_ID,
        expect.objectContaining({
          subject: expect.any(String),
          bodyHtml: expect.any(String),
          sourceEntityType: 'CustomerInvoice',
          sourceEntityId: TEST_RECORD_ID,
          emailTemplateId: TEST_TEMPLATE_ID,
          isHtml: true,
        }),
      );

      // Attaches PDF — creates Attachment record
      expect(mockPrisma.attachment.create).toHaveBeenCalled();

      // Sets hasAttachments = true (E10-1 CR issue #6)
      expect(mockPrisma.emailMessage.update).toHaveBeenCalledWith({
        where: { id: TEST_EMAIL_MESSAGE_ID },
        data: { hasAttachments: true },
      });

      // Appends signature (BR-COM-009)
      expect(mockEmailService.appendSignature).toHaveBeenCalledWith(
        TEST_EMAIL_MESSAGE_ID,
        TEST_COMPANY_ID,
        TEST_USER_ID,
      );

      // Queues email (DRAFT → QUEUED)
      expect(mockEmailQueueService.queueEmail).toHaveBeenCalledWith(
        TEST_EMAIL_MESSAGE_ID,
        TEST_COMPANY_ID,
      );

      // Creates RecordLink
      expect(mockCreateSystemLink).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          sourceEntityType: 'CustomerInvoice',
          sourceEntityId: TEST_RECORD_ID,
          targetEntityType: 'EmailMessage',
          targetEntityId: TEST_EMAIL_MESSAGE_ID,
          linkType: 'RELATES_TO',
        }),
        TEST_USER_ID,
      );

      expect(result.emailMessage.id).toBe(TEST_EMAIL_MESSAGE_ID);
      expect(result.recipientEmail).toBe('customer@example.com');
    });

    it('rejects unsupported document type', async () => {
      await expect(
        service.sendDocumentEmail(
          { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
          { documentType: 'UnsupportedType', recordId: TEST_RECORD_ID },
        ),
      ).rejects.toThrow(
        expect.objectContaining({ messageKey: 'errors.documentEmail.unsupportedType' }),
      );
    });

    it('rejects document not in sendable state', async () => {
      mockPrisma.customerInvoice.findFirst.mockResolvedValue({
        id: TEST_RECORD_ID,
        companyId: TEST_COMPANY_ID,
        status: 'DRAFT', // DRAFT is not in SENDABLE_STATUS_MAP for CustomerInvoice
      });

      await expect(
        service.sendDocumentEmail(
          { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
          { documentType: 'CustomerInvoice', recordId: TEST_RECORD_ID },
        ),
      ).rejects.toThrow(
        expect.objectContaining({ code: 'DOCUMENT_NOT_SENDABLE', statusCode: 400 }),
      );
    });

    it('rejects when no template found (BR-COM-010)', async () => {
      mockEmailTemplateService.resolveTemplate.mockResolvedValue(null);

      await expect(
        service.sendDocumentEmail(
          { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
          { documentType: 'CustomerInvoice', recordId: TEST_RECORD_ID },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: 'EMAIL_TEMPLATE_NOT_FOUND' }));
    });

    it('recipientOverrides takes precedence over auto-resolved email', async () => {
      const overrideEmail = 'override@example.com';

      await service.sendDocumentEmail(
        { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
        {
          documentType: 'CustomerInvoice',
          recordId: TEST_RECORD_ID,
          recipientOverrides: [overrideEmail],
        },
      );

      // The createEmail call should have TO: override@example.com
      const createEmailCall = mockEmailService.createEmail.mock.calls[0]![2];
      const toRecipient = createEmailCall.recipients.find(
        (r: { recipientType: string }) => r.recipientType === 'TO',
      );
      expect(toRecipient.emailAddress).toBe(overrideEmail);
    });

    it('CC/BCC recipients added correctly', async () => {
      const ccEmail = 'cc@example.com';
      const bccEmail = 'bcc@example.com';

      await service.sendDocumentEmail(
        { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
        {
          documentType: 'CustomerInvoice',
          recordId: TEST_RECORD_ID,
          cc: [ccEmail],
          bcc: [bccEmail],
        },
      );

      const createEmailCall = mockEmailService.createEmail.mock.calls[0]![2];
      const ccRecipient = createEmailCall.recipients.find(
        (r: { recipientType: string }) => r.recipientType === 'CC',
      );
      const bccRecipient = createEmailCall.recipients.find(
        (r: { recipientType: string }) => r.recipientType === 'BCC',
      );
      expect(ccRecipient.emailAddress).toBe(ccEmail);
      expect(bccRecipient.emailAddress).toBe(bccEmail);
    });

    it('throws when no recipient and no override provided', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'cust-001', email: null });
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.sendDocumentEmail(
          { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
          { documentType: 'CustomerInvoice', recordId: TEST_RECORD_ID },
        ),
      ).rejects.toThrow(
        expect.objectContaining({ messageKey: 'errors.documentEmail.noRecipient' }),
      );
    });

    it('RecordLink failure is non-critical — continues', async () => {
      mockCreateSystemLink.mockRejectedValue(new Error('RecordLink creation failed'));

      const result = await service.sendDocumentEmail(
        { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
        { documentType: 'CustomerInvoice', recordId: TEST_RECORD_ID },
      );

      // Should still succeed
      expect(result.emailMessage.id).toBe(TEST_EMAIL_MESSAGE_ID);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ emailMessageId: TEST_EMAIL_MESSAGE_ID }),
        expect.stringContaining('Failed to create RecordLink'),
      );
    });

    it('uses subject/bodyHtml overrides when provided', async () => {
      await service.sendDocumentEmail(
        { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
        {
          documentType: 'CustomerInvoice',
          recordId: TEST_RECORD_ID,
          subject: 'Custom Subject',
          bodyHtml: '<p>Custom body</p>',
        },
      );

      const createEmailCall = mockEmailService.createEmail.mock.calls[0]![2];
      expect(createEmailCall.subject).toBe('Custom Subject');
      expect(createEmailCall.bodyHtml).toBe('<p>Custom body</p>');
    });

    it('resolves FROM address from SystemSettings, then company profile fallback', async () => {
      mockPrisma.systemSetting.findFirst.mockResolvedValue(null);
      // Falls back to company profile email
      mockPrisma.companyProfile.findFirst.mockResolvedValue(makeCompanyProfile());

      await service.sendDocumentEmail(
        { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
        { documentType: 'CustomerInvoice', recordId: TEST_RECORD_ID },
      );

      const createEmailCall = mockEmailService.createEmail.mock.calls[0]![2];
      const fromRecipient = createEmailCall.recipients.find(
        (r: { recipientType: string }) => r.recipientType === 'FROM',
      );
      expect(fromRecipient.emailAddress).toBe('accounts@testcompany.co.uk');
    });

    it('throws NO_FROM_ADDRESS when no sender configured', async () => {
      mockPrisma.systemSetting.findFirst.mockResolvedValue(null);
      mockPrisma.companyProfile.findFirst
        .mockResolvedValueOnce(makeCompanyProfile()) // loadRecordDataForTemplate call
        .mockResolvedValueOnce({ email: null }); // resolveFromAddress call

      await expect(
        service.sendDocumentEmail(
          { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
          { documentType: 'CustomerInvoice', recordId: TEST_RECORD_ID },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: 'NO_FROM_ADDRESS', statusCode: 400 }));
    });
  });

  // =========================================================================
  // resolveRecipientEmail
  // =========================================================================

  describe('resolveRecipientEmail', () => {
    it('resolves customer email for customer-facing documents', async () => {
      const email = await service.resolveRecipientEmail(
        'CustomerInvoice',
        TEST_RECORD_ID,
        TEST_COMPANY_ID,
      );
      expect(email).toBe('customer@example.com');
    });

    it('falls back to Contact with role "Accounts" if customer email missing', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'cust-001', email: null });
      mockPrisma.contact.findFirst.mockResolvedValue({ email: 'accounts@customer.com' });

      const email = await service.resolveRecipientEmail(
        'CustomerInvoice',
        TEST_RECORD_ID,
        TEST_COMPANY_ID,
      );
      expect(email).toBe('accounts@customer.com');
    });

    it('resolves supplier email for PurchaseOrder', async () => {
      mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
        id: TEST_RECORD_ID,
        companyId: TEST_COMPANY_ID,
        supplierId: 'sup-001',
      });
      mockPrisma.supplier.findFirst.mockResolvedValue({
        id: 'sup-001',
        email: 'supplier@example.com',
      });

      const email = await service.resolveRecipientEmail(
        'PurchaseOrder',
        TEST_RECORD_ID,
        TEST_COMPANY_ID,
      );
      expect(email).toBe('supplier@example.com');
    });

    it('returns null for unknown document type', async () => {
      const email = await service.resolveRecipientEmail('Unknown', TEST_RECORD_ID, TEST_COMPANY_ID);
      expect(email).toBeNull();
    });
  });

  // =========================================================================
  // previewDocumentEmail
  // =========================================================================

  describe('previewDocumentEmail', () => {
    it('returns preview data with from, to, subject, bodyHtml, attachmentFileName', async () => {
      const result = await service.previewDocumentEmail(
        { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
        { documentType: 'CustomerInvoice', recordId: TEST_RECORD_ID },
      );

      expect(result.from).toBe('invoices@testcompany.co.uk');
      expect(result.to).toBe('customer@example.com');
      expect(result.subject).toEqual(expect.any(String));
      expect(result.bodyHtml).toEqual(expect.any(String));
      expect(result.attachmentFileName).toMatch(/Invoice-/);
    });

    it('throws when template not found', async () => {
      mockEmailTemplateService.resolveTemplate.mockResolvedValue(null);

      await expect(
        service.previewDocumentEmail(
          { companyId: TEST_COMPANY_ID, userId: TEST_USER_ID },
          { documentType: 'CustomerInvoice', recordId: TEST_RECORD_ID },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: 'EMAIL_TEMPLATE_NOT_FOUND' }));
    });
  });

  // =========================================================================
  // attachDocumentPdf
  // =========================================================================

  describe('attachDocumentPdf', () => {
    it('uploads PDF and creates Attachment record with hasAttachments = true', async () => {
      await service.attachDocumentPdf(
        TEST_EMAIL_MESSAGE_ID,
        'CustomerInvoice',
        TEST_RECORD_ID,
        TEST_COMPANY_ID,
        TEST_COMPANY_ID,
        TEST_USER_ID,
        { invoiceNumber: 'INV-001' },
      );

      expect(mockPutObject).toHaveBeenCalledWith(
        'nexa-attachments',
        expect.stringContaining('EmailMessage'),
        expect.any(Buffer),
        'application/pdf',
      );

      expect(mockPrisma.attachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'EmailMessage',
          entityId: TEST_EMAIL_MESSAGE_ID,
          fileName: 'Invoice-INV-001.pdf',
          mimeType: 'application/pdf',
        }),
      });

      expect(mockPrisma.emailMessage.update).toHaveBeenCalledWith({
        where: { id: TEST_EMAIL_MESSAGE_ID },
        data: { hasAttachments: true },
      });
    });
  });

  // =========================================================================
  // SENDABLE_STATUS_MAP & PDF_FILENAME_MAP
  // =========================================================================

  describe('SENDABLE_STATUS_MAP', () => {
    it('defines 7 document types', () => {
      expect(Object.keys(SENDABLE_STATUS_MAP)).toHaveLength(7);
      expect(SENDABLE_STATUS_MAP.CustomerInvoice).toEqual(['POSTED', 'APPROVED']);
      expect(SENDABLE_STATUS_MAP.CustomerStatement).toEqual(['GENERATED']);
    });
  });

  describe('PDF_FILENAME_MAP', () => {
    it('generates correct filenames per document type', () => {
      expect(PDF_FILENAME_MAP.CustomerInvoice!({ invoiceNumber: 'INV-123' })).toBe(
        'Invoice-INV-123.pdf',
      );
      expect(PDF_FILENAME_MAP.PurchaseOrder!({ poNumber: 'PO-456' })).toBe('PO-PO-456.pdf');
      expect(PDF_FILENAME_MAP.Payslip!({ payPeriod: '2026-03' })).toBe('Payslip-2026-03.pdf');
    });

    it('uses fallback values when data is missing', () => {
      expect(PDF_FILENAME_MAP.CustomerInvoice!({})).toBe('Invoice-DRAFT.pdf');
    });
  });
});
