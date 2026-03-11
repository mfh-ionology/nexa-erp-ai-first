import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchPdfBlob, generateAndDownloadPdf, generateAndPrintPdf } from './pdf-actions';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock auth store
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      accessToken: 'test-token',
      activeCompanyId: 'company-123',
    })),
  },
}));

// Mock import.meta.env
vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:5100');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetchSuccess(blob: Blob) {
  return vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(blob),
  } as Partial<Response>);
}

function mockFetchError(status: number, body?: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body ?? ''),
  } as Partial<Response>);
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
}

const pdfBlob = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });

// ─── fetchPdfBlob ────────────────────────────────────────────────────────────

describe('fetchPdfBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchSuccess(pdfBlob));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls fetch with correct URL and method', async () => {
    await fetchPdfBlob('SALES_INVOICE', 'rec-1');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:5100/api/v1/system/documents/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          documentType: 'SALES_INVOICE',
          recordId: 'rec-1',
          outputFormat: 'attachment',
        }),
      }),
    );
  });

  it('includes Authorization and X-Company-Id headers', async () => {
    await fetchPdfBlob('SALES_INVOICE', 'rec-1');

    const callArgs = vi.mocked(fetch).mock.calls[0]![1]!;
    const headers = callArgs.headers as Record<string, string>;

    expect(headers['Authorization']).toBe('Bearer test-token');
    expect(headers['X-Company-Id']).toBe('company-123');
    expect(headers['Accept']).toBe('application/pdf');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('returns a Blob on success', async () => {
    const result = await fetchPdfBlob('SALES_INVOICE', 'rec-1');
    expect(result).toBeInstanceOf(Blob);
  });

  it('throws on HTTP 404 with default message', async () => {
    vi.stubGlobal('fetch', mockFetchError(404));
    await expect(fetchPdfBlob('SALES_INVOICE', 'rec-1')).rejects.toThrow(
      'PDF generation failed (HTTP 404)',
    );
  });

  it('throws on HTTP 500 with server error message if JSON', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchError(500, JSON.stringify({ error: { message: 'Server boom' } })),
    );
    await expect(fetchPdfBlob('SALES_INVOICE', 'rec-1')).rejects.toThrow('Server boom');
  });

  it('throws on HTTP 500 with default message if non-JSON body', async () => {
    vi.stubGlobal('fetch', mockFetchError(500, 'Internal Server Error'));
    await expect(fetchPdfBlob('SALES_INVOICE', 'rec-1')).rejects.toThrow(
      'PDF generation failed (HTTP 500)',
    );
  });

  it('throws on network failure', async () => {
    vi.stubGlobal('fetch', mockFetchNetworkError());
    await expect(fetchPdfBlob('SALES_INVOICE', 'rec-1')).rejects.toThrow('Failed to fetch');
  });
});

// ─── generateAndDownloadPdf ──────────────────────────────────────────────────

describe('generateAndDownloadPdf', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchSuccess(pdfBlob));

    clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: clickSpy,
          style: {},
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockReturnValue(null as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(null as unknown as Node);

    createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:http://localhost/fake-pdf');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a download link and clicks it', async () => {
    await generateAndDownloadPdf('SALES_INVOICE', 'rec-1');

    expect(createObjectURLSpy).toHaveBeenCalledWith(pdfBlob);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('sets correct download filename', async () => {
    const anchors: Array<{ download: string }> = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = {
          href: '',
          download: '',
          click: vi.fn(),
          style: {},
        };
        anchors.push(anchor);
        return anchor as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    await generateAndDownloadPdf('PURCHASE_ORDER', 'po-42');

    expect(anchors[0]!.download).toBe('purchase-order-po-42.pdf');
  });

  it('revokes blob URL after download', async () => {
    await generateAndDownloadPdf('SALES_INVOICE', 'rec-1');

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/fake-pdf');
  });

  it('revokes blob URL even if click throws', async () => {
    clickSpy.mockImplementation(() => {
      throw new Error('click failed');
    });

    await expect(generateAndDownloadPdf('SALES_INVOICE', 'rec-1')).rejects.toThrow('click failed');
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/fake-pdf');
  });
});

// ─── generateAndPrintPdf ─────────────────────────────────────────────────────

describe('generateAndPrintPdf', () => {
  let printSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchSuccess(pdfBlob));
    vi.useFakeTimers();

    printSpy = vi.fn();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/fake-pdf');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates a hidden iframe and calls print() on load', async () => {
    let capturedOnload: (() => void) | null = null;
    let capturedOnafterprint: (() => void) | null = null;

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'iframe') {
        const iframe = {
          style: {} as CSSStyleDeclaration,
          src: '',
          parentNode: document.body,
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          contentWindow: {
            print: printSpy,
            set onafterprint(fn: (() => void) | null) {
              capturedOnafterprint = fn;
            },
            get onafterprint() {
              return capturedOnafterprint;
            },
          },
        };

        // Capture onload setter to trigger it manually
        const proxy = new Proxy(iframe, {
          set(target, prop, value) {
            if (prop === 'onload') {
              capturedOnload = value as (() => void) | null;
            }
            if (prop === 'src') {
              // Simulate async load
              queueMicrotask(() => {
                capturedOnload?.();
              });
            }
            (target as Record<string, unknown>)[prop as string] = value;
            return true;
          },
        });

        return proxy as unknown as HTMLIFrameElement;
      }
      return document.createElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockReturnValue(null as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(null as unknown as Node);

    const printPromise = generateAndPrintPdf('SALES_INVOICE', 'rec-1');

    // Let microtasks run (iframe onload) — Promise resolves immediately after print()
    await vi.advanceTimersByTimeAsync(0);
    await printPromise;

    expect(printSpy).toHaveBeenCalledOnce();

    // Simulate afterprint — triggers cleanup (blob URL revocation)
    (capturedOnafterprint as (() => void) | null)?.();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/fake-pdf');
  });

  it('falls back to download when contentWindow is null', async () => {
    let capturedOnload: (() => void) | null = null;
    const downloadClickSpy = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'iframe') {
        const iframe = {
          style: {} as CSSStyleDeclaration,
          src: '',
          parentNode: document.body,
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          contentWindow: null,
        };

        const proxy = new Proxy(iframe, {
          set(target, prop, value) {
            if (prop === 'onload') {
              capturedOnload = value as (() => void) | null;
            }
            if (prop === 'src') {
              queueMicrotask(() => {
                capturedOnload?.();
              });
            }
            (target as Record<string, unknown>)[prop as string] = value;
            return true;
          },
        });

        return proxy as unknown as HTMLIFrameElement;
      }
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: downloadClickSpy,
          style: {},
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockReturnValue(null as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(null as unknown as Node);

    const printPromise = generateAndPrintPdf('SALES_INVOICE', 'rec-1');
    await vi.advanceTimersByTimeAsync(0);
    await printPromise;

    // Should have fallen back to download
    expect(downloadClickSpy).toHaveBeenCalledOnce();
    expect(printSpy).not.toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
  });

  it('cleans up via timeout fallback when afterprint does not fire', async () => {
    let capturedOnload: (() => void) | null = null;

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'iframe') {
        const iframe = {
          style: {} as CSSStyleDeclaration,
          src: '',
          parentNode: document.body,
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          contentWindow: {
            print: printSpy,
            onafterprint: null as (() => void) | null,
          },
        };

        const proxy = new Proxy(iframe, {
          set(target, prop, value) {
            if (prop === 'onload') {
              capturedOnload = value as (() => void) | null;
            }
            if (prop === 'src') {
              queueMicrotask(() => {
                capturedOnload?.();
              });
            }
            (target as Record<string, unknown>)[prop as string] = value;
            return true;
          },
        });

        return proxy as unknown as HTMLIFrameElement;
      }
      return document.createElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockReturnValue(null as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(null as unknown as Node);

    const printPromise = generateAndPrintPdf('SALES_INVOICE', 'rec-1');

    // Let onload fire — Promise resolves immediately after print()
    await vi.advanceTimersByTimeAsync(0);
    await printPromise;

    expect(printSpy).toHaveBeenCalledOnce();

    // Blob URL not yet revoked (afterprint hasn't fired)
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();

    // Advance to the 5s timeout fallback — triggers cleanup
    await vi.advanceTimersByTimeAsync(5_000);
    expect(revokeObjectURLSpy).toHaveBeenCalled();
  });

  it('falls back to download when iframe onerror fires', async () => {
    let capturedOnerror: (() => void) | null = null;
    const downloadClickSpy = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'iframe') {
        const iframe = {
          style: {} as CSSStyleDeclaration,
          src: '',
          parentNode: document.body,
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          contentWindow: null,
        };

        const proxy = new Proxy(iframe, {
          set(target, prop, value) {
            if (prop === 'onerror') {
              capturedOnerror = value as (() => void) | null;
            }
            if (prop === 'src') {
              queueMicrotask(() => {
                capturedOnerror?.();
              });
            }
            (target as Record<string, unknown>)[prop as string] = value;
            return true;
          },
        });

        return proxy as unknown as HTMLIFrameElement;
      }
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: downloadClickSpy,
          style: {},
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockReturnValue(null as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockReturnValue(null as unknown as Node);

    const printPromise = generateAndPrintPdf('DELIVERY_NOTE', 'dn-5');
    await vi.advanceTimersByTimeAsync(0);
    await printPromise;

    expect(downloadClickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
  });
});
