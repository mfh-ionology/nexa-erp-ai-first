// ---------------------------------------------------------------------------
// Email Creation Service — E10-1 Task 3
// High-level CRUD for EmailMessage records. Distinct from the low-level
// EmailSender (Nodemailer wrapper) created in E9.
// ---------------------------------------------------------------------------

import {
  Prisma,
  EmailMessageStatus,
  EmailDirection,
  EmailRecipientType,
  EmailRecipientStatus,
  nextNumber,
} from '@nexa/db';
import type { PrismaClient, EmailMessage } from '@nexa/db';

import { ValidationError, NotFoundError } from '../../../core/errors/index.js';
import type { EventBus } from '../../../core/events/event-bus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateEmailRecipientInput {
  recipientType: 'FROM' | 'TO' | 'CC' | 'BCC';
  emailAddress: string;
  userId?: string;
  displayName?: string;
}

export interface CreateEmailInput {
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  recipients: CreateEmailRecipientInput[];
  sourceEntityType?: string;
  sourceEntityId?: string;
  emailTemplateId?: string;
  priority?: number;
  isHtml?: boolean;
}

export interface ListEmailsFilters {
  status?: EmailMessageStatus;
  direction?: EmailDirection;
  sourceEntityType?: string;
  cursor?: string;
  limit?: number;
}

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

// RFC 5322 simplified email format check (BR-COM-001)
const EMAIL_RFC5322_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// HTML marker to detect whether a signature has already been appended (BR-COM-009)
const SIGNATURE_MARKER = '<!-- nexa-email-signature -->';

// ---------------------------------------------------------------------------
// EmailService class
// ---------------------------------------------------------------------------

export class EmailService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    readonly eventBus: EventBus,
  ) {}

  // -------------------------------------------------------------------------
  // createEmail (AC #1, #9) — Task 3.2
  // -------------------------------------------------------------------------

  async createEmail(
    companyId: string,
    userId: string,
    input: CreateEmailInput,
  ): Promise<EmailMessage & { recipients: Array<Record<string, unknown>> }> {
    // Validate recipients per BR-COM-001
    await this.validateRecipients(input.recipients);

    // Check for duplicate recipients per BR-COM-002
    this.checkDuplicateRecipients(input.recipients);

    // Create email + recipients in a single transaction (includes number series)
    const emailMessage = await this.prisma.$transaction(async (tx) => {
      // Auto-generate messageNumber via NumberSeries (AC #9)
      const messageNumber = await nextNumber(tx, companyId, 'EmailMessage');

      return (tx as unknown as PrismaClient).emailMessage.create({
        data: {
          messageNumber,
          subject: input.subject,
          bodyText: input.bodyText ?? null,
          bodyHtml: input.bodyHtml ?? null,
          direction: EmailDirection.OUTBOUND,
          status: EmailMessageStatus.DRAFT,
          sourceEntityType: input.sourceEntityType ?? null,
          sourceEntityId: input.sourceEntityId ?? null,
          emailTemplateId: input.emailTemplateId ?? null,
          priority: input.priority ?? 0,
          isHtml: input.isHtml ?? true,
          companyId,
          createdBy: userId,
          recipients: {
            create: input.recipients.map((r) => ({
              recipientType: r.recipientType as EmailRecipientType,
              emailAddress: r.emailAddress,
              userId: r.userId ?? null,
              displayName: r.displayName ?? null,
            })),
          },
        },
        include: {
          recipients: true,
          queueEntry: true,
        },
      });
    });

    this.logger.info(
      { emailMessageId: emailMessage.id, messageNumber: emailMessage.messageNumber },
      'email message created',
    );

    return emailMessage;
  }

  // -------------------------------------------------------------------------
  // getEmail (AC #8) — Task 3.3
  // -------------------------------------------------------------------------

  async getEmail(id: string, companyId: string) {
    const email = await this.prisma.emailMessage.findFirst({
      where: { id, companyId },
      include: {
        recipients: true,
        queueEntry: true,
      },
    });

    // Return null if not found or wrong company (cross-company → 404, not 403)
    return email;
  }

  // -------------------------------------------------------------------------
  // listEmails (AC #8) — Task 3.4
  // -------------------------------------------------------------------------

  async listEmails(companyId: string, filters: ListEmailsFilters) {
    const limit = filters.limit ?? 20;

    const where: Prisma.EmailMessageWhereInput = {
      companyId,
    };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.direction) {
      where.direction = filters.direction;
    }
    if (filters.sourceEntityType) {
      where.sourceEntityType = filters.sourceEntityType;
    }

    const findArgs: Prisma.EmailMessageFindManyArgs = {
      where,
      orderBy: { createdAt: 'desc' as const },
      take: limit + 1, // fetch one extra to determine hasMore
      include: {
        recipients: {
          select: { id: true, recipientType: true, emailAddress: true, displayName: true },
        },
        queueEntry: {
          select: { id: true, status: true, attempts: true, lastError: true },
        },
      },
    };

    if (filters.cursor) {
      findArgs.cursor = { id: filters.cursor };
      findArgs.skip = 1; // skip the cursor item itself
    }

    const items = await this.prisma.emailMessage.findMany(findArgs);

    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop();
    }

    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    return {
      items,
      meta: {
        cursor: nextCursor,
        hasMore,
      },
    };
  }

  // -------------------------------------------------------------------------
  // appendSignature (AC #7, BR-COM-009) — Task 3.5
  // -------------------------------------------------------------------------

  async appendSignature(emailId: string, companyId: string, userId: string): Promise<void> {
    // Load the email — scoped to companyId for cross-tenant safety
    const email = await this.prisma.emailMessage.findFirst({
      where: { id: emailId, companyId },
      select: { id: true, bodyHtml: true, bodyText: true },
    });

    if (!email) {
      throw new NotFoundError(
        'EMAIL_NOT_FOUND',
        'Email message not found',
        'errors.email.notFound',
      );
    }

    // Check if signature already appended (BR-COM-009: prevent double-append)
    if (email.bodyHtml?.includes(SIGNATURE_MARKER)) {
      return; // Already has signature — skip silently
    }

    // Load user's default active signature
    const signature = await this.prisma.emailSignature.findFirst({
      where: { userId, isDefault: true, isActive: true },
    });

    if (!signature) {
      return; // No default signature — skip silently
    }

    // Append signature with marker
    const htmlSeparator = `${SIGNATURE_MARKER}<br/>---<br/>`;
    const textSeparator = '\n---\n';

    const updatedHtml = email.bodyHtml
      ? `${email.bodyHtml}${htmlSeparator}${signature.bodyHtml}`
      : `${htmlSeparator}${signature.bodyHtml}`;

    const updatedText = signature.bodyText
      ? email.bodyText
        ? `${email.bodyText}${textSeparator}${signature.bodyText}`
        : `${textSeparator}${signature.bodyText}`
      : email.bodyText;

    await this.prisma.emailMessage.update({
      where: { id: emailId },
      data: {
        bodyHtml: updatedHtml,
        bodyText: updatedText ?? undefined,
      },
    });

    this.logger.debug({ emailId, userId }, 'email signature appended');
  }

  // -------------------------------------------------------------------------
  // deleteEmail (AC #8) — Task 3.6
  // -------------------------------------------------------------------------

  async deleteEmail(id: string, companyId: string, userId: string): Promise<boolean> {
    const email = await this.prisma.emailMessage.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!email) {
      return false; // Not found or wrong company
    }

    // Soft-delete: set EmailRecipient.status = DELETED for the current user
    // Do NOT delete the EmailMessage record — it may have other recipients
    const result = await this.prisma.emailRecipient.updateMany({
      where: {
        emailMessageId: id,
        userId,
      },
      data: {
        status: EmailRecipientStatus.DELETED,
      },
    });

    if (result.count === 0) {
      this.logger.debug(
        { emailId: id, userId },
        'email soft-delete: user is not a recipient — no rows updated',
      );
      return false;
    }

    this.logger.debug(
      { emailId: id, userId, recipientsMarked: result.count },
      'email soft-deleted for user',
    );

    return true;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async validateRecipients(recipients: CreateEmailRecipientInput[]): Promise<void> {
    for (const recipient of recipients) {
      // Validate email format per RFC 5322 (BR-COM-001)
      if (!EMAIL_RFC5322_REGEX.test(recipient.emailAddress)) {
        throw new ValidationError(
          `Invalid email address format: ${recipient.emailAddress}`,
          { recipients: [`Invalid email format: ${recipient.emailAddress}`] },
          'errors.email.invalidEmailFormat',
          { emailAddress: recipient.emailAddress },
        );
      }

      // Internal user: verify userId exists in the tenant's user table (BR-COM-001)
      if (recipient.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: recipient.userId },
          select: { id: true },
        });
        if (!user) {
          throw new ValidationError(
            `Recipient user not found: ${recipient.userId}`,
            { recipients: [`User ID ${recipient.userId} does not exist`] },
            'errors.email.recipientUserNotFound',
            { userId: recipient.userId },
          );
        }
      }
    }
  }

  private checkDuplicateRecipients(recipients: CreateEmailRecipientInput[]): void {
    const seen = new Set<string>();
    for (const recipient of recipients) {
      const key = `${recipient.emailAddress.toLowerCase()}:${recipient.recipientType}`;
      if (seen.has(key)) {
        throw new ValidationError(
          `Duplicate recipient: ${recipient.emailAddress} as ${recipient.recipientType}`,
          { recipients: [`Duplicate: ${recipient.emailAddress} (${recipient.recipientType})`] },
          'errors.email.duplicateRecipient',
          { emailAddress: recipient.emailAddress, recipientType: recipient.recipientType },
        );
      }
      seen.add(key);
    }
  }
}
