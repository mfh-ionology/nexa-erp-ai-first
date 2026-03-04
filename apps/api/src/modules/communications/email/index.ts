// ---------------------------------------------------------------------------
// Email Module — Barrel Exports
// E9-3 Task 5.1 / E10-1 Task 9.5
// ---------------------------------------------------------------------------

// Config
export { isEmailConfigured, getEmailConfig, type EmailConfig } from './email-config.js';

// Sender
export {
  createEmailSender,
  type EmailSender,
  type EmailSendOptions,
} from './email-sender.service.js';

// Notification email template
export {
  renderNotificationEmailHtml,
  renderNotificationEmailText,
  type NotificationEmailData,
} from './notification-email-template.js';

// Email CRUD service (E10-1)
export { EmailService, type CreateEmailInput, type ListEmailsFilters } from './email.service.js';

// Email queue service (E10-1)
export { EmailQueueService } from './email-queue.service.js';

// Email send queue — BullMQ queue init/access (E10-1)
export {
  initEmailSendQueue,
  enqueueEmailSend,
  getEmailSendQueue,
  EMAIL_SEND_QUEUE_NAME,
  type EmailSendJobData,
} from './email-send.queue.js';

// Email send worker factory (E10-1)
export { createEmailSendWorker, type EmailSendWorkerHandle } from './email-send.worker.js';

// Email event subscribers (E10-1)
export { registerEmailEventSubscribers } from './email.events.js';

// Email routes plugin (E10-1)
export { emailRoutesPlugin } from './email.routes.js';

// Email template engine service (E10-2)
export {
  EmailTemplateEngineService,
  SUPPORTED_DOCUMENT_TYPES,
  DOCUMENT_TYPE_VARIABLES,
  type ValidationResult,
  type CompiledTemplate,
  type PreviewResult,
} from './email-template-engine.service.js';

// Email template CRUD service (E10-2)
export {
  EmailTemplateService,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type ListTemplatesFilters,
} from './email-template.service.js';

// Email template routes plugin (E10-2)
export { emailTemplateRoutesPlugin } from './email-template.routes.js';

// Document-to-email service (E10-3)
export {
  DocumentEmailService,
  SENDABLE_STATUS_MAP,
  PDF_FILENAME_MAP,
  type SendDocumentEmailInput,
  type SendDocumentEmailResult,
  type DocumentEmailPreviewResult,
} from './document-email.service.js';

// Document-to-email routes plugins (E10-3)
export {
  documentEmailRoutesPlugin,
  batchStatementEmailRoutesPlugin,
} from './document-email.routes.js';

// Batch statement email service (E10-3)
export {
  BatchStatementEmailService,
  BATCH_STATEMENT_QUEUE_NAME,
  type BatchStatementInput,
  type BatchStatementJobData,
} from './batch-statement-email.service.js';

// Batch statement email worker (E10-3)
export {
  createBatchStatementWorker,
  type BatchStatementWorkerHandle,
} from './batch-statement-email.worker.js';
