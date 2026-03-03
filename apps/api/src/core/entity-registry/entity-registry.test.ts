import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../errors/app-error.js';

import { VALID_ENTITY_TYPES, isValidEntityType, validateEntityExists } from './entity-registry.js';

describe('isValidEntityType', () => {
  it.each([
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
  ])('returns true for valid entity type %s', (entityType) => {
    expect(isValidEntityType(entityType)).toBe(true);
  });

  it.each(['Invoice', 'Order', 'Unknown', 'customer', '', 'CUSTOMER'])(
    'returns false for invalid entity type %s',
    (entityType) => {
      expect(isValidEntityType(entityType)).toBe(false);
    },
  );

  it('VALID_ENTITY_TYPES contains 16 entity types', () => {
    expect(VALID_ENTITY_TYPES.size).toBe(16);
  });
});

describe('validateEntityExists', () => {
  const entityId = '550e8400-e29b-41d4-a716-446655440000';
  const companyId = '660e8400-e29b-41d4-a716-446655440000';

  it('returns true when entity exists in the given company', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: entityId });
    const prisma = { customer: { findFirst } } as never;

    const result = await validateEntityExists(prisma, 'Customer', entityId, companyId);

    expect(result).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: entityId, companyId },
      select: { id: true },
    });
  });

  it('throws INVALID_ENTITY_TYPE (400) for unregistered entity type', async () => {
    const prisma = {} as never;

    await expect(validateEntityExists(prisma, 'UnknownType', entityId, companyId)).rejects.toThrow(
      AppError,
    );

    try {
      await validateEntityExists(prisma, 'UnknownType', entityId, companyId);
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.code).toBe('INVALID_ENTITY_TYPE');
      expect(appErr.statusCode).toBe(400);
    }
  });

  it('throws ENTITY_TYPE_NOT_AVAILABLE (400) when Prisma delegate is missing', async () => {
    // 'Customer' is valid but prisma has no 'customer' delegate
    const prisma = {} as never;

    await expect(validateEntityExists(prisma, 'Customer', entityId, companyId)).rejects.toThrow(
      AppError,
    );

    try {
      await validateEntityExists(prisma, 'Customer', entityId, companyId);
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.code).toBe('ENTITY_TYPE_NOT_AVAILABLE');
      expect(appErr.statusCode).toBe(400);
    }
  });

  it('throws ENTITY_NOT_FOUND (404) when entity does not exist', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { customer: { findFirst } } as never;

    await expect(validateEntityExists(prisma, 'Customer', entityId, companyId)).rejects.toThrow(
      AppError,
    );

    try {
      await validateEntityExists(prisma, 'Customer', entityId, companyId);
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.code).toBe('ENTITY_NOT_FOUND');
      expect(appErr.statusCode).toBe(404);
    }
  });

  it('converts PascalCase entity type to lowerCamelCase delegate key', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: entityId });
    const prisma = { salesOrder: { findFirst } } as never;

    await validateEntityExists(prisma, 'SalesOrder', entityId, companyId);
    expect(findFirst).toHaveBeenCalled();
  });
});
