/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Email Template Preview Pane — renders template preview HTML.
 *
 * Shows rendered subject and body from the preview API endpoint.
 * Handlebars errors are displayed as an error message (no crash).
 */

import { AlertCircle, Mail } from 'lucide-react';

import { useI18n } from '@nexa/i18n';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface EmailTemplatePreviewPaneProps {
  subject: string | null;
  bodyHtml: string | null;
  error: string | null;
  isLoading: boolean;
}

export function EmailTemplatePreviewPane({
  subject,
  bodyHtml,
  error,
  isLoading,
}: EmailTemplatePreviewPaneProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Mail className="size-4 text-[#7c3aed]" />
          {t('emailTemplates.preview.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">{t('emailTemplates.preview.error')}</p>
              <p className="mt-1 font-mono text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Empty state (new template or no content) */}
        {!isLoading && !error && !bodyHtml && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('emailTemplates.preview.noPreview')}
          </div>
        )}

        {/* Preview content */}
        {!isLoading && !error && bodyHtml && (
          <div className="space-y-3">
            {/* Subject preview */}
            {subject && (
              <div className="rounded-md border bg-muted/50 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('emailTemplates.preview.subject')}
                </p>
                <p className="text-sm font-medium">{subject}</p>
              </div>
            )}

            {/* Body HTML preview — rendered in sandboxed iframe for XSS safety */}
            <iframe
              srcDoc={bodyHtml}
              sandbox=""
              title={t('emailTemplates.preview.title')}
              className="w-full rounded-lg border bg-white"
              style={{ minHeight: 200, border: 'none' }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
