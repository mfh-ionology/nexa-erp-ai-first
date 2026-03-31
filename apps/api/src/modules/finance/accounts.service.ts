import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type {
  CreateAccountInput,
  UpdateAccountInput,
  ListAccountsQuery,
  SearchAccountsQuery,
  AccountTreeNode,
} from './accounts.schema.js';
import { AppError, DomainError, NotFoundError } from '../../core/errors/index.js';
import type { EventBus } from '../../core/events/event-bus.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Prisma select shapes — only return API-contract-defined fields
// ---------------------------------------------------------------------------

const LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  accountType: true,
  normalBalance: true,
  parentCode: true,
  isPostable: true,
  isControl: true,
  isBankAccount: true,
  isSystemAccount: true,
  isActive: true,
  openingBalance: true,
  currentBalance: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  classificationId: true,
  classification: {
    select: {
      id: true,
      code: true,
      name: true,
      accountType: true,
      reportSection: true,
    },
  },
  taxCode: true,
  departmentCode: true,
  currencyCode: true,
  createdBy: true,
  updatedBy: true,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal fields to numbers for JSON serialisation */
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/** Normalise a raw Prisma list item to the API shape */
function normaliseListItem(row: Record<string, unknown>) {
  return {
    ...row,
    openingBalance: toNumber(row.openingBalance as Prisma.Decimal),
    currentBalance: toNumber(row.currentBalance as Prisma.Decimal),
  };
}

/** Normalise a raw Prisma detail row to the API shape */
function normaliseDetail(row: Record<string, unknown>) {
  return {
    ...normaliseListItem(row),
    classification: row.classification ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tree builder — converts flat list into nested tree (AC-1 ?tree=true)
// ---------------------------------------------------------------------------

export function buildAccountTree(flatItems: Array<Record<string, unknown>>): AccountTreeNode[] {
  const normalised = flatItems.map(normaliseListItem) as Array<Record<string, unknown>>;

  // Index by code for O(1) lookups
  const byCode = new Map<string, AccountTreeNode>();
  for (const item of normalised) {
    const code = item.code as string;
    byCode.set(code, { ...item, children: [] } as unknown as AccountTreeNode);
  }

  const roots: AccountTreeNode[] = [];
  for (const node of byCode.values()) {
    if (node.parentCode && byCode.has(node.parentCode)) {
      byCode.get(node.parentCode)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ---------------------------------------------------------------------------
// listAccounts (AC-1)
// ---------------------------------------------------------------------------

export async function listAccounts(
  prisma: PrismaClient,
  companyId: string,
  query: ListAccountsQuery,
) {
  const {
    cursor,
    limit,
    search,
    accountType,
    isActive,
    isPostable,
    parentCode,
    classificationId,
    tree,
  } = query;

  const where: Record<string, unknown> = { companyId };
  if (accountType !== undefined) where.accountType = accountType;
  if (isActive !== undefined) where.isActive = isActive;
  if (isPostable !== undefined) where.isPostable = isPostable;
  if (parentCode !== undefined) where.parentCode = parentCode;
  if (classificationId !== undefined) where.classificationId = classificationId;
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  // For tree mode, fetch all matching accounts (no cursor pagination)
  if (tree) {
    const items = await prisma.chartOfAccount.findMany({
      where,
      orderBy: { code: 'asc' },
      select: LIST_SELECT,
    });
    const treeData = buildAccountTree(items as unknown as Array<Record<string, unknown>>);
    return { data: treeData, meta: { total: items.length } };
  }

  // Flat list with cursor-based pagination
  const [items, total] = await Promise.all([
    prisma.chartOfAccount.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { code: 'asc' },
      select: LIST_SELECT,
    }),
    prisma.chartOfAccount.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const mapped = data.map((row) => normaliseListItem(row as unknown as Record<string, unknown>));

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data: mapped, meta };
}

// ---------------------------------------------------------------------------
// getAccountById (AC-2)
// ---------------------------------------------------------------------------

export async function getAccountById(prisma: PrismaClient, companyId: string, id: string) {
  const account = await prisma.chartOfAccount.findFirst({
    where: { id, companyId },
    select: {
      ...DETAIL_SELECT,
      children: {
        select: LIST_SELECT,
        orderBy: { code: 'asc' },
      },
    },
  });

  if (!account) {
    throw new NotFoundError('NOT_FOUND', 'Account not found');
  }

  const detail = normaliseDetail(account as unknown as Record<string, unknown>);
  // Normalise children balances
  const children = (account.children ?? []).map((child) =>
    normaliseListItem(child as unknown as Record<string, unknown>),
  );

  return { ...detail, children };
}

// ---------------------------------------------------------------------------
// createAccount (AC-3)
// ---------------------------------------------------------------------------

export async function createAccount(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  data: CreateAccountInput,
  userId: string,
) {
  // If parentCode is provided, validate it exists within the same company
  if (data.parentCode) {
    const parent = await prisma.chartOfAccount.findFirst({
      where: { companyId, code: data.parentCode },
      select: { id: true },
    });
    if (!parent) {
      throw new AppError('INVALID_PARENT', 'Parent account code does not exist', 400);
    }
  }

  // If classificationId is provided, validate it exists within the same company
  if (data.classificationId) {
    const classification = await prisma.accountClassification.findFirst({
      where: { companyId, id: data.classificationId },
      select: { id: true },
    });
    if (!classification) {
      throw new AppError('INVALID_CLASSIFICATION', 'Account classification does not exist', 400);
    }
  }

  try {
    const account = await prisma.chartOfAccount.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        accountType: data.accountType,
        normalBalance: data.normalBalance,
        parentCode: data.parentCode ?? null,
        classificationId: data.classificationId ?? null,
        isPostable: data.isPostable,
        isControl: data.isControl,
        isBankAccount: data.isBankAccount,
        isSystemAccount: data.isSystemAccount,
        taxCode: data.taxCode ?? null,
        departmentCode: data.departmentCode ?? null,
        currencyCode: data.currencyCode ?? null,
        openingBalance: data.openingBalance,
        currentBalance: data.openingBalance, // initialise current = opening
        createdBy: userId,
        updatedBy: userId,
      },
      select: {
        ...DETAIL_SELECT,
        children: {
          select: LIST_SELECT,
          orderBy: { code: 'asc' },
        },
      },
    });

    eventBus.emit('chartOfAccount.created', {
      accountId: account.id,
      companyId,
      code: account.code,
      name: account.name,
      accountType: account.accountType,
      createdBy: userId,
    });

    const detail = normaliseDetail(account as unknown as Record<string, unknown>);
    const children = (account.children ?? []).map((child) =>
      normaliseListItem(child as unknown as Record<string, unknown>),
    );

    return { ...detail, children };
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError('DUPLICATE_CODE', 'Account code already exists for this company', 409);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// updateAccount (AC-4, AC-6, AC-7)
// ---------------------------------------------------------------------------

export async function updateAccount(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  data: UpdateAccountInput,
  userId: string,
) {
  const { updated, beforeSnapshot } = await prisma.$transaction(async (tx) => {
    const existing = await tx.chartOfAccount.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        normalBalance: true,
        parentCode: true,
        classificationId: true,
        isPostable: true,
        isControl: true,
        isBankAccount: true,
        isSystemAccount: true,
        isActive: true,
        taxCode: true,
        departmentCode: true,
        currencyCode: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('NOT_FOUND', 'Account not found');
    }

    // BR-FIN-006: Cannot modify system accounts (except specific fields)
    if (existing.isSystemAccount) {
      // System accounts can only have name updated, nothing else
      const protectedFields = [
        'accountType',
        'normalBalance',
        'parentCode',
        'classificationId',
        'isPostable',
        'isControl',
        'isBankAccount',
        'isActive',
        'taxCode',
        'departmentCode',
        'currencyCode',
      ] as const;
      const hasProtectedChange = protectedFields.some(
        (f) => data[f as keyof typeof data] !== undefined,
      );
      if (hasProtectedChange) {
        throw new DomainError(
          'SYSTEM_ACCOUNT_PROTECTED',
          'Cannot modify protected fields on a system account',
        );
      }
    }

    // BR-FIN-005: Cannot deactivate accounts with current-year journal postings
    if (data.isActive === false && existing.isActive === true) {
      // BR-FIN-006: Cannot deactivate system accounts
      if (existing.isSystemAccount) {
        throw new DomainError('SYSTEM_ACCOUNT_PROTECTED', 'Cannot deactivate a system account');
      }

      // BR-FIN-005: Cannot deactivate accounts that have ANY posted journal lines
      // in ANY open (non-locked) fiscal year. This prevents deactivating accounts
      // that are still actively used, regardless of calendar year.
      const postingCount = await tx.journalLine.count({
        where: {
          companyId,
          accountCode: existing.code,
          journalEntry: {
            status: 'POSTED',
          },
        },
      });

      if (postingCount > 0) {
        throw new DomainError(
          'ACCOUNT_HAS_POSTINGS',
          'Cannot deactivate account with current-year journal postings',
        );
      }
    }

    // If parentCode is being changed, validate the new parent exists
    if (data.parentCode !== undefined && data.parentCode !== null) {
      // Prevent circular reference
      if (data.parentCode === existing.code) {
        throw new AppError('CIRCULAR_PARENT', 'Account cannot be its own parent', 400);
      }
      const parent = await tx.chartOfAccount.findFirst({
        where: { companyId, code: data.parentCode },
        select: { id: true },
      });
      if (!parent) {
        throw new AppError('INVALID_PARENT', 'Parent account code does not exist', 400);
      }
    }

    // If classificationId is being changed, validate it exists
    if (data.classificationId !== undefined && data.classificationId !== null) {
      const classification = await tx.accountClassification.findFirst({
        where: { companyId, id: data.classificationId },
        select: { id: true },
      });
      if (!classification) {
        throw new AppError('INVALID_CLASSIFICATION', 'Account classification does not exist', 400);
      }
    }

    // Capture before state for audit
    const before = { ...existing };

    const result = await tx.chartOfAccount.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.accountType !== undefined && { accountType: data.accountType }),
        ...(data.normalBalance !== undefined && { normalBalance: data.normalBalance }),
        ...(data.parentCode !== undefined && { parentCode: data.parentCode }),
        ...(data.classificationId !== undefined && { classificationId: data.classificationId }),
        ...(data.isPostable !== undefined && { isPostable: data.isPostable }),
        ...(data.isControl !== undefined && { isControl: data.isControl }),
        ...(data.isBankAccount !== undefined && { isBankAccount: data.isBankAccount }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.taxCode !== undefined && { taxCode: data.taxCode }),
        ...(data.departmentCode !== undefined && { departmentCode: data.departmentCode }),
        ...(data.currencyCode !== undefined && { currencyCode: data.currencyCode }),
        updatedBy: userId,
      },
      select: {
        ...DETAIL_SELECT,
        children: {
          select: LIST_SELECT,
          orderBy: { code: 'asc' },
        },
      },
    });

    return { updated: result, beforeSnapshot: before };
  });

  // Emit appropriate event
  if (data.isActive === false) {
    eventBus.emit('chartOfAccount.deactivated', {
      accountId: id,
      companyId,
      code: updated.code,
      deactivatedBy: userId,
    });
  } else {
    eventBus.emit('chartOfAccount.updated', {
      accountId: id,
      companyId,
      code: updated.code,
      changedBy: userId,
      beforeData: beforeSnapshot,
      afterData: {
        name: updated.name,
        accountType: updated.accountType,
        isActive: updated.isActive,
      },
    });
  }

  const detail = normaliseDetail(updated as unknown as Record<string, unknown>);
  const children = (updated.children ?? []).map((child) =>
    normaliseListItem(child as unknown as Record<string, unknown>),
  );

  return { ...detail, children };
}

// ---------------------------------------------------------------------------
// searchAccounts (AC-5)
// ---------------------------------------------------------------------------

export async function searchAccounts(
  prisma: PrismaClient,
  companyId: string,
  query: SearchAccountsQuery,
) {
  const { search, accountType, isActive, limit } = query;

  const where: Record<string, unknown> = {
    companyId,
    OR: [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ],
  };

  if (accountType !== undefined) where.accountType = accountType;
  if (isActive !== undefined) where.isActive = isActive;

  const items = await prisma.chartOfAccount.findMany({
    where,
    take: limit,
    orderBy: { code: 'asc' },
    select: LIST_SELECT,
  });

  return items.map((row) => normaliseListItem(row as unknown as Record<string, unknown>));
}
