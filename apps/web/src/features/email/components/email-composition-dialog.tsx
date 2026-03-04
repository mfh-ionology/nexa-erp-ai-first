/* eslint-disable i18next/no-literal-string */
/**
 * EmailCompositionDialog — modal for composing and sending document emails.
 *
 * Opens from the action bar on invoice/PO/quote detail pages.
 * Pre-fills fields from POST /documents/email/preview.
 * Sends via POST /documents/email.
 *
 * Concept D: purple accent top border, 600px width, animate-step-in.
 *
 * E10-3 Task 5.1 + 5.2
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { useDocumentEmailPreview } from '../api/use-document-email-preview';
import { useEmailTemplatesForDocument } from '../api/use-email-templates-for-document';
import { useSendDocumentEmail } from '../api/use-send-document-email';
import { AttachmentPreview } from './attachment-preview';
import { EmailRecipientField } from './email-recipient-field';
import { TemplateSelector } from './template-selector';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'CustomerInvoice'
  | 'CustomerStatement'
  | 'SalesQuote'
  | 'SalesOrder'
  | 'PurchaseOrder'
  | 'CreditNote'
  | 'Payslip';

interface EmailCompositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: DocumentType;
  recordId: string;
  documentTitle: string;
}

// ─── Helper: strip HTML tags for plain-text editing ─────────────────────────

function htmlToPlainText(html: string): string {
  // Simple approach: strip tags, decode common entities
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function plainTextToHtml(text: string): string {
  // Convert plain text back to HTML: escape entities, wrap paragraphs, convert newlines
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // Split into paragraphs on double newlines, convert single newlines to <br>
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EmailCompositionDialog({
  open,
  onOpenChange,
  documentType,
  recordId,
  documentTitle,
}: EmailCompositionDialogProps) {
  // ─── State ──────────────────────────────────────────────────────────────
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [attachmentFileName, setAttachmentFileName] = useState<string | null>(null);
  const [includeAttachment, setIncludeAttachment] = useState(true);

  // ─── API Hooks ──────────────────────────────────────────────────────────
  const preview = useDocumentEmailPreview(documentType, recordId, selectedTemplateId, open);

  const templates = useEmailTemplatesForDocument(documentType, open);

  const sendEmail = useSendDocumentEmail({
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  // ─── Populate fields from preview response ──────────────────────────────
  // Use stable primitive values as deps to avoid re-running on object identity changes
  const previewFrom = preview.data?.from;
  const previewTo = preview.data?.to;
  const previewSubject = preview.data?.subject;
  const previewBodyHtml = preview.data?.bodyHtml;
  const previewAttachment = preview.data?.attachmentFileName;

  useEffect(() => {
    if (previewFrom !== undefined) {
      setFromEmail(previewFrom);
      setToEmails(previewTo ? [previewTo] : []);
      setSubject(previewSubject ?? '');
      setBodyText(htmlToPlainText(previewBodyHtml ?? ''));
      setAttachmentFileName(previewAttachment ?? null);
      setIncludeAttachment(true);
    }
  }, [previewFrom, previewTo, previewSubject, previewBodyHtml, previewAttachment]);

  // ─── Reset state when dialog closes ─────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setToEmails([]);
      setCcEmails([]);
      setBccEmails([]);
      setShowCc(false);
      setShowBcc(false);
      setSubject('');
      setBodyText('');
      setFromEmail('');
      setSelectedTemplateId(undefined);
      setAttachmentFileName(null);
      setIncludeAttachment(true);
    }
  }, [open]);

  // ─── Template change handler ────────────────────────────────────────────
  const handleTemplateChange = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    // Preview will auto-refetch with new templateId, then useEffect above repopulates
  }, []);

  const handleResetToTemplate = useCallback(() => {
    if (previewSubject !== undefined) {
      setSubject(previewSubject);
      setBodyText(htmlToPlainText(previewBodyHtml ?? ''));
      if (previewTo) {
        setToEmails([previewTo]);
      }
    }
  }, [previewSubject, previewBodyHtml, previewTo]);

  // ─── All recipients for duplicate detection ─────────────────────────────
  const allRecipients = useMemo(
    () => [...toEmails, ...ccEmails, ...bccEmails],
    [toEmails, ccEmails, bccEmails],
  );

  // ─── Validation ─────────────────────────────────────────────────────────
  const canSend = toEmails.length > 0 && subject.trim().length > 0 && !sendEmail.isPending;

  // ─── Send handler ───────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!canSend) return;

    try {
      await sendEmail.mutateAsync({
        documentType,
        recordId,
        recipientOverrides: toEmails,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        bcc: bccEmails.length > 0 ? bccEmails : undefined,
        templateId: selectedTemplateId,
        subject,
        bodyHtml: plainTextToHtml(bodyText),
      });
    } catch (error) {
      // Error toast handled by the mutation hook
    }
  }, [
    canSend,
    sendEmail,
    documentType,
    recordId,
    toEmails,
    ccEmails,
    bccEmails,
    selectedTemplateId,
    subject,
    bodyText,
  ]);

  // ─── Loading skeleton ───────────────────────────────────────────────────
  const isLoading = preview.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'animate-step-in rounded-xl border-t-4 border-t-[#7c3aed] bg-[#f4f2ff] sm:max-w-[600px]',
          // Mobile: full-screen bottom sheet
          'max-md:top-0 max-md:left-0 max-md:translate-x-0 max-md:translate-y-0',
          'max-md:max-w-full max-md:h-[100dvh] max-md:rounded-none max-md:overflow-y-auto',
          // Tablet
          'md:max-lg:max-w-[90vw]',
        )}
      >
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Mail className="size-5 text-[#7c3aed]" />
            Send {documentTitle} via Email
          </DialogTitle>
          <DialogDescription>Compose and send this document as a PDF attachment.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selector */}
          <TemplateSelector
            templates={templates.data ?? []}
            isLoading={templates.isLoading}
            selectedTemplateId={selectedTemplateId}
            onTemplateChange={handleTemplateChange}
            onResetToTemplate={handleResetToTemplate}
            disabled={sendEmail.isPending}
          />

          {/* From Field — read-only, populated from per-company SMTP config (E10-1 CR #5) */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">From</label>
            {isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Input
                value={fromEmail}
                readOnly
                className="h-9 bg-white/60 text-sm cursor-default"
                tabIndex={-1}
              />
            )}
          </div>

          {/* To Field */}
          {isLoading ? (
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">To</label>
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <EmailRecipientField
              value={toEmails}
              onChange={setToEmails}
              label="To"
              placeholder="Add recipient email"
              allRecipients={allRecipients}
              disabled={sendEmail.isPending}
            />
          )}

          {/* Cc/Bcc toggle links */}
          {!showCc || !showBcc ? (
            <div className="flex gap-2">
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-xs font-medium text-[#7c3aed] hover:text-[#5b21b6] transition-colors"
                >
                  + Cc
                </button>
              )}
              {!showBcc && (
                <button
                  type="button"
                  onClick={() => setShowBcc(true)}
                  className="text-xs font-medium text-[#7c3aed] hover:text-[#5b21b6] transition-colors"
                >
                  + Bcc
                </button>
              )}
            </div>
          ) : null}

          {/* Cc Field */}
          {showCc && (
            <EmailRecipientField
              value={ccEmails}
              onChange={setCcEmails}
              label="Cc"
              placeholder="Add Cc recipient"
              allRecipients={allRecipients}
              disabled={sendEmail.isPending}
            />
          )}

          {/* Bcc Field */}
          {showBcc && (
            <EmailRecipientField
              value={bccEmails}
              onChange={setBccEmails}
              label="Bcc"
              placeholder="Add Bcc recipient"
              allRecipients={allRecipients}
              disabled={sendEmail.isPending}
            />
          )}

          {/* Subject */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Subject</label>
            {isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="bg-white"
                disabled={sendEmail.isPending}
              />
            )}
          </div>

          {/* Body */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Message</label>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Email body"
                className="min-h-[300px] resize-y bg-white"
                disabled={sendEmail.isPending}
              />
            )}
          </div>

          {/* Attachment */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Attachments</label>
            {isLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : attachmentFileName && includeAttachment ? (
              <AttachmentPreview
                fileName={attachmentFileName}
                isAutoGenerated
                onRemove={() => setIncludeAttachment(false)}
                disabled={sendEmail.isPending}
              />
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {attachmentFileName
                  ? 'Attachment removed. Send without PDF.'
                  : 'PDF will be generated when available.'}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:bg-[#f4f2ff] max-md:p-4 max-md:border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sendEmail.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]"
            disabled={!canSend}
            onClick={handleSend}
          >
            {sendEmail.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="size-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
