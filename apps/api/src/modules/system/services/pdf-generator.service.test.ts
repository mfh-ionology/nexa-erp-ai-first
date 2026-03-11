// ---------------------------------------------------------------------------
// Unit tests — PdfGeneratorService (E12-1 Task 3.6)
// Uses mocked Puppeteer to keep tests fast and isolated.
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, afterEach, vi, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Puppeteer before importing the service
// ---------------------------------------------------------------------------

const mockPagePdf = vi.fn();
const mockPageSetContent = vi.fn();
const mockPageSetDefaultTimeout = vi.fn();
const mockPageClose = vi.fn();

const mockPage = {
  pdf: mockPagePdf,
  setContent: mockPageSetContent,
  setDefaultTimeout: mockPageSetDefaultTimeout,
  close: mockPageClose,
};

const mockBrowserNewPage = vi.fn();
const mockBrowserClose = vi.fn();
const mockBrowserOn = vi.fn();

let mockBrowserConnected = true;

const mockBrowser = {
  newPage: mockBrowserNewPage,
  close: mockBrowserClose,
  on: mockBrowserOn,
  get connected() {
    return mockBrowserConnected;
  },
};

const mockLaunch = vi.fn();

vi.mock('puppeteer', () => ({
  default: {
    launch: (...args: unknown[]) => mockLaunch(...args),
  },
}));

import { PdfGeneratorService } from './pdf-generator.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// A minimal valid PDF header as a Uint8Array (simulating Puppeteer output)
const fakePdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfGeneratorService', () => {
  let service: PdfGeneratorService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrowserConnected = true;
    mockLaunch.mockResolvedValue(mockBrowser);
    mockBrowserNewPage.mockResolvedValue(mockPage);
    mockPagePdf.mockResolvedValue(fakePdfBytes);
    mockPageSetContent.mockResolvedValue(undefined);
    mockPageClose.mockResolvedValue(undefined);
    mockBrowserClose.mockResolvedValue(undefined);

    service = new PdfGeneratorService(mockLogger);
  });

  afterEach(async () => {
    try {
      await service.close();
    } catch {
      // ignore
    }
  });

  // -------------------------------------------------------------------------
  // Lifecycle: init / close
  // -------------------------------------------------------------------------

  describe('init()', () => {
    it('launches a Puppeteer browser with correct args', async () => {
      await service.init();

      expect(mockLaunch).toHaveBeenCalledOnce();
      expect(mockLaunch).toHaveBeenCalledWith({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    });

    it('does not re-launch browser if already initialised', async () => {
      await service.init();
      await service.init();

      expect(mockLaunch).toHaveBeenCalledOnce();
    });

    it('registers a disconnected event handler for crash recovery', async () => {
      await service.init();

      expect(mockBrowserOn).toHaveBeenCalledWith('disconnected', expect.any(Function));
    });
  });

  describe('close()', () => {
    it('closes the browser', async () => {
      await service.init();
      await service.close();

      expect(mockBrowserClose).toHaveBeenCalledOnce();
    });

    it('is safe to call when no browser is open', async () => {
      // Should not throw
      await service.close();
      expect(mockBrowserClose).not.toHaveBeenCalled();
    });

    it('handles browser already disconnected gracefully', async () => {
      await service.init();
      mockBrowserClose.mockRejectedValueOnce(new Error('Protocol error'));

      // Should not throw
      await service.close();
    });
  });

  // -------------------------------------------------------------------------
  // PDF generation
  // -------------------------------------------------------------------------

  describe('generatePdf()', () => {
    it('returns a Buffer that starts with %PDF', async () => {
      await service.init();
      const result = await service.generatePdf('<html><body>Hello</body></html>');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString('ascii', 0, 5)).toBe('%PDF-');
    });

    it('sets page content with networkidle0 and timeout', async () => {
      await service.init();
      const html = '<html><body>Test</body></html>';
      await service.generatePdf(html);

      expect(mockPageSetContent).toHaveBeenCalledWith(html, {
        waitUntil: 'networkidle0',
        timeout: 30_000,
      });
    });

    it('closes the page after generation', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>');

      expect(mockPageClose).toHaveBeenCalledOnce();
    });

    it('closes the page even when generation fails', async () => {
      await service.init();
      mockPagePdf.mockRejectedValueOnce(new Error('Render timeout'));

      await expect(service.generatePdf('<p>Test</p>')).rejects.toThrow('PDF generation error');
      expect(mockPageClose).toHaveBeenCalledOnce();
    });

    it('logs generation time', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ elapsed: expect.any(Number) }),
        'pdf-generator: PDF generated',
      );
    });

    it('auto-initialises browser if init() was not called', async () => {
      // Don't call init() — generatePdf should auto-launch
      const result = await service.generatePdf('<p>Auto init</p>');

      expect(mockLaunch).toHaveBeenCalledOnce();
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  // -------------------------------------------------------------------------
  // Page size options
  // -------------------------------------------------------------------------

  describe('page size options', () => {
    it('defaults to A4 portrait', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>');

      expect(mockPagePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'a4',
          landscape: false,
        }),
      );
    });

    it('maps A5 page size', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>', { pageSize: 'A5' });

      expect(mockPagePdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'a5' }));
    });

    it('maps Letter page size', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>', { pageSize: 'Letter' });

      expect(mockPagePdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'letter' }));
    });
  });

  // -------------------------------------------------------------------------
  // Orientation
  // -------------------------------------------------------------------------

  describe('orientation', () => {
    it('defaults to portrait (landscape: false)', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>');

      expect(mockPagePdf).toHaveBeenCalledWith(expect.objectContaining({ landscape: false }));
    });

    it('sets landscape: true for landscape orientation', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>', { orientation: 'landscape' });

      expect(mockPagePdf).toHaveBeenCalledWith(expect.objectContaining({ landscape: true }));
    });
  });

  // -------------------------------------------------------------------------
  // Custom margins
  // -------------------------------------------------------------------------

  describe('custom margins', () => {
    it('uses default margins (20mm top/bottom, 15mm left/right)', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>');

      expect(mockPagePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          margin: {
            top: '20mm',
            bottom: '20mm',
            left: '15mm',
            right: '15mm',
          },
        }),
      );
    });

    it('applies custom margins in mm', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>', {
        marginTop: 10,
        marginBottom: 10,
        marginLeft: 5,
        marginRight: 5,
      });

      expect(mockPagePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          margin: {
            top: '10mm',
            bottom: '10mm',
            left: '5mm',
            right: '5mm',
          },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Header/footer rendering
  // -------------------------------------------------------------------------

  describe('header and footer', () => {
    it('does not show header/footer by default', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>');

      const pdfCall = mockPagePdf.mock.calls[0]![0];
      expect(pdfCall.displayHeaderFooter).toBeFalsy();
    });

    it('shows header/footer when headerHtml is provided', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>', {
        headerHtml: '<div>My Header</div>',
      });

      expect(mockPagePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          displayHeaderFooter: true,
          headerTemplate: '<div>My Header</div>',
        }),
      );
    });

    it('uses default footer when footerHtml is not provided but displayHeaderFooter is true', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>', {
        displayHeaderFooter: true,
      });

      const pdfCall = mockPagePdf.mock.calls[0]![0];
      expect(pdfCall.displayHeaderFooter).toBe(true);
      expect(pdfCall.footerTemplate).toContain('pageNumber');
      expect(pdfCall.footerTemplate).toContain('totalPages');
    });

    it('uses custom footer when footerHtml is provided', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>', {
        footerHtml: '<div>Custom Footer</div>',
      });

      expect(mockPagePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          displayHeaderFooter: true,
          footerTemplate: '<div>Custom Footer</div>',
        }),
      );
    });

    it('provides empty header template when only footer is specified', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>', {
        footerHtml: '<div>Footer Only</div>',
      });

      expect(mockPagePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          headerTemplate: '<span></span>',
          footerTemplate: '<div>Footer Only</div>',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Timeout handling
  // -------------------------------------------------------------------------

  describe('timeout handling', () => {
    it('sets default page timeout to 30 seconds', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>');

      expect(mockPageSetDefaultTimeout).toHaveBeenCalledWith(30_000);
    });

    it('passes timeout to page.pdf()', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>');

      expect(mockPagePdf).toHaveBeenCalledWith(expect.objectContaining({ timeout: 30_000 }));
    });

    it('wraps setContent timeout errors in a descriptive message', async () => {
      await service.init();
      mockPageSetContent.mockRejectedValueOnce(
        new Error('Navigation timeout of 30000 ms exceeded'),
      );

      await expect(service.generatePdf('<p>Slow</p>')).rejects.toThrow(
        'PDF generation error: Navigation timeout of 30000 ms exceeded',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Browser crash recovery
  // -------------------------------------------------------------------------

  describe('browser crash recovery', () => {
    it('relaunches browser after disconnection', async () => {
      await service.init();
      expect(mockLaunch).toHaveBeenCalledOnce();

      // Simulate browser disconnection
      mockBrowserConnected = false;

      // Next generatePdf should relaunch
      await service.generatePdf('<p>After crash</p>');

      expect(mockLaunch).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'pdf-generator: Browser disconnected, relaunching',
      );
    });

    it('throws descriptive error when browser fails to launch', async () => {
      mockLaunch.mockRejectedValueOnce(new Error('Failed to launch chrome'));

      await expect(service.init()).rejects.toThrow(
        'PDF generator init failed: Failed to launch chrome',
      );
    });
  });

  // -------------------------------------------------------------------------
  // printBackground
  // -------------------------------------------------------------------------

  describe('printBackground', () => {
    it('always sets printBackground: true', async () => {
      await service.init();
      await service.generatePdf('<p>Test</p>');

      expect(mockPagePdf).toHaveBeenCalledWith(expect.objectContaining({ printBackground: true }));
    });
  });
});
