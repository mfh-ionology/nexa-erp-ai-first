import { z } from 'zod';

export const EXPORT_FORMATS = ['csv', 'excel'] as const;

export const exportQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS).default('csv'),
});

export type ExportFormat = (typeof EXPORT_FORMATS)[number];
