// ---------------------------------------------------------------------------
// Seed verification tests — E10-2 Task 8.4
// Verifies that all 7 default email templates compile and render successfully.
// Uses the ACTUAL seed template HTML bodies to catch field mismatches.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';
import {
  EmailTemplateEngineService,
  SUPPORTED_DOCUMENT_TYPES,
} from './email-template-engine.service.js';
import { getSampleData } from './email-template-sample-data.js';
import { templates as SEED_TEMPLATES } from '@nexa/db/prisma/seeds/email-template-seed.js';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Email template seed verification', () => {
  it('has exactly 7 default templates covering all document types', () => {
    expect(SEED_TEMPLATES).toHaveLength(7);

    const docTypes = SEED_TEMPLATES.map((t) => t.documentType);
    for (const supported of SUPPORTED_DOCUMENT_TYPES) {
      expect(docTypes).toContain(supported);
    }
  });

  it('all 7 subject templates compile without errors', () => {
    const engine = new EmailTemplateEngineService(mockLogger);

    for (const t of SEED_TEMPLATES) {
      const result = engine.validateTemplate(t.subjectTemplate, t.bodyHtml, t.documentType);
      expect(
        result.valid,
        `Template ${t.code} validation failed: ${result.errors.join('; ')}`,
      ).toBe(true);
    }
  });

  it('all 7 actual seed HTML templates render with sample data without errors', () => {
    const engine = new EmailTemplateEngineService(mockLogger);

    for (const t of SEED_TEMPLATES) {
      const sampleData = getSampleData(t.documentType);
      expect(Object.keys(sampleData).length).toBeGreaterThan(0);

      const template = {
        id: `seed-${t.code}`,
        code: t.code,
        name: t.code,
        description: null,
        documentType: t.documentType,
        subjectTemplate: t.subjectTemplate,
        bodyHtmlTemplate: t.bodyHtml,
        bodyTextTemplate: t.bodyText,
        openingTextCode: null,
        closingTextCode: null,
        languageCode: 'en',
        attachPdf: true,
        autoSend: false,
        isActive: true,
        createdBy: 'seed',
        updatedBy: 'seed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const compiled = engine.compileTemplate(template as any);
      const subject = compiled.renderSubject(sampleData);
      const bodyHtml = compiled.renderBody(sampleData);

      expect(subject.length, `${t.code} subject is empty`).toBeGreaterThan(0);
      expect(bodyHtml.length, `${t.code} bodyHtml is empty`).toBeGreaterThan(0);
      // Should not contain unresolved Handlebars expressions
      expect(subject).not.toContain('{{');
      expect(bodyHtml).not.toContain('{{');

      // Also verify plain text template renders
      if (t.bodyText) {
        const textTemplate = {
          ...template,
          bodyHtmlTemplate: t.bodyText,
        };
        const compiledText = engine.compileTemplate(textTemplate as any);
        const bodyText = compiledText.renderBody(sampleData);
        expect(bodyText).not.toContain('{{');
      }
    }
  });

  it('sample data exists for all 7 document types', () => {
    for (const docType of SUPPORTED_DOCUMENT_TYPES) {
      const data = getSampleData(docType);
      expect(Object.keys(data).length).toBeGreaterThan(0);
    }
  });
});
