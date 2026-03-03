// ---------------------------------------------------------------------------
// MIME Type Allowlist — BR-SYS-007
// ---------------------------------------------------------------------------
// Allowed: PDF, images, Office documents, CSV, plain text, ZIP/GZIP
// Blocked: all executables by MIME type and file extension
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
  // PDF
  'application/pdf',

  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/tiff',
  'image/bmp',

  // Office — modern (OOXML)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx

  // Office — legacy
  'application/msword', // .doc
  'application/vnd.ms-excel', // .xls
  'application/vnd.ms-powerpoint', // .ppt

  // CSV / plain text
  'text/csv',
  'text/plain',

  // Archives
  'application/zip',
  'application/gzip',
  'application/x-gzip',
]);

const BLOCKED_EXTENSIONS = new Set([
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
]);

/**
 * Returns true if the MIME type is in the allowlist.
 */
export function isAllowedMimeType(mimeType: string): boolean {
  // Strip MIME parameters (e.g., "text/plain; charset=utf-8" → "text/plain")
  const baseMime = mimeType.split(';')[0]!.toLowerCase().trim();
  return ALLOWED_MIME_TYPES.has(baseMime);
}

/**
 * Returns true if the file extension is blocked (executable).
 */
export function isBlockedExtension(fileName: string): boolean {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = fileName.slice(dotIndex).toLowerCase();
  return BLOCKED_EXTENSIONS.has(ext);
}
