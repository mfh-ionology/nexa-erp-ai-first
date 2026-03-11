import type { PrismaClient, TransactionClient } from '@nexa/db';
import { AppError } from '../errors/app-error.js';

/**
 * Registry of entity types that support cross-cutting features
 * (attachments, notes, record links). Add new entity types here
 * as business modules are implemented.
 */
export const VALID_ENTITY_TYPES = new Set([
  'Customer',
  'CustomerInvoice',
  'SalesOrder',
  'PurchaseOrder',
  'SupplierBill',
  'Employee',
  'JournalEntry',
  'InventoryItem',
  'GoodsReceiptNote',
  'SupplierPayment',
  'CustomerPayment',
  'CreditNote',
  'Dispatch',
  'Department',
  'VatCode',
  'PaymentTerms',
  'EmailMessage',
  'Task',
] as const);

export type ValidEntityType = typeof VALID_ENTITY_TYPES extends Set<infer T> ? T : never;

export function isValidEntityType(entityType: string): entityType is ValidEntityType {
  return VALID_ENTITY_TYPES.has(entityType as ValidEntityType);
}

/**
 * Validates that an entity exists and belongs to the given company.
 * Uses dynamic Prisma model access — the entity's table must have
 * both `id` and `companyId` columns.
 *
 * @throws AppError 400 if entityType is not in the registry
 * @throws AppError 404 if entity not found or not in company scope
 */
export async function validateEntityExists(
  prisma: PrismaClient | TransactionClient,
  entityType: string,
  entityId: string,
  companyId: string,
): Promise<boolean> {
  if (!isValidEntityType(entityType)) {
    throw new AppError(
      'INVALID_ENTITY_TYPE',
      `Invalid entity type: ${entityType}`,
      400,
      undefined,
      'errors.entity.invalidType',
      { entityType },
    );
  }

  // Prisma delegates use lowerCamelCase: 'Customer' -> 'customer', 'SalesOrder' -> 'salesOrder'
  const delegateKey = entityType.charAt(0).toLowerCase() + entityType.slice(1);
  const delegate = (prisma as unknown as Record<string, unknown>)[delegateKey] as
    | { findFirst: (args: unknown) => Promise<unknown> }
    | undefined;

  if (!delegate || typeof delegate.findFirst !== 'function') {
    throw new AppError(
      'ENTITY_TYPE_NOT_AVAILABLE',
      `Entity type ${entityType} is registered but its data model is not yet available`,
      400,
      undefined,
      'errors.entity.notAvailable',
      { entityType },
    );
  }

  const entity = await delegate.findFirst({
    where: { id: entityId, companyId },
    select: { id: true },
  });

  if (!entity) {
    throw new AppError(
      'ENTITY_NOT_FOUND',
      `${entityType} with id ${entityId} not found`,
      404,
      undefined,
      'errors.entity.notFound',
      { entityType, entityId },
    );
  }

  return true;
}
