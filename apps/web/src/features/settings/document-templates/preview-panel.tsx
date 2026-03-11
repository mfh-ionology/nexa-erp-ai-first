/* eslint-disable i18next/no-literal-string */
/**
 * Preview Panel — generates and displays a PDF preview for a document template.
 *
 * AC9: Template Management UI — Preview Panel
 * - "Generate Preview" button
 * - Loading state with spinner while PDF generates
 * - On success: display PDF in <iframe> with URL.createObjectURL(blob)
 * - Controls: Download, Open in New Tab, Print
 * - Error state: red error message with "Retry" button
 * - Clean up blob URL on unmount via useEffect cleanup
 * - Concept D visual fidelity
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  Printer,
  RefreshCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import { usePreviewTemplate } from './api';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface PreviewPanelProps {
  templateId: string;
  /** Optional version ID to preview a specific version's overrides */
  versionId?: string;
  /** Document type used in the filename */
  documentType?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function PreviewPanel({ templateId, versionId, documentType }: PreviewPanelProps) {
  const previewMutation = usePreviewTemplate();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Clean up blob URL on unmount only
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const generatePreview = useCallback(() => {
    // Revoke previous blob URL via ref (avoids stale closure)
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setBlobUrl(null);
    }

    previewMutation.mutate(
      { templateId, versionId },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setBlobUrl(url);
        },
      },
    );
  }, [templateId, versionId, previewMutation]);

  const handleDownload = useCallback(() => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    const typeSuffix = documentType ? `-${documentType.toLowerCase().replace(/_/g, '-')}` : '';
    a.download = `preview${typeSuffix}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [blobUrl, documentType]);

  const handleOpenNewTab = useCallback(() => {
    if (!blobUrl) return;
    window.open(blobUrl, '_blank');
  }, [blobUrl]);

  const handlePrint = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.print();
  }, []);

  const hasError = previewMutation.isError;
  const isLoading = previewMutation.isPending;
  const hasPreview = !!blobUrl && !isLoading && !hasError;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Preview</h3>
        <Button
          size="sm"
          variant={hasPreview ? 'outline' : 'default'}
          className={hasPreview ? 'gap-1.5' : 'gap-1.5 bg-[#7c3aed] hover:bg-[#5b21b6]'}
          onClick={generatePreview}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : hasPreview ? (
            <RefreshCw className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
          {isLoading ? 'Generating...' : hasPreview ? 'Regenerate' : 'Generate Preview'}
        </Button>
      </div>

      {/* Initial state — no preview generated yet */}
      {!blobUrl && !isLoading && !hasError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
          <Eye className="mb-2 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Click &quot;Generate Preview&quot; to see a PDF preview with sample data.
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border p-12 text-center">
          <Loader2 className="mb-3 size-8 animate-spin text-[#7c3aed]" />
          <p className="text-sm text-muted-foreground">Generating PDF preview...</p>
        </div>
      )}

      {/* Error state */}
      {hasError && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 size-8 text-red-500" />
          <p className="mb-3 text-sm font-medium text-red-700">
            {previewMutation.error?.message || 'Failed to generate preview'}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100"
            onClick={generatePreview}
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* PDF Preview */}
      {hasPreview && (
        <div className="animate-fade-in-up space-y-3">
          {/* PDF iframe */}
          <div className="overflow-hidden rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <iframe
              ref={iframeRef}
              src={blobUrl}
              className="h-[500px] w-full border-0 sm:h-[600px] lg:h-[700px]"
              title="PDF Preview"
            />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownload}>
              <Download className="size-3.5" />
              Download
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleOpenNewTab}>
              <ExternalLink className="size-3.5" />
              Open in New Tab
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePrint}>
              <Printer className="size-3.5" />
              Print
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
