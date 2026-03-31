import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants (matching Prisma-generated AccountType / NormalBalance)
// ---------------------------------------------------------------------------

export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
export const NORMAL_BALANCES = ['DEBIT', 'CREDIT'] as const;

// ---------------------------------------------------------------------------
// Validation helpers — BR-FIN-017
// ---------------------------------------------------------------------------

/**
 * Account code: min 2 chars, alphanumeric only (no special chars: - + . *)
 * BR-FIN-017: Account codes min 2 chars, no special chars (-+.*)
 */
const accountCodeSchema = z
  .string()
  .min(2, 'Account code must be at least 2 characters')
  .max(20, 'Account code must not exceed 20 characters')
  .regex(
    /^[A-Za-z0-9]+$/,
    'Account code must be alphanumeric only (no special characters like -, +, ., *)',
  );

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createAccountSchema = z.object({
  code: accountCodeSchema,
  name: z.string().min(1, 'Account name is required').max(255),
  accountType: z.enum(ACCOUNT_TYPES),
  normalBalance: z.enum(NORMAL_BALANCES),
  parentCode: z.string().max(20).optional(),
  classificationId: z.uuid().optional(),
  isPostable: z.boolean().default(true),
  isControl: z.boolean().default(false),
  isBankAccount: z.boolean().default(false),
  isSystemAccount: z.boolean().default(false),
  taxCode: z.string().max(20).optional(),
  departmentCode: z.string().max(20).optional(),
  currencyCode: z.string().max(3).optional(),
  openingBalance: z.number().default(0),
});

export const updateAccountSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    accountType: z.enum(ACCOUNT_TYPES).optional(),
    normalBalance: z.enum(NORMAL_BALANCES).optional(),
    parentCode: z.string().max(20).nullable().optional(),
    classificationId: z.uuid().nullable().optional(),
    isPostable: z.boolean().optional(),
    isControl: z.boolean().optional(),
    isBankAccount: z.boolean().optional(),
    isActive: z.boolean().optional(),
    taxCode: z.string().max(20).nullable().optional(),
    departmentCode: z.string().max(20).nullable().optional(),
    currencyCode: z.string().max(3).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const accountParamsSchema = z.object({
  id: z.uuid(),
});

export const listAccountsQuerySchema = z.object({
  search: z.string().optional(),
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  isPostable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  parentCode: z.string().optional(),
  classificationId: z.uuid().optional(),
  tree: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const searchAccountsQuerySchema = z.object({
  search: z.string().min(1, 'Search term is required'),
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const classificationSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  accountType: z.enum(ACCOUNT_TYPES),
  reportSection: z.string(),
});

export const accountListItemSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  accountType: z.enum(ACCOUNT_TYPES),
  normalBalance: z.enum(NORMAL_BALANCES),
  parentCode: z.string().nullable(),
  isPostable: z.boolean(),
  isControl: z.boolean(),
  isBankAccount: z.boolean(),
  isSystemAccount: z.boolean(),
  isActive: z.boolean(),
  openingBalance: z.number(),
  currentBalance: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const accountDetailSchema = accountListItemSchema.extend({
  classificationId: z.string().nullable(),
  classification: classificationSchema.nullable(),
  taxCode: z.string().nullable(),
  departmentCode: z.string().nullable(),
  currencyCode: z.string().nullable(),
  createdBy: z.string(),
  updatedBy: z.string(),
  children: z.array(accountListItemSchema).optional(),
});

/** Recursive tree node schema for ?tree=true response */
const baseTreeNodeSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  accountType: z.enum(ACCOUNT_TYPES),
  normalBalance: z.enum(NORMAL_BALANCES),
  parentCode: z.string().nullable(),
  isPostable: z.boolean(),
  isControl: z.boolean(),
  isBankAccount: z.boolean(),
  isSystemAccount: z.boolean(),
  isActive: z.boolean(),
  openingBalance: z.number(),
  currentBalance: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Zod doesn't support recursive schemas natively in strict mode for response,
// so we use z.lazy for the children property.
export type AccountTreeNode = z.infer<typeof baseTreeNodeSchema> & {
  children: AccountTreeNode[];
};

export const accountTreeNodeSchema: z.ZodType<AccountTreeNode> = baseTreeNodeSchema.extend({
  children: z.lazy(() => z.array(accountTreeNodeSchema)),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;
export type SearchAccountsQuery = z.infer<typeof searchAccountsQuerySchema>;
export type AccountListItem = z.infer<typeof accountListItemSchema>;
export type AccountDetail = z.infer<typeof accountDetailSchema>;
