// ---------------------------------------------------------------------------
// PDF Generator Service — E12-1 Task 3
// Puppeteer-based HTML-to-PDF rendering with browser pooling.
// ---------------------------------------------------------------------------

import puppeteer, { type Browser, type PDFOptions } from 'puppeteer';
import type { Logger } from 'pino';

export interface PdfOptions {
  pageSize?: 'A4' | 'A5' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  headerHtml?: string;
  footerHtml?: string;
  displayHeaderFooter?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_TIMEOUT_MS = 30_000;

const DEFAULT_FOOTER_HTML =
  '<div style="font-size:8px;text-align:center;width:100%">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>';

const PAGE_SIZE_MAP: Record<string, string> = {
  A4: 'a4',
  A5: 'a5',
  Letter: 'letter',
};

// ---------------------------------------------------------------------------
// PdfGeneratorService
// ---------------------------------------------------------------------------

export class PdfGeneratorService {
  private browser: Browser | null = null;
  private launchPromise: Promise<Browser> | null = null;

  constructor(private readonly logger: Logger) {}

  // -------------------------------------------------------------------------
  // Lifecycle — init / close (Task 3.3)
  // -------------------------------------------------------------------------

  /**
   * Launch a single Puppeteer browser instance.
   * Called once at Fastify `onReady`.
   */
  async init(): Promise<void> {
    if (this.browser) return;
    await this.launchBrowser();
  }

  /**
   * Close the browser instance.
   * Called at Fastify `onClose`.
   */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Browser may already be disconnected — ignore
      }
      this.browser = null;
    }
  }

  // -------------------------------------------------------------------------
  // PDF generation (Task 3.4)
  // -------------------------------------------------------------------------

  /**
   * Render HTML content to a PDF buffer.
   *
   * @param html    - Fully compiled HTML string (with inline CSS)
   * @param options - Page size, orientation, margins, header/footer
   * @returns PDF as a Buffer
   */
  async generatePdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
    const start = performance.now();
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set a page-level timeout to prevent infinite rendering (Task 3.5)
      page.setDefaultTimeout(PAGE_TIMEOUT_MS);

      // Load HTML content — wait for fonts/images to settle
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: PAGE_TIMEOUT_MS });

      // Build Puppeteer PDF options
      const pdfOptions = this.buildPdfOptions(options);

      // Generate PDF
      const pdfBuffer = await page.pdf(pdfOptions);

      const elapsed = Math.round(performance.now() - start);
      this.logger.info({ elapsed }, 'pdf-generator: PDF generated');

      // Puppeteer returns Uint8Array — convert to Buffer
      return Buffer.from(pdfBuffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ error: message }, 'pdf-generator: PDF generation failed');
      throw new Error(`PDF generation error: ${message}`);
    } finally {
      // Always close the page to prevent leaks (Task 3.5)
      try {
        await page.close();
      } catch {
        // Page may already be closed/crashed — ignore
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Get the browser instance, relaunching if it was disconnected (crash recovery — Task 3.3).
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // Browser crashed or was never started — relaunch
    if (this.browser) {
      this.logger.warn('pdf-generator: Browser disconnected, relaunching');
      this.browser = null;
    }

    return this.launchBrowser();
  }

  /**
   * Launch a new Puppeteer browser (with serialisation to prevent duplicate launches).
   */
  private async launchBrowser(): Promise<Browser> {
    // If a launch is already in flight, await the same promise
    if (this.launchPromise) {
      return this.launchPromise;
    }

    this.launchPromise = (async () => {
      try {
        this.browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        // Listen for unexpected disconnection (crash recovery)
        this.browser.on('disconnected', () => {
          this.logger.warn('pdf-generator: Browser process disconnected unexpectedly');
          this.browser = null;
        });

        this.logger.info('pdf-generator: Browser launched');
        return this.browser;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error({ error: message }, 'pdf-generator: Failed to launch browser');
        throw new Error(`PDF generator init failed: ${message}`);
      } finally {
        this.launchPromise = null;
      }
    })();

    return this.launchPromise;
  }

  /**
   * Map PdfOptions to Puppeteer's PDFOptions format (Task 3.4).
   */
  private buildPdfOptions(options: PdfOptions): PDFOptions {
    const {
      pageSize = 'A4',
      orientation = 'portrait',
      marginTop = 20,
      marginBottom = 20,
      marginLeft = 15,
      marginRight = 15,
      headerHtml,
      footerHtml,
      displayHeaderFooter,
    } = options;

    const showHeaderFooter = displayHeaderFooter ?? !!(headerHtml || footerHtml);

    const pdfOpts: PDFOptions = {
      format: (PAGE_SIZE_MAP[pageSize] ?? 'a4') as PDFOptions['format'],
      landscape: orientation === 'landscape',
      margin: {
        top: `${marginTop}mm`,
        bottom: `${marginBottom}mm`,
        left: `${marginLeft}mm`,
        right: `${marginRight}mm`,
      },
      printBackground: true,
      timeout: PAGE_TIMEOUT_MS,
    };

    if (showHeaderFooter) {
      pdfOpts.displayHeaderFooter = true;
      pdfOpts.headerTemplate = headerHtml ?? '<span></span>';
      pdfOpts.footerTemplate = footerHtml ?? DEFAULT_FOOTER_HTML;
    }

    return pdfOpts;
  }
}
