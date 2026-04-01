import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';
import type { FastifyReply } from 'fastify';

import type { ExportFormat } from './export.schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: 'number' | 'currency' | 'date' | 'percentage';
}

// ---------------------------------------------------------------------------
// CSV Generator
// ---------------------------------------------------------------------------

export function generateCsv(columns: ExportColumn[], rows: Record<string, unknown>[]): Buffer {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) => columns.map((c) => row[c.key] ?? ''));
  return Buffer.from(stringify([headers, ...data]));
}

// ---------------------------------------------------------------------------
// Excel Generator
// ---------------------------------------------------------------------------

export async function generateExcel(
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 15,
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E0FF' }, // Light purple matching Concept D
  };

  for (const row of rows) {
    sheet.addRow(row);
  }

  // Format currency/percentage columns
  for (const col of columns) {
    if (col.format === 'currency') {
      const excelCol = sheet.getColumn(col.key);
      excelCol.numFmt = '#,##0.00';
    } else if (col.format === 'percentage') {
      const excelCol = sheet.getColumn(col.key);
      excelCol.numFmt = '0.00%';
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// Content-Type / Extension mappings
// ---------------------------------------------------------------------------

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const FILE_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  excel: 'xlsx',
};

// ---------------------------------------------------------------------------
// Fastify Reply Helper
// ---------------------------------------------------------------------------

export async function sendExportFile(
  reply: FastifyReply,
  format: ExportFormat,
  filename: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
): Promise<void> {
  const ext = FILE_EXTENSIONS[format];
  const fullFilename = `${filename}-${new Date().toISOString().slice(0, 10)}.${ext}`;

  const buffer =
    format === 'csv' ? generateCsv(columns, rows) : await generateExcel(sheetName, columns, rows);

  void reply
    .header('Content-Type', CONTENT_TYPES[format])
    .header('Content-Disposition', `attachment; filename="${fullFilename}"`)
    .send(buffer);
}
