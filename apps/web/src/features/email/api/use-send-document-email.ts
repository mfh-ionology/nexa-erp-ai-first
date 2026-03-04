/**
 * useSendDocumentEmail — mutation hook for sending document emails.
 *
 * Calls POST /documents/email with form data.
 * Shows success/error toasts via sonner.
 *
 * E10-3 Task 6.1 (created with Task 5 as the dialog depends on it)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiPost } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

interface SendDocumentEmailInput {
  documentType: string;
  recordId: string;
  recipientOverrides?: string[];
  cc?: string[];
  bcc?: string[];
  templateId?: string;
  subject?: string;
  bodyHtml?: string;
}

interface SendDocumentEmailResponse {
  emailMessageId: string;
  queueStatus: string;
  recipientEmail: string;
}

interface UseSendDocumentEmailOptions {
  onSuccess?: () => void;
}

export function useSendDocumentEmail(options?: UseSendDocumentEmailOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SendDocumentEmailInput) => {
      const result = await apiPost<SendDocumentEmailResponse>('/documents/email', data);
      return result.data;
    },
    onSuccess: () => {
      toast.success('Email queued for delivery');
      void queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
      options?.onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send email');
    },
  });
}
