// ---------------------------------------------------------------------------
// Document-to-Email Service — E10-3 Task 1
// Orchestrates sending business documents (invoices, POs, etc.) as emails
// with PDF attachments. Reuses E10-1 EmailService/QueueService and E10-2
// template resolution/rendering.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';

import { RecordLinkType } from '@nexa/db';
import type { PrismaClient, EmailMessage } from '@nexa/db';

import { AppError, ValidationError, NotFoundError } from '../../../core/errors/index.js';
import { validateEntityExists } from '../../../core/entity-registry/index.js';
import { putObject, getDefaultBucket } from '../../../core/storage/index.js';
import type { EventBus } from '../../../core/events/event-bus.js';
import type { EmailService, CreateEmailRecipientInput } from './email.service.js';
import type { EmailQueueService } from './email-queue.service.js';
import type { EmailTemplateService } from './email-template.service.js';
import type { EmailTemplateEngineService } from './email-template-engine.service.js';
import { createSystemLink } from '../../cross-cutting/record-link.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export interface SendDocumentEmailInput {
  documentType: string;
  recordId: string;
  recipientOverrides?: string[];
  cc?: string[];
  bcc?: string[];
  templateId?: string;
  subject?: string;
  bodyHtml?: string;
}

export interface SendDocumentEmailResult {
  emailMessage: EmailMessage;
  queueStatus: string;
  recipientEmail: string;
}

export interface DocumentEmailPreviewResult {
  from: string;
  to: string;
  subject: string;
  bodyHtml: string;
  attachmentFileName: string | null;
}

// ---------------------------------------------------------------------------
// Sendable Status Map (subtask 1.3)
// ---------------------------------------------------------------------------

/** Document types and the statuses from which they can be emailed. */
export const SENDABLE_STATUS_MAP: Record<string, string[]> = {
  CustomerInvoice: ['POSTED', 'APPROVED'],
  SalesQuote: ['SENT', 'APPROVED'],
  SalesOrder: ['CONFIRMED', 'APPROVED'],
  PurchaseOrder: ['APPROVED', 'SENT'],
  CreditNote: ['POSTED', 'APPROVED'],
  CustomerStatement: ['GENERATED'],
  Payslip: ['GENERATED', 'APPROVED'],
};

/** Supported document types for document-to-email. */
export const SUPPORTED_DOCUMENT_TYPES = Object.keys(SENDABLE_STATUS_MAP);

// RFC 5322 simplified email format check (BR-COM-001)
// Keep in sync with frontend regex in apps/web/src/features/email/components/email-recipient-field.tsx
const EMAIL_RFC5322_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// ---------------------------------------------------------------------------
// Customer-facing vs supplier-facing document classification
// ---------------------------------------------------------------------------

const CUSTOMER_FACING_TYPES = new Set([
  'CustomerInvoice',
  'SalesQuote',
  'SalesOrder',
  'CreditNote',
  'CustomerStatement',
]);

const SUPPLIER_FACING_TYPES = new Set(['PurchaseOrder']);

const EMPLOYEE_FACING_TYPES = new Set(['Payslip']);

// ---------------------------------------------------------------------------
// DocumentEmailService (subtasks 1.1, 1.2)
// ---------------------------------------------------------------------------

export class DocumentEmailService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    _eventBus: EventBus,
    private readonly emailService: EmailService,
    private readonly emailQueueService: EmailQueueService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailTemplateEngine: EmailTemplateEngineService,
  ) {}

  // -------------------------------------------------------------------------
  // sendDocumentEmail (subtask 1.2)
  // -------------------------------------------------------------------------

  async sendDocumentEmail(
    ctx: { companyId: string; userId: string; tenantId?: string },
    input: SendDocumentEmailInput,
  ): Promise<SendDocumentEmailResult> {
    const { documentType, recordId } = input;

    // Step 1: Validate document type is supported
    if (!SENDABLE_STATUS_MAP[documentType]) {
      throw new ValidationError(
        `Unsupported document type for email: ${documentType}`,
        { documentType: [`Supported types: ${SUPPORTED_DOCUMENT_TYPES.join(', ')}`] },
        'errors.documentEmail.unsupportedType',
        { documentType },
      );
    }

    // Step 2: Validate the source document exists and belongs to the caller's company
    await validateEntityExists(this.prisma, documentType, recordId, ctx.companyId);

    // Step 3: Validate the document is in a sendable state
    await this.validateSendableState(documentType, recordId, ctx.companyId);

    // Step 4: Resolve the email template (BR-COM-010 fallback hierarchy)
    const template = input.templateId
      ? await this.emailTemplateService.getTemplate(input.templateId)
      : await this.emailTemplateService.resolveTemplate(documentType);

    if (!template) {
      throw new NotFoundError(
        'EMAIL_TEMPLATE_NOT_FOUND',
        `No email template found for document type: ${documentType} (BR-COM-010)`,
        'errors.documentEmail.templateNotFound',
        { documentType },
      );
    }

    // Step 5: Load the source record data for Handlebars merge
    const recordData = await this.loadRecordDataForTemplate(documentType, recordId, ctx.companyId);

    // Step 6: Compile and render the template with record data
    const compiled = this.emailTemplateEngine.compileTemplate(template);
    const renderedSubject = input.subject ?? compiled.renderSubject(recordData);
    const renderedBody = input.bodyHtml ?? compiled.renderBody(recordData);

    // Step 7: Resolve recipient email
    const recipientEmail =
      input.recipientOverrides?.[0] ??
      (await this.resolveRecipientEmail(documentType, recordId, ctx.companyId));

    if (!recipientEmail) {
      throw new ValidationError(
        'No recipient email address found. Provide recipientOverrides or ensure the customer/supplier has an email address.',
        { recipients: ['No email address could be resolved for this document'] },
        'errors.documentEmail.noRecipient',
      );
    }

    // Step 8: Resolve FROM address from per-company SMTP config
    const fromEmail = await this.resolveFromAddress(ctx.companyId);

    // Step 9: Build recipients array
    const recipients: CreateEmailRecipientInput[] = [
      { recipientType: 'FROM', emailAddress: fromEmail },
      { recipientType: 'TO', emailAddress: recipientEmail },
    ];

    // Add extra TO recipients from overrides (beyond the first)
    if (input.recipientOverrides && input.recipientOverrides.length > 1) {
      for (let i = 1; i < input.recipientOverrides.length; i++) {
        recipients.push({ recipientType: 'TO', emailAddress: input.recipientOverrides[i]! });
      }
    }

    // Add CC recipients
    if (input.cc) {
      for (const cc of input.cc) {
        recipients.push({ recipientType: 'CC', emailAddress: cc });
      }
    }

    // Add BCC recipients
    if (input.bcc) {
      for (const bcc of input.bcc) {
        recipients.push({ recipientType: 'BCC', emailAddress: bcc });
      }
    }

    // Step 10: Create EmailMessage via EmailService
    const emailMessage = await this.emailService.createEmail(ctx.companyId, ctx.userId, {
      subject: renderedSubject,
      bodyHtml: renderedBody,
      recipients,
      sourceEntityType: documentType,
      sourceEntityId: recordId,
      emailTemplateId: template.id,
      isHtml: true,
    });

    // Step 11: Generate and attach PDF (Task 2 — BR-COM-015, E10-1 CR issue #6)
    await this.attachDocumentPdf(
      emailMessage.id,
      documentType,
      recordId,
      ctx.companyId,
      ctx.tenantId ?? ctx.companyId, // tenantId fallback to companyId
      ctx.userId,
      recordData,
    );

    // Step 12: Append email signature (BR-COM-009)
    await this.emailService.appendSignature(emailMessage.id, ctx.companyId, ctx.userId);

    // Step 13: Queue email for sending (DRAFT → QUEUED)
    const queueEntry = await this.emailQueueService.queueEmail(emailMessage.id, ctx.companyId);

    // Step 14: Create RecordLink between document and email (AC4)
    try {
      await createSystemLink(
        this.prisma,
        {
          sourceEntityType: documentType,
          sourceEntityId: recordId,
          targetEntityType: 'EmailMessage',
          targetEntityId: emailMessage.id,
          linkType: RecordLinkType.RELATES_TO,
          description: `Email sent for ${documentType}`,
        },
        ctx.userId,
      );
    } catch (error) {
      // RecordLink creation is non-critical — log and continue
      this.logger.warn(
        { error, documentType, recordId, emailMessageId: emailMessage.id },
        'Failed to create RecordLink for document email — continuing',
      );
    }

    this.logger.info(
      {
        emailMessageId: emailMessage.id,
        documentType,
        recordId,
        recipientEmail,
        queueStatus: queueEntry.status,
      },
      'document email created and queued',
    );

    return {
      emailMessage,
      queueStatus: queueEntry.status,
      recipientEmail,
    };
  }

  // -------------------------------------------------------------------------
  // sendBatchStatementForCustomer — batch statement emails (AC5)
  // Unlike sendDocumentEmail, this does NOT require a pre-existing
  // CustomerStatement record. It resolves the customer email directly
  // and generates a statement PDF for the given customer.
  // -------------------------------------------------------------------------

  async sendBatchStatementForCustomer(
    ctx: { companyId: string; userId: string; tenantId?: string },
    customerId: string,
  ): Promise<SendDocumentEmailResult> {
    const documentType = 'CustomerStatement';

    // Resolve the email template (BR-COM-010 fallback hierarchy)
    const template = await this.emailTemplateService.resolveTemplate(documentType);
    if (!template) {
      throw new NotFoundError(
        'EMAIL_TEMPLATE_NOT_FOUND',
        `No email template found for document type: ${documentType} (BR-COM-010)`,
        'errors.documentEmail.templateNotFound',
        { documentType },
      );
    }

    // Load customer data directly (no statement record needed)
    const customerDelegate = (this.prisma as unknown as Record<string, unknown>).customer as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    let customerData: Record<string, unknown> = {};
    if (customerDelegate && typeof customerDelegate.findFirst === 'function') {
      const customer = await customerDelegate.findFirst({
        where: { id: customerId, companyId: ctx.companyId },
        select: { id: true, name: true, email: true },
      });
      if (customer) {
        customerData = customer;
      }
    }

    // Build template data from customer + company
    const company = await this.prisma.companyProfile.findFirst({
      where: { id: ctx.companyId },
      select: {
        name: true,
        email: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        county: true,
        postcode: true,
        countryCode: true,
        baseCurrencyCode: true,
      },
    });
    const companyAddress = company
      ? [company.addressLine1, company.addressLine2, company.city, company.county, company.postcode]
          .filter(Boolean)
          .join(', ')
      : '';

    const recordData: Record<string, unknown> = {
      companyName: company?.name ?? '',
      companyEmail: company?.email ?? '',
      companyPhone: company?.phone ?? '',
      companyAddress,
      currency: company?.baseCurrencyCode ?? 'GBP',
      customerName: customerData.name ?? '',
      customerEmail: customerData.email ?? '',
      statementDate: new Date().toISOString().split('T')[0],
    };

    // Render template
    const compiled = this.emailTemplateEngine.compileTemplate(template);
    const renderedSubject = compiled.renderSubject(recordData);
    const renderedBody = compiled.renderBody(recordData);

    // Resolve recipient email from customer
    const recipientEmail = (customerData.email as string | undefined) ?? null;
    if (!recipientEmail || !EMAIL_RFC5322_REGEX.test(recipientEmail)) {
      throw new ValidationError(
        `No valid email address for customer ${customerId}`,
        { recipients: ['Customer has no email address configured'] },
        'errors.documentEmail.noRecipient',
      );
    }

    // Resolve FROM address
    const fromEmail = await this.resolveFromAddress(ctx.companyId);

    // Build recipients
    const recipients: CreateEmailRecipientInput[] = [
      { recipientType: 'FROM', emailAddress: fromEmail },
      { recipientType: 'TO', emailAddress: recipientEmail },
    ];

    // Create EmailMessage
    const emailMessage = await this.emailService.createEmail(ctx.companyId, ctx.userId, {
      subject: renderedSubject,
      bodyHtml: renderedBody,
      recipients,
      sourceEntityType: 'Customer',
      sourceEntityId: customerId,
      emailTemplateId: template.id,
      isHtml: true,
    });

    // Generate and attach PDF
    await this.attachDocumentPdf(
      emailMessage.id,
      documentType,
      customerId,
      ctx.companyId,
      ctx.tenantId ?? ctx.companyId,
      ctx.userId,
      recordData,
    );

    // Append signature
    await this.emailService.appendSignature(emailMessage.id, ctx.companyId, ctx.userId);

    // Queue email
    const queueEntry = await this.emailQueueService.queueEmail(emailMessage.id, ctx.companyId);

    // Create RecordLink (non-critical)
    try {
      await createSystemLink(
        this.prisma,
        {
          sourceEntityType: 'Customer',
          sourceEntityId: customerId,
          targetEntityType: 'EmailMessage',
          targetEntityId: emailMessage.id,
          linkType: RecordLinkType.RELATES_TO,
          description: 'Batch statement email',
        },
        ctx.userId,
      );
    } catch (error) {
      this.logger.warn(
        { error, customerId, emailMessageId: emailMessage.id },
        'Failed to create RecordLink for batch statement email — continuing',
      );
    }

    this.logger.info(
      {
        emailMessageId: emailMessage.id,
        customerId,
        recipientEmail,
        queueStatus: queueEntry.status,
      },
      'batch statement email created and queued',
    );

    return {
      emailMessage,
      queueStatus: queueEntry.status,
      recipientEmail,
    };
  }

  // -------------------------------------------------------------------------
  // previewDocumentEmail — for the frontend composition dialog
  // -------------------------------------------------------------------------

  async previewDocumentEmail(
    ctx: { companyId: string; userId: string },
    input: { documentType: string; recordId: string; templateId?: string },
  ): Promise<DocumentEmailPreviewResult> {
    const { documentType, recordId } = input;

    // Validate document type is supported
    if (!SENDABLE_STATUS_MAP[documentType]) {
      throw new ValidationError(
        `Unsupported document type for email: ${documentType}`,
        { documentType: [`Supported types: ${SUPPORTED_DOCUMENT_TYPES.join(', ')}`] },
        'errors.documentEmail.unsupportedType',
        { documentType },
      );
    }

    // Validate document exists
    await validateEntityExists(this.prisma, documentType, recordId, ctx.companyId);

    // Validate the document is in a sendable state (same check as sendDocumentEmail)
    await this.validateSendableState(documentType, recordId, ctx.companyId);

    // Resolve template
    const template = input.templateId
      ? await this.emailTemplateService.getTemplate(input.templateId)
      : await this.emailTemplateService.resolveTemplate(documentType);

    if (!template) {
      throw new NotFoundError(
        'EMAIL_TEMPLATE_NOT_FOUND',
        `No email template found for document type: ${documentType}`,
        'errors.documentEmail.templateNotFound',
        { documentType },
      );
    }

    // Load record data and render
    const recordData = await this.loadRecordDataForTemplate(documentType, recordId, ctx.companyId);
    const compiled = this.emailTemplateEngine.compileTemplate(template);

    const fromEmail = await this.resolveFromAddress(ctx.companyId);
    const toEmail = await this.resolveRecipientEmail(documentType, recordId, ctx.companyId);

    return {
      from: fromEmail,
      to: toEmail ?? '',
      subject: compiled.renderSubject(recordData),
      bodyHtml: compiled.renderBody(recordData),
      attachmentFileName: this.getAttachmentFileName(documentType, recordData),
    };
  }

  // -------------------------------------------------------------------------
  // attachDocumentPdf (Task 2, subtask 2.1)
  // Generates a PDF for the document and attaches it to the EmailMessage.
  // When E12 (Document Templates & PDF) is available, this will call the
  // document generation endpoint. Until then, a placeholder PDF is used.
  // -------------------------------------------------------------------------

  async attachDocumentPdf(
    emailMessageId: string,
    documentType: string,
    recordId: string,
    _companyId: string,
    tenantId: string,
    userId: string,
    recordData: Record<string, unknown>,
  ): Promise<void> {
    // Resolve filename from document type and record data (subtask 2.2)
    const fileNameMapper = PDF_FILENAME_MAP[documentType];
    const fileName = fileNameMapper ? fileNameMapper(recordData) : `Document-${recordId}.pdf`;

    // TODO: When E12 is available, replace with:
    //   const pdfBuffer = await this.documentGenerationService.generate(documentType, recordId);
    const pdfBuffer = generatePlaceholderPdf(documentType, recordData, fileName);

    // Upload to S3/MinIO
    const bucket = getDefaultBucket();
    const storageKey = `${tenantId}/EmailMessage/${emailMessageId}/${randomUUID()}-${fileName}`;

    await putObject(bucket, storageKey, pdfBuffer, 'application/pdf');

    // Create Attachment record (BR-COM-015: S3 presign flow — server-side for generated PDFs)
    await this.prisma.attachment.create({
      data: {
        entityType: 'EmailMessage',
        entityId: emailMessageId,
        fileName,
        fileSize: pdfBuffer.length,
        mimeType: 'application/pdf',
        storageKey,
        storageBucket: bucket,
        description: `Auto-generated PDF for ${documentType}`,
        uploadedBy: userId,
      },
    });

    // Ensure hasAttachments is true on the EmailMessage (E10-1 CR issue #6)
    await this.prisma.emailMessage.update({
      where: { id: emailMessageId },
      data: { hasAttachments: true },
    });

    this.logger.info(
      { emailMessageId, documentType, fileName, fileSize: pdfBuffer.length },
      'PDF attached to email message',
    );
  }

  // -------------------------------------------------------------------------
  // validateSendableState (subtask 1.3)
  // -------------------------------------------------------------------------

  private async validateSendableState(
    documentType: string,
    recordId: string,
    companyId: string,
  ): Promise<void> {
    const allowedStatuses = SENDABLE_STATUS_MAP[documentType];
    if (!allowedStatuses) return;

    // Use dynamic Prisma delegate access (same pattern as entity-registry)
    const delegateKey = documentType.charAt(0).toLowerCase() + documentType.slice(1);
    const delegate = (this.prisma as unknown as Record<string, unknown>)[delegateKey] as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    if (!delegate || typeof delegate.findFirst !== 'function') {
      // Model not yet available (future epic) — skip status check
      this.logger.debug(
        { documentType },
        'Prisma model not available — skipping status validation',
      );
      return;
    }

    const record = await delegate.findFirst({
      where: { id: recordId, companyId },
      select: { id: true, status: true },
    });

    if (!record) {
      throw new NotFoundError(
        'DOCUMENT_NOT_FOUND',
        `${documentType} with id ${recordId} not found`,
        'errors.documentEmail.documentNotFound',
        { documentType, recordId },
      );
    }

    const status = record.status as string | undefined;
    if (status && !allowedStatuses.includes(status)) {
      throw new AppError(
        'DOCUMENT_NOT_SENDABLE',
        `${documentType} is in status "${status}" which is not sendable. Allowed statuses: ${allowedStatuses.join(', ')}`,
        400,
        { status: [`Document must be in one of: ${allowedStatuses.join(', ')}`] },
        'errors.documentEmail.notSendable',
        { documentType, status, allowedStatuses: allowedStatuses.join(', ') },
      );
    }
  }

  // -------------------------------------------------------------------------
  // resolveRecipientEmail (subtask 1.4)
  // -------------------------------------------------------------------------

  async resolveRecipientEmail(
    documentType: string,
    recordId: string,
    companyId: string,
  ): Promise<string | null> {
    if (CUSTOMER_FACING_TYPES.has(documentType)) {
      return this.resolveCustomerEmail(documentType, recordId, companyId);
    }
    if (SUPPLIER_FACING_TYPES.has(documentType)) {
      return this.resolveSupplierEmail(documentType, recordId, companyId);
    }
    if (EMPLOYEE_FACING_TYPES.has(documentType)) {
      return this.resolveEmployeeEmail(documentType, recordId, companyId);
    }
    return null;
  }

  private async resolveCustomerEmail(
    documentType: string,
    recordId: string,
    companyId: string,
  ): Promise<string | null> {
    // Load the document to get the customerId
    const delegateKey = documentType.charAt(0).toLowerCase() + documentType.slice(1);
    const delegate = (this.prisma as unknown as Record<string, unknown>)[delegateKey] as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    if (!delegate || typeof delegate.findFirst !== 'function') {
      return null;
    }

    const record = await delegate.findFirst({
      where: { id: recordId, companyId },
      select: { customerId: true },
    });

    if (!record?.customerId) return null;

    const customerId = record.customerId as string;

    // Try Customer.email first
    const customerDelegate = (this.prisma as unknown as Record<string, unknown>).customer as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    if (customerDelegate && typeof customerDelegate.findFirst === 'function') {
      const customer = await customerDelegate.findFirst({
        where: { id: customerId, companyId },
        select: { email: true },
      });

      if (customer?.email && typeof customer.email === 'string') {
        if (EMAIL_RFC5322_REGEX.test(customer.email)) {
          return customer.email;
        }
      }
    }

    // Fallback: try Contact with role "Accounts" linked to the customer
    const contactDelegate = (this.prisma as unknown as Record<string, unknown>).contact as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    if (contactDelegate && typeof contactDelegate.findFirst === 'function') {
      const contact = await contactDelegate.findFirst({
        where: {
          entityType: 'Customer',
          entityId: customerId,
          companyId,
          role: 'Accounts',
        },
        select: { email: true },
      });

      if (contact?.email && typeof contact.email === 'string') {
        if (EMAIL_RFC5322_REGEX.test(contact.email)) {
          return contact.email;
        }
      }
    }

    return null;
  }

  private async resolveSupplierEmail(
    documentType: string,
    recordId: string,
    companyId: string,
  ): Promise<string | null> {
    const delegateKey = documentType.charAt(0).toLowerCase() + documentType.slice(1);
    const delegate = (this.prisma as unknown as Record<string, unknown>)[delegateKey] as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    if (!delegate || typeof delegate.findFirst !== 'function') {
      return null;
    }

    const record = await delegate.findFirst({
      where: { id: recordId, companyId },
      select: { supplierId: true },
    });

    if (!record?.supplierId) return null;

    const supplierId = record.supplierId as string;

    // Try Supplier.email
    const supplierDelegate = (this.prisma as unknown as Record<string, unknown>).supplier as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    if (supplierDelegate && typeof supplierDelegate.findFirst === 'function') {
      const supplier = await supplierDelegate.findFirst({
        where: { id: supplierId, companyId },
        select: { email: true },
      });

      if (supplier?.email && typeof supplier.email === 'string') {
        if (EMAIL_RFC5322_REGEX.test(supplier.email)) {
          return supplier.email;
        }
      }
    }

    // Fallback: Contact with role "Accounts"
    const contactDelegate = (this.prisma as unknown as Record<string, unknown>).contact as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    if (contactDelegate && typeof contactDelegate.findFirst === 'function') {
      const contact = await contactDelegate.findFirst({
        where: {
          entityType: 'Supplier',
          entityId: supplierId,
          companyId,
          role: 'Accounts',
        },
        select: { email: true },
      });

      if (contact?.email && typeof contact.email === 'string') {
        if (EMAIL_RFC5322_REGEX.test(contact.email)) {
          return contact.email;
        }
      }
    }

    return null;
  }

  private async resolveEmployeeEmail(
    documentType: string,
    recordId: string,
    companyId: string,
  ): Promise<string | null> {
    const delegateKey = documentType.charAt(0).toLowerCase() + documentType.slice(1);
    const delegate = (this.prisma as unknown as Record<string, unknown>)[delegateKey] as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    if (!delegate || typeof delegate.findFirst !== 'function') {
      return null;
    }

    const record = await delegate.findFirst({
      where: { id: recordId, companyId },
      select: { employeeId: true },
    });

    if (!record?.employeeId) return null;

    const employeeId = record.employeeId as string;

    const employeeDelegate = (this.prisma as unknown as Record<string, unknown>).employee as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    if (employeeDelegate && typeof employeeDelegate.findFirst === 'function') {
      const employee = await employeeDelegate.findFirst({
        where: { id: employeeId, companyId },
        select: { email: true },
      });

      if (employee?.email && typeof employee.email === 'string') {
        if (EMAIL_RFC5322_REGEX.test(employee.email)) {
          return employee.email;
        }
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // loadRecordDataForTemplate (subtask 1.5)
  // -------------------------------------------------------------------------

  async loadRecordDataForTemplate(
    documentType: string,
    recordId: string,
    companyId: string,
  ): Promise<Record<string, unknown>> {
    // Load the source record using dynamic Prisma delegate access
    const delegateKey = documentType.charAt(0).toLowerCase() + documentType.slice(1);
    const delegate = (this.prisma as unknown as Record<string, unknown>)[delegateKey] as
      | { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> }
      | undefined;

    let recordData: Record<string, unknown> = {};

    if (delegate && typeof delegate.findFirst === 'function') {
      const selectFields = RECORD_SELECT_FIELDS[documentType];
      const record = await delegate.findFirst({
        where: { id: recordId, companyId },
        ...(selectFields ? { select: selectFields } : {}),
      });
      if (record) {
        recordData = record as Record<string, unknown>;
      }
    }

    // Load company details for companyName, companyEmail, companyPhone, companyAddress
    const company = await this.prisma.companyProfile.findFirst({
      where: { id: companyId },
      select: {
        name: true,
        email: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        county: true,
        postcode: true,
        countryCode: true,
        baseCurrencyCode: true,
      },
    });

    const companyAddress = company
      ? [company.addressLine1, company.addressLine2, company.city, company.county, company.postcode]
          .filter(Boolean)
          .join(', ')
      : '';

    // Map fields to the Handlebars variable schema per document type
    const templateData: Record<string, unknown> = {
      // Company fields (common across all types)
      companyName: company?.name ?? '',
      companyEmail: company?.email ?? '',
      companyPhone: company?.phone ?? '',
      companyAddress,
      currency: company?.baseCurrencyCode ?? 'GBP',
    };

    // Map document-type-specific fields from the record
    const mapper = RECORD_DATA_MAPPERS[documentType];
    if (mapper) {
      Object.assign(templateData, mapper(recordData));
    }

    return templateData;
  }

  // -------------------------------------------------------------------------
  // resolveFromAddress (Step 7)
  // -------------------------------------------------------------------------

  private async resolveFromAddress(companyId: string): Promise<string> {
    // Try per-company SMTP config from SystemSettings
    const smtpSetting = await this.prisma.systemSetting.findFirst({
      where: { companyId, key: 'smtp.fromEmail' },
      select: { value: true },
    });

    if (smtpSetting?.value) {
      const fromEmail = smtpSetting.value.replace(/^"|"$/g, ''); // strip JSON quotes
      if (EMAIL_RFC5322_REGEX.test(fromEmail)) {
        return fromEmail;
      }
    }

    // Fallback: company profile email
    const company = await this.prisma.companyProfile.findFirst({
      where: { id: companyId },
      select: { email: true },
    });

    if (company?.email && EMAIL_RFC5322_REGEX.test(company.email)) {
      return company.email;
    }

    throw new AppError(
      'NO_FROM_ADDRESS',
      'No sender email address configured. Set smtp.fromEmail in System Settings or add an email to the Company Profile.',
      400,
      undefined,
      'errors.documentEmail.noFromAddress',
    );
  }

  // -------------------------------------------------------------------------
  // getAttachmentFileName — used by preview
  // -------------------------------------------------------------------------

  private getAttachmentFileName(
    documentType: string,
    data: Record<string, unknown>,
  ): string | null {
    const mapper = PDF_FILENAME_MAP[documentType];
    if (mapper) {
      return mapper(data);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Record Data Mappers — map raw Prisma record to template variables
// ---------------------------------------------------------------------------

// Select fields per document type — limits DB query to only needed columns
const RECORD_SELECT_FIELDS: Record<string, Record<string, true>> = {
  CustomerInvoice: {
    invoiceNumber: true,
    documentNumber: true,
    customerName: true,
    customerEmail: true,
    totalAmount: true,
    total: true,
    dueDate: true,
    issueDate: true,
    date: true,
    lineItems: true,
    lines: true,
  },
  CustomerStatement: {
    customerName: true,
    customerEmail: true,
    statementDate: true,
    date: true,
    openingBalance: true,
    closingBalance: true,
    transactions: true,
  },
  SalesQuote: {
    quoteNumber: true,
    documentNumber: true,
    customerName: true,
    customerEmail: true,
    totalAmount: true,
    total: true,
    validUntil: true,
    expiryDate: true,
    lineItems: true,
    lines: true,
  },
  SalesOrder: {
    orderNumber: true,
    documentNumber: true,
    customerName: true,
    customerEmail: true,
    totalAmount: true,
    total: true,
    expectedDeliveryDate: true,
    deliveryDate: true,
    lineItems: true,
    lines: true,
  },
  PurchaseOrder: {
    poNumber: true,
    documentNumber: true,
    supplierName: true,
    supplierEmail: true,
    totalAmount: true,
    total: true,
    expectedDeliveryDate: true,
    deliveryDate: true,
    lineItems: true,
    lines: true,
  },
  CreditNote: {
    creditNoteNumber: true,
    documentNumber: true,
    customerName: true,
    customerEmail: true,
    totalAmount: true,
    total: true,
    reason: true,
    originalInvoiceNumber: true,
  },
  Payslip: {
    employeeName: true,
    employeeEmail: true,
    payPeriod: true,
    grossPay: true,
    netPay: true,
    deductions: true,
  },
};

const RECORD_DATA_MAPPERS: Record<
  string,
  (record: Record<string, unknown>) => Record<string, unknown>
> = {
  CustomerInvoice: (r) => ({
    invoiceNumber: r.invoiceNumber ?? r.documentNumber ?? '',
    customerName: r.customerName ?? '',
    customerEmail: r.customerEmail ?? '',
    totalAmount: r.totalAmount ?? r.total ?? 0,
    dueDate: r.dueDate ?? '',
    issueDate: r.issueDate ?? r.date ?? '',
    lineItems: r.lineItems ?? r.lines ?? [],
  }),
  CustomerStatement: (r) => ({
    customerName: r.customerName ?? '',
    customerEmail: r.customerEmail ?? '',
    statementDate: r.statementDate ?? r.date ?? '',
    openingBalance: r.openingBalance ?? 0,
    closingBalance: r.closingBalance ?? 0,
    transactions: r.transactions ?? [],
  }),
  SalesQuote: (r) => ({
    quoteNumber: r.quoteNumber ?? r.documentNumber ?? '',
    customerName: r.customerName ?? '',
    customerEmail: r.customerEmail ?? '',
    totalAmount: r.totalAmount ?? r.total ?? 0,
    validUntil: r.validUntil ?? r.expiryDate ?? '',
    lineItems: r.lineItems ?? r.lines ?? [],
  }),
  SalesOrder: (r) => ({
    orderNumber: r.orderNumber ?? r.documentNumber ?? '',
    customerName: r.customerName ?? '',
    customerEmail: r.customerEmail ?? '',
    totalAmount: r.totalAmount ?? r.total ?? 0,
    expectedDeliveryDate: r.expectedDeliveryDate ?? r.deliveryDate ?? '',
    lineItems: r.lineItems ?? r.lines ?? [],
  }),
  PurchaseOrder: (r) => ({
    poNumber: r.poNumber ?? r.documentNumber ?? '',
    supplierName: r.supplierName ?? '',
    supplierEmail: r.supplierEmail ?? '',
    totalAmount: r.totalAmount ?? r.total ?? 0,
    expectedDeliveryDate: r.expectedDeliveryDate ?? r.deliveryDate ?? '',
    lineItems: r.lineItems ?? r.lines ?? [],
  }),
  CreditNote: (r) => ({
    creditNoteNumber: r.creditNoteNumber ?? r.documentNumber ?? '',
    customerName: r.customerName ?? '',
    customerEmail: r.customerEmail ?? '',
    totalAmount: r.totalAmount ?? r.total ?? 0,
    reason: r.reason ?? '',
    originalInvoiceNumber: r.originalInvoiceNumber ?? '',
  }),
  Payslip: (r) => ({
    employeeName: r.employeeName ?? '',
    employeeEmail: r.employeeEmail ?? '',
    payPeriod: r.payPeriod ?? '',
    grossPay: r.grossPay ?? 0,
    netPay: r.netPay ?? 0,
    deductions: r.deductions ?? [],
  }),
};

// ---------------------------------------------------------------------------
// Placeholder PDF generator (Task 2, subtask 2.1)
// Generates a minimal valid PDF with document metadata text.
// TODO: Replace with E12 Document Templates & PDF (Puppeteer) when available.
// ---------------------------------------------------------------------------

function generatePlaceholderPdf(
  documentType: string,
  data: Record<string, unknown>,
  fileName: string,
): Buffer {
  // Build a human-readable summary for the placeholder
  const title = `${documentType} Document`;
  const lines = [
    title,
    `File: ${fileName}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'This is a placeholder PDF.',
    'Full document rendering will be available when',
    'Document Templates (E12) are implemented.',
    '',
  ];

  // Add key document fields
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && typeof value !== 'object') {
      lines.push(`${key}: ${String(value)}`);
    }
  }

  // Build a minimal valid PDF (PDF 1.4 spec)
  const streamContent = `BT\n/F1 12 Tf\n50 750 Td\n14 TL\n${lines.map((l) => `(${escapePdfString(l)}) '`).join('\n')}\nET`;
  const streamBytes = Buffer.from(streamContent, 'utf-8');

  const objects: string[] = [];

  // Object 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  // Object 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');

  // Object 3: Page
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj',
  );

  // Object 4: Content stream
  objects.push(
    `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamContent}\nendstream\nendobj`,
  );

  // Object 5: Font
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  // Build the PDF
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf-8'));
    pdf += obj + '\n';
  }

  // Cross-reference table
  const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  // Trailer
  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefOffset}\n`;
  pdf += '%%EOF\n';

  return Buffer.from(pdf, 'utf-8');
}

/** Escape special PDF string characters. */
function escapePdfString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// ---------------------------------------------------------------------------
// PDF Filename Map (Task 2, subtask 2.2 — used by preview and attachDocumentPdf)
// ---------------------------------------------------------------------------

export const PDF_FILENAME_MAP: Record<string, (data: Record<string, unknown>) => string> = {
  CustomerInvoice: (d) => `Invoice-${d.invoiceNumber || 'DRAFT'}.pdf`,
  CustomerStatement: (d) =>
    `Statement-${d.customerName || 'Customer'}-${d.statementDate || 'undated'}.pdf`,
  SalesQuote: (d) => `Quote-${d.quoteNumber || 'DRAFT'}.pdf`,
  SalesOrder: (d) => `Order-${d.orderNumber || 'DRAFT'}.pdf`,
  PurchaseOrder: (d) => `PO-${d.poNumber || 'DRAFT'}.pdf`,
  CreditNote: (d) => `CreditNote-${d.creditNoteNumber || 'DRAFT'}.pdf`,
  Payslip: (d) => `Payslip-${d.payPeriod || 'unknown'}.pdf`,
};
