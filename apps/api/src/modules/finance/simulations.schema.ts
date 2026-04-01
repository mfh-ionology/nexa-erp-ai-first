import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants (matching Prisma-generated SimulationStatus)
// ---------------------------------------------------------------------------

export const SIMULATION_STATUSES = ['ACTIVE', 'TRANSFERRED', 'INVALID'] as const;

// ---------------------------------------------------------------------------
// Shared line schemas
// ---------------------------------------------------------------------------

const simulationLineDimensionInputSchema = z.object({
  dimensionTypeId: z.uuid(),
  dimensionValueId: z.uuid(),
});

const simulationLineInputSchema = z.object({
  accountCode: z.string().min(1).max(20),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().max(500).optional(),
  vatCode: z.string().max(20).optional(),
  dimensionValues: z.array(simulationLineDimensionInputSchema).optional(),
});

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createSimulationSchema = z.object({
  transactionDate: z.coerce.date(),
  description: z.string().min(1, 'Description is required').max(500),
  reference: z.string().max(100).optional(),
  periodId: z.uuid(),
  lines: z.array(simulationLineInputSchema).min(2, 'At least two lines required'),
});

export const updateSimulationSchema = z
  .object({
    transactionDate: z.coerce.date().optional(),
    description: z.string().min(1).max(500).optional(),
    reference: z.string().max(100).nullable().optional(),
    periodId: z.uuid().optional(),
    lines: z.array(simulationLineInputSchema).min(2).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

export const simulationParamsSchema = z.object({
  id: z.uuid(),
});

export const listSimulationsQuerySchema = z.object({
  status: z.enum(SIMULATION_STATUSES).optional(),
  periodId: z.uuid().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const simulationLineResponseSchema = z.object({
  id: z.string(),
  lineNumber: z.number(),
  accountCode: z.string(),
  accountName: z.string().nullable(),
  description: z.string().nullable(),
  debit: z.number(),
  credit: z.number(),
  vatCode: z.string().nullable(),
  dimensionValues: z.any().nullable(), // JSON array [{dimensionTypeId, dimensionValueId}]
});

export const simulationListItemSchema = z.object({
  id: z.uuid(),
  entryNumber: z.string(),
  transactionDate: z.string(),
  description: z.string(),
  reference: z.string().nullable(),
  status: z.enum(SIMULATION_STATUSES),
  periodId: z.string(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  transferredToId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
});

export const simulationDetailSchema = simulationListItemSchema.extend({
  lines: z.array(simulationLineResponseSchema),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateSimulationInput = z.infer<typeof createSimulationSchema>;
export type UpdateSimulationInput = z.infer<typeof updateSimulationSchema>;
export type ListSimulationsQuery = z.infer<typeof listSimulationsQuerySchema>;
export type SimulationLineInput = z.infer<typeof simulationLineInputSchema>;
