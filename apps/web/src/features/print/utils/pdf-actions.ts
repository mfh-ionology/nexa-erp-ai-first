/**
 * Browser-side utilities for triggering PDF download and print dialog.
 *
 * Uses raw fetch (not apiGet/apiPost) because the PDF generation endpoint
 * returns binary data, and the shared ApiClient always JSON-parses.
 * Auth pattern follows usePreviewTemplate() in document-templates/api.ts.
 */

import { useAuthStore } from '@/stores/auth-store';

import type { DocumentType } from '../api/use-print-preferences';

// ─── Internal: Raw PDF Fetch ─────────────────────────────────────────────────

/**
 * Fetch a PDF blob from the document generation endpoint.
 *
 * Uses raw `fetch` with manual auth header injection (same pattern as
 * usePreviewTemplate in document-templates/api.ts:432-487).
 *
 * @throws Error on non-OK HTTP responses
 */
export async function fetchPdfBlob(documentType: DocumentType, recordId: string): Promise<Blob> {
  const { accessToken, activeCompanyId } = useAuthStore.getState();

  const headers: Record<string, string> = {
    Accept: 'application/pdf',
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  if (activeCompanyId) {
    headers['X-Company-Id'] = activeCompanyId;
  }

  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  const response = await fetch(`${baseUrl}/api/v1/system/documents/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      documentType,
      recordId,
      outputFormat: 'attachment',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `PDF generation failed (HTTP ${String(response.status)})`;
    try {
      const json = JSON.parse(text) as { error?: { message?: string } };
      if (json.error?.message) {
        message = json.error.message;
      }
    } catch {
      // Non-JSON error response — use default message
    }
    throw new Error(message);
  }

  return response.blob();
}

// ─── Download ────────────────────────────────────────────────────────────────

/**
 * Generate a PDF for the given document and trigger a browser file download.
 *
 * Creates a temporary `<a download>` element, clicks it, then revokes the
 * blob URL to prevent memory leaks.
 */
export async function generateAndDownloadPdf(
  documentType: DocumentType,
  recordId: string,
): Promise<void> {
  const blob = await fetchPdfBlob(documentType, recordId);
  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentType.toLowerCase().replace(/_/g, '-')}-${recordId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── Print ───────────────────────────────────────────────────────────────────

/**
 * Generate a PDF for the given document and open the browser print dialog.
 *
 * Creates a hidden `<iframe>`, loads the PDF blob URL, then calls
 * `iframe.contentWindow.print()` once loaded. Falls back to download if
 * the print dialog cannot be triggered (e.g. popup blockers, missing
 * contentWindow).
 *
 * Cleans up the iframe and blob URL after the print dialog closes.
 */
export async function generateAndPrintPdf(
  documentType: DocumentType,
  recordId: string,
): Promise<void> {
  const blob = await fetchPdfBlob(documentType, recordId);
  const url = URL.createObjectURL(blob);

  return new Promise<void>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      URL.revokeObjectURL(url);
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    iframe.onload = () => {
      try {
        if (iframe.contentWindow) {
          // Listen for afterprint to clean up resources
          iframe.contentWindow.onafterprint = cleanup;
          iframe.contentWindow.print();

          // Resolve immediately after print() — the dialog is shown, don't block the caller.
          // Cleanup of iframe/blob URL happens asynchronously via afterprint or fallback timeout.
          resolve();

          // Fallback timeout — some browsers don't fire afterprint reliably (5s is sufficient)
          setTimeout(cleanup, 5_000);
        } else {
          // contentWindow unavailable — fall back to download
          fallbackToDownload(blob, documentType, recordId);
          cleanup();
          resolve();
        }
      } catch {
        // print() blocked (e.g. cross-origin, popup blocker) — fall back to download
        fallbackToDownload(blob, documentType, recordId);
        cleanup();
        resolve();
      }
    };

    iframe.onerror = () => {
      // iframe failed to load — fall back to download
      fallbackToDownload(blob, documentType, recordId);
      cleanup();
      resolve();
    };

    iframe.src = url;
  });
}

// ─── Fallback ────────────────────────────────────────────────────────────────

/**
 * Fallback: trigger a download when print dialog cannot be opened.
 * Creates its own blob URL from the blob to avoid race conditions
 * with the caller's cleanup revoking the URL before the download starts.
 */
function fallbackToDownload(blob: Blob, documentType: DocumentType, recordId: string): void {
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${documentType.toLowerCase().replace(/_/g, '-')}-${recordId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revocation to let browser begin the download
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 150);
}
