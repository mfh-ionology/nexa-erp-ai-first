// ---------------------------------------------------------------------------
// AuditLog Immutability Integration Test — AC #2
// Verifies PostgreSQL RULEs (no_update_audit, no_delete_audit) enforce
// append-only semantics at the database level.
// Requires: live PostgreSQL connection (DIRECT_URL or DATABASE_URL env var)
// ---------------------------------------------------------------------------

import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'crypto';

let prisma: PrismaClient;
let companyId: string;
let auditLogId: string;

beforeAll(async () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set for tests');
  }
  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });

  // Use an existing company or create one for the audit log FK
  const existingCompany = await prisma.companyProfile.findFirst({ where: { isActive: true } });
  if (existingCompany) {
    companyId = existingCompany.id;
  } else {
    companyId = randomUUID();
    await prisma.companyProfile.create({
      data: {
        id: companyId,
        name: 'Audit Test Company',
        baseCurrencyCode: 'GBP',
        countryCode: 'GB',
        createdBy: 'test',
        updatedBy: 'test',
      },
    });
  }
});

afterAll(async () => {
  // AuditLog records cannot be deleted (PostgreSQL RULE), so we use raw SQL
  // to drop the rule, clean up, and re-create the rule.
  if (auditLogId) {
    await prisma.$executeRawUnsafe('DROP RULE IF EXISTS no_delete_audit ON audit_logs');
    await prisma.auditLog.delete({ where: { id: auditLogId } });
    await prisma.$executeRawUnsafe(
      'CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING',
    );
  }
  await prisma.$disconnect();
});

describe('AuditLog immutability (PostgreSQL RULEs — AC #2)', () => {
  it('should create an audit log record successfully', async () => {
    auditLogId = randomUUID();

    const record = await prisma.auditLog.create({
      data: {
        id: auditLogId,
        companyId,
        entityType: 'TestEntity',
        entityId: randomUUID(),
        action: 'CREATE',
        afterData: { test: true },
        userId: randomUUID(),
        isAiAction: false,
      },
    });

    expect(record.id).toBe(auditLogId);
    expect(record.action).toBe('CREATE');
    expect(record.entityType).toBe('TestEntity');
  });

  it('UPDATE via Prisma has no effect — PostgreSQL RULE silently discards it', async () => {
    // Attempt to change action from CREATE to DELETE
    await prisma.auditLog.update({
      where: { id: auditLogId },
      data: { action: 'DELETE', entityType: 'Tampered' },
    });

    // Re-read the record — it must be unchanged
    const record = await prisma.auditLog.findUnique({ where: { id: auditLogId } });

    expect(record).not.toBeNull();
    expect(record!.action).toBe('CREATE'); // NOT 'DELETE'
    expect(record!.entityType).toBe('TestEntity'); // NOT 'Tampered'
  });

  it('DELETE via Prisma has no effect — PostgreSQL RULE silently discards it', async () => {
    // Attempt to delete the record
    await prisma.auditLog.delete({ where: { id: auditLogId } });

    // Re-read the record — it must still exist
    const record = await prisma.auditLog.findUnique({ where: { id: auditLogId } });

    expect(record).not.toBeNull();
    expect(record!.id).toBe(auditLogId);
    expect(record!.action).toBe('CREATE');
  });
});
