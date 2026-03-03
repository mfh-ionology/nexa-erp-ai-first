import { describe, expect, it } from 'vitest';

import { isAllowedMimeType, isBlockedExtension } from './mime-allowlist.js';

describe('isAllowedMimeType', () => {
  it.each([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/tiff',
    'image/bmp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'text/csv',
    'text/plain',
    'application/zip',
    'application/gzip',
    'application/x-gzip',
  ])('allows %s', (mime) => {
    expect(isAllowedMimeType(mime)).toBe(true);
  });

  it.each([
    'application/x-msdownload',
    'application/x-executable',
    'application/octet-stream',
    'application/javascript',
    'text/html',
    'video/mp4',
    'audio/mpeg',
    '',
  ])('rejects %s', (mime) => {
    expect(isAllowedMimeType(mime)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isAllowedMimeType('APPLICATION/PDF')).toBe(true);
    expect(isAllowedMimeType('Image/JPEG')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(isAllowedMimeType('  application/pdf  ')).toBe(true);
  });

  it('strips MIME parameters before matching (FIX #5)', () => {
    expect(isAllowedMimeType('text/plain; charset=utf-8')).toBe(true);
    expect(isAllowedMimeType('image/jpeg; name="photo.jpg"')).toBe(true);
    expect(isAllowedMimeType('application/pdf; charset=binary')).toBe(true);
  });

  it('rejects parameterized MIME types with disallowed base type', () => {
    expect(isAllowedMimeType('application/x-msdownload; charset=binary')).toBe(false);
    expect(isAllowedMimeType('text/html; charset=utf-8')).toBe(false);
  });
});

describe('isBlockedExtension', () => {
  it.each([
    '.exe',
    '.bat',
    '.sh',
    '.cmd',
    '.ps1',
    '.msi',
    '.scr',
    '.com',
    '.pif',
    '.vbs',
    '.js',
    '.jar',
  ])('blocks %s extension', (ext) => {
    expect(isBlockedExtension(`malware${ext}`)).toBe(true);
  });

  it.each(['.pdf', '.jpg', '.png', '.docx', '.xlsx', '.csv', '.txt', '.zip'])(
    'allows %s extension',
    (ext) => {
      expect(isBlockedExtension(`document${ext}`)).toBe(false);
    },
  );

  it('is case-insensitive for extensions', () => {
    expect(isBlockedExtension('file.EXE')).toBe(true);
    expect(isBlockedExtension('file.Bat')).toBe(true);
    expect(isBlockedExtension('file.PS1')).toBe(true);
  });

  it('returns false for files without an extension', () => {
    expect(isBlockedExtension('README')).toBe(false);
    expect(isBlockedExtension('Makefile')).toBe(false);
  });

  it('checks the last extension for double extensions', () => {
    expect(isBlockedExtension('report.pdf.exe')).toBe(true);
    expect(isBlockedExtension('script.exe.pdf')).toBe(false);
  });
});
