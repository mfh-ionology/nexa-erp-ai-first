import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (SYSTEM intentionally excluded from create — AC #4)
// ---------------------------------------------------------------------------

// Rejects content containing dangerous HTML: <script>, <iframe>, <embed>,
// <object>, <svg>, <math>, <img (with event handlers), and on* event attributes.
const DANGEROUS_HTML_RE = /<(script|iframe|embed|object|svg|math|link|meta|base)[\s>]/i;
const EVENT_HANDLER_RE = /\bon\w+\s*=/i;

const rejectDangerousHtml = (val: string) =>
  !DANGEROUS_HTML_RE.test(val) && !EVENT_HANDLER_RE.test(val);
const dangerousHtmlMessage =
  'Content must not contain HTML tags or event handlers that could execute scripts';

const createNoteTypeEnum = z.enum(['GENERAL', 'INTERNAL', 'CUSTOMER_VISIBLE']);
const noteTypeFilterEnum = z.enum(['GENERAL', 'INTERNAL', 'CUSTOMER_VISIBLE', 'SYSTEM']);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createNoteSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.uuid(),
  noteType: createNoteTypeEnum.optional().default('GENERAL'),
  content: z
    .string()
    .min(1)
    .max(50000)
    .refine(rejectDangerousHtml, { message: dangerousHtmlMessage }),
  title: z.string().max(200).optional(),
  classification: z.string().max(60).optional(),
});

export const updateNoteSchema = z
  .object({
    content: z
      .string()
      .min(1)
      .max(50000)
      .refine(rejectDangerousHtml, { message: dangerousHtmlMessage })
      .optional(),
    title: z.string().max(200).optional(),
    classification: z.string().max(60).optional(),
  })
  .refine(
    (data) =>
      data.content !== undefined || data.title !== undefined || data.classification !== undefined,
    { message: 'At least one field (content, title, or classification) is required' },
  );

export const noteListQuerySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.uuid(),
  noteType: noteTypeFilterEnum.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export const noteParamsSchema = z.object({
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const noteResponseSchema = z.object({
  id: z.uuid(),
  entityType: z.string(),
  entityId: z.string(),
  noteType: noteTypeFilterEnum,
  classification: z.string().nullable(),
  title: z.string().nullable(),
  content: z.string(),
  isPinned: z.boolean(),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
});

export const noteListResponseSchema = z.object({
  items: z.array(noteResponseSchema),
  total: z.number().int(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteListQuery = z.infer<typeof noteListQuerySchema>;
export type NoteParams = z.infer<typeof noteParamsSchema>;
