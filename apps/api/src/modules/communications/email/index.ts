// ---------------------------------------------------------------------------
// Email Module — Barrel Exports
// E9-3 Task 5.1
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
