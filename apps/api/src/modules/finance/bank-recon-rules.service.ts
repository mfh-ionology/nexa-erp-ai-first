import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type {
  CreateRuleInput,
  UpdateRuleInput,
  ListRulesQuery,
  RuleSuggestion,
  CreateJournalFromRuleInput,
} from './bank-recon-rules.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';
import { createJournalEntry, postJournalEntry } from './journals.service.js';
import type { EventBus } from '../../core/events/event-bus.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

// ---------------------------------------------------------------------------
// Select shape
// ---------------------------------------------------------------------------

const RULE_SELECT = {
  id: true,
  companyId: true,
  name: true,
  matchType: true,
  matchPattern: true,
  targetAccountCode: true,
  description: true,
  vatCode: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
} as const;

// ---------------------------------------------------------------------------
// CRUD: listRules
// ---------------------------------------------------------------------------

export async function listRules(prisma: PrismaClient, companyId: string, query: ListRulesQuery) {
  const { cursor, limit, isActive } = query;

  const where: Record<string, unknown> = { companyId };
  if (isActive !== undefined) where.isActive = isActive;

  const [items, total] = await Promise.all([
    prisma.bankReconciliationRule.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { name: 'asc' },
      select: RULE_SELECT,
    }),
    prisma.bankReconciliationRule.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };
  return { data, meta };
}

// ---------------------------------------------------------------------------
// CRUD: getRuleById
// ---------------------------------------------------------------------------

export async function getRuleById(prisma: PrismaClient, companyId: string, id: string) {
  const rule = await prisma.bankReconciliationRule.findFirst({
    where: { id, companyId },
    select: RULE_SELECT,
  });

  if (!rule) {
    throw new NotFoundError('NOT_FOUND', 'Reconciliation rule not found');
  }

  return rule;
}

// ---------------------------------------------------------------------------
// CRUD: createRule
// ---------------------------------------------------------------------------

export async function createRule(
  prisma: PrismaClient,
  companyId: string,
  data: CreateRuleInput,
  userId: string,
) {
  return prisma.bankReconciliationRule.create({
    data: {
      companyId,
      name: data.name,
      matchType: data.matchType,
      matchPattern: data.matchPattern,
      targetAccountCode: data.targetAccountCode,
      description: data.description ?? null,
      vatCode: data.vatCode ?? null,
      isActive: data.isActive ?? true,
      createdBy: userId,
    },
    select: RULE_SELECT,
  });
}

// ---------------------------------------------------------------------------
// CRUD: updateRule
// ---------------------------------------------------------------------------

export async function updateRule(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  data: UpdateRuleInput,
  _userId: string,
) {
  // Validate exists
  const existing = await prisma.bankReconciliationRule.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Reconciliation rule not found');
  }

  return prisma.bankReconciliationRule.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.matchType !== undefined ? { matchType: data.matchType } : {}),
      ...(data.matchPattern !== undefined ? { matchPattern: data.matchPattern } : {}),
      ...(data.targetAccountCode !== undefined
        ? { targetAccountCode: data.targetAccountCode }
        : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.vatCode !== undefined ? { vatCode: data.vatCode } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    select: RULE_SELECT,
  });
}

// ---------------------------------------------------------------------------
// CRUD: deleteRule
// ---------------------------------------------------------------------------

export async function deleteRule(prisma: PrismaClient, companyId: string, id: string) {
  const existing = await prisma.bankReconciliationRule.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Reconciliation rule not found');
  }

  await prisma.bankReconciliationRule.delete({
    where: { id },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// matchRulesToTransactions
// ---------------------------------------------------------------------------

function testRule(description: string, matchType: string, pattern: string): boolean {
  const descUpper = description.toUpperCase();
  const patternUpper = pattern.toUpperCase();

  switch (matchType) {
    case 'EXACT':
      return descUpper === patternUpper;
    case 'STARTS_WITH':
      return descUpper.startsWith(patternUpper);
    case 'CONTAINS':
      return descUpper.includes(patternUpper);
    case 'REGEX':
      try {
        return new RegExp(pattern, 'i').test(description);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export async function matchRulesToTransactions(
  prisma: PrismaClient,
  companyId: string,
  bankAccountId: string,
): Promise<RuleSuggestion[]> {
  // 1. Fetch all active rules
  const rules = await prisma.bankReconciliationRule.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: 'asc' },
  });

  if (rules.length === 0) return [];

  // 2. Fetch all unmatched bank transactions for this account
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      companyId,
      bankAccountId,
      isMatched: false,
    },
    select: {
      id: true,
      description: true,
    },
    orderBy: { transactionDate: 'desc' },
  });

  if (transactions.length === 0) return [];

  // 3. Match each transaction against each rule
  const suggestions: RuleSuggestion[] = [];

  for (const tx of transactions) {
    for (const rule of rules) {
      if (testRule(tx.description, rule.matchType, rule.matchPattern)) {
        suggestions.push({
          bankTransactionId: tx.id,
          ruleId: rule.id,
          ruleName: rule.name,
          suggestedAccountCode: rule.targetAccountCode,
          suggestedDescription: rule.description,
        });
        // Only first matching rule per transaction
        break;
      }
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// createJournalFromRule
// ---------------------------------------------------------------------------

export async function createJournalFromRule(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  bankAccountId: string,
  data: CreateJournalFromRuleInput,
  userId: string,
) {
  // Validate bank account
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId },
    select: { id: true, glAccountCode: true, name: true },
  });

  if (!bankAccount) {
    throw new NotFoundError('NOT_FOUND', 'Bank account not found');
  }

  // Validate bank transaction
  const bankTransaction = await prisma.bankTransaction.findFirst({
    where: { id: data.bankTransactionId, companyId, bankAccountId },
    select: { id: true, description: true, amount: true, transactionDate: true, isMatched: true },
  });

  if (!bankTransaction) {
    throw new NotFoundError('NOT_FOUND', 'Bank transaction not found');
  }

  if (bankTransaction.isMatched) {
    throw new AppError('ALREADY_MATCHED', 'Bank transaction is already matched', 409);
  }

  // Validate rule
  const rule = await prisma.bankReconciliationRule.findFirst({
    where: { id: data.ruleId, companyId },
    select: { id: true, targetAccountCode: true, description: true, vatCode: true },
  });

  if (!rule) {
    throw new NotFoundError('NOT_FOUND', 'Reconciliation rule not found');
  }

  const amount = toNumber(bankTransaction.amount as unknown as Prisma.Decimal);
  const accountCode = data.accountCode ?? rule.targetAccountCode;
  const description = data.description ?? rule.description ?? bankTransaction.description;
  const txDate = bankTransaction.transactionDate;

  // Determine which period to use (find open period covering the transaction date)
  const period = await prisma.financialPeriod.findFirst({
    where: {
      companyId,
      startDate: { lte: txDate },
      endDate: { gte: txDate },
    },
    select: { id: true, status: true },
    orderBy: { startDate: 'desc' },
  });

  if (!period) {
    throw new AppError(
      'NO_PERIOD',
      'No financial period covers the transaction date. Create or open the appropriate period first.',
      400,
    );
  }

  // Build journal lines:
  // Positive amount (credit to bank, e.g. money coming in): Dr Bank, Cr Target
  // Negative amount (debit from bank, e.g. money going out): Dr Target, Cr Bank
  const absAmount = Math.abs(amount);
  const bankGlCode = bankAccount.glAccountCode;

  const lines =
    amount >= 0
      ? [
          // Money IN: Dr Bank Account, Cr Target Account
          { accountCode: bankGlCode, debit: absAmount, credit: 0 },
          { accountCode, debit: 0, credit: absAmount, vatCode: rule.vatCode ?? undefined },
        ]
      : [
          // Money OUT: Dr Target Account, Cr Bank Account
          { accountCode, debit: absAmount, credit: 0, vatCode: rule.vatCode ?? undefined },
          { accountCode: bankGlCode, debit: 0, credit: absAmount },
        ];

  // Create journal entry (DRAFT)
  const journalEntry = await createJournalEntry(
    prisma,
    eventBus,
    companyId,
    {
      transactionDate: txDate,
      description,
      reference: `Rule: ${data.ruleId.slice(0, 8)}`,
      periodId: period.id,
      lines: lines.map((l) => ({
        accountCode: l.accountCode,
        description: description,
        debit: l.debit,
        credit: l.credit,
        vatCode: 'vatCode' in l && l.vatCode ? l.vatCode : undefined,
      })),
    },
    userId,
  );

  // Post the journal entry
  const entryId = (journalEntry as unknown as { id: string }).id;
  const posted = await postJournalEntry(prisma, eventBus, companyId, entryId, userId);

  return posted;
}
