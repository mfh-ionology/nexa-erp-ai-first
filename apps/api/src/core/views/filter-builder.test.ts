import { describe, expect, it } from 'vitest';

import {
  buildPrismaWhere,
  resolveDatePreset,
  type FilterCondition,
  type FieldMetadata,
  type DatePresetInfo,
} from './filter-builder.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(
  id: string,
  fieldKey: string,
  fieldType: FieldMetadata['fieldType'],
): FieldMetadata {
  return { id, fieldKey, fieldType };
}

function makeCondition(
  overrides: Partial<FilterCondition> & {
    dataViewFieldId: string;
    operator: FilterCondition['operator'];
  },
): FilterCondition {
  return {
    value: null,
    valueList: null,
    datePresetId: null,
    groupId: 0,
    groupLogic: 'AND',
    outerLogic: 'AND',
    conditionOrder: 0,
    ...overrides,
  };
}

function fieldMap(...fields: FieldMetadata[]): Map<string, FieldMetadata> {
  return new Map(fields.map((f) => [f.id, f]));
}

// ---------------------------------------------------------------------------
// Operator mapping tests (5.2)
// ---------------------------------------------------------------------------

describe('filter-builder: operator mapping', () => {
  const stringField = makeField('f1', 'name', 'STRING');
  const numberField = makeField('f2', 'amount', 'NUMBER');
  const dateField = makeField('f3', 'createdAt', 'DATE');
  const boolField = makeField('f4', 'isActive', 'BOOLEAN');
  const enumField = makeField('f5', 'status', 'ENUM');
  const currencyField = makeField('f6', 'total', 'CURRENCY');

  it('EQUALS — string field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: 'Acme' })],
      fieldMap(stringField),
    );
    expect(result).toEqual({ name: { equals: 'Acme' } });
  });

  it('EQUALS — number field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f2', operator: 'EQUALS', value: '100.5' })],
      fieldMap(numberField),
    );
    expect(result).toEqual({ amount: { equals: 100.5 } });
  });

  it('EQUALS — boolean field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f4', operator: 'EQUALS', value: 'true' })],
      fieldMap(boolField),
    );
    expect(result).toEqual({ isActive: { equals: true } });
  });

  it('EQUALS — boolean field (false)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f4', operator: 'EQUALS', value: 'false' })],
      fieldMap(boolField),
    );
    expect(result).toEqual({ isActive: { equals: false } });
  });

  it('EQUALS — enum field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f5', operator: 'EQUALS', value: 'POSTED' })],
      fieldMap(enumField),
    );
    expect(result).toEqual({ status: { equals: 'POSTED' } });
  });

  it('NOT_EQUALS — string field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'NOT_EQUALS', value: 'Acme' })],
      fieldMap(stringField),
    );
    expect(result).toEqual({ name: { not: { equals: 'Acme' } } });
  });

  it('CONTAINS — case-insensitive string', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'CONTAINS', value: 'acm' })],
      fieldMap(stringField),
    );
    expect(result).toEqual({ name: { contains: 'acm', mode: 'insensitive' } });
  });

  it('STARTS_WITH — case-insensitive string', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'STARTS_WITH', value: 'Ac' })],
      fieldMap(stringField),
    );
    expect(result).toEqual({ name: { startsWith: 'Ac', mode: 'insensitive' } });
  });

  it('ENDS_WITH — case-insensitive string', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'ENDS_WITH', value: 'me' })],
      fieldMap(stringField),
    );
    expect(result).toEqual({ name: { endsWith: 'me', mode: 'insensitive' } });
  });

  it('GT — number field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f2', operator: 'GT', value: '1000' })],
      fieldMap(numberField),
    );
    expect(result).toEqual({ amount: { gt: 1000 } });
  });

  it('GTE — number field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f2', operator: 'GTE', value: '500' })],
      fieldMap(numberField),
    );
    expect(result).toEqual({ amount: { gte: 500 } });
  });

  it('LT — number field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f2', operator: 'LT', value: '200' })],
      fieldMap(numberField),
    );
    expect(result).toEqual({ amount: { lt: 200 } });
  });

  it('LTE — number field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f2', operator: 'LTE', value: '999' })],
      fieldMap(numberField),
    );
    expect(result).toEqual({ amount: { lte: 999 } });
  });

  it('GT — date field', () => {
    const dateStr = '2026-01-15T00:00:00.000Z';
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f3', operator: 'GT', value: dateStr })],
      fieldMap(dateField),
    );
    expect(result).toEqual({ createdAt: { gt: new Date(dateStr) } });
  });

  it('BETWEEN — number field with valueList', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f2', operator: 'BETWEEN', valueList: ['100', '500'] })],
      fieldMap(numberField),
    );
    expect(result).toEqual({ amount: { gte: 100, lte: 500 } });
  });

  it('BETWEEN — number field with JSON value', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f2', operator: 'BETWEEN', value: '[50, 200]' })],
      fieldMap(numberField),
    );
    expect(result).toEqual({ amount: { gte: 50, lte: 200 } });
  });

  it('IN — string field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'IN', valueList: ['A', 'B', 'C'] })],
      fieldMap(stringField),
    );
    expect(result).toEqual({ name: { in: ['A', 'B', 'C'] } });
  });

  it('NOT_IN — string field', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'NOT_IN', valueList: ['X', 'Y'] })],
      fieldMap(stringField),
    );
    expect(result).toEqual({ name: { notIn: ['X', 'Y'] } });
  });

  it('IS_EMPTY — string field (null or empty string)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'IS_EMPTY' })],
      fieldMap(stringField),
    );
    expect(result).toEqual({
      OR: [{ name: { equals: null } }, { name: { equals: '' } }],
    });
  });

  it('IS_EMPTY — number field (null only)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f2', operator: 'IS_EMPTY' })],
      fieldMap(numberField),
    );
    expect(result).toEqual({ amount: { equals: null } });
  });

  it('IS_NOT_EMPTY — string field (not null and not empty)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'IS_NOT_EMPTY' })],
      fieldMap(stringField),
    );
    expect(result).toEqual({
      AND: [{ name: { not: null } }, { name: { not: '' } }],
    });
  });

  it('IS_NOT_EMPTY — number field (not null)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f2', operator: 'IS_NOT_EMPTY' })],
      fieldMap(numberField),
    );
    expect(result).toEqual({ amount: { not: null } });
  });

  it('CURRENCY field uses numeric parsing', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f6', operator: 'GTE', value: '99.99' })],
      fieldMap(currencyField),
    );
    expect(result).toEqual({ total: { gte: 99.99 } });
  });

  it('BETWEEN — date field with valueList', () => {
    const result = buildPrismaWhere(
      [
        makeCondition({
          dataViewFieldId: 'f3',
          operator: 'BETWEEN',
          valueList: ['2026-01-01T00:00:00.000Z', '2026-01-31T23:59:59.999Z'],
        }),
      ],
      fieldMap(dateField),
    );
    expect(result).toEqual({
      createdAt: {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lte: new Date('2026-01-31T23:59:59.999Z'),
      },
    });
  });

  it('IS_EMPTY — date field (null only)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f3', operator: 'IS_EMPTY' })],
      fieldMap(dateField),
    );
    expect(result).toEqual({ createdAt: { equals: null } });
  });

  it('IS_NOT_EMPTY — date field (not null)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f3', operator: 'IS_NOT_EMPTY' })],
      fieldMap(dateField),
    );
    expect(result).toEqual({ createdAt: { not: null } });
  });

  it('IS_EMPTY — boolean field (null only)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f4', operator: 'IS_EMPTY' })],
      fieldMap(boolField),
    );
    expect(result).toEqual({ isActive: { equals: null } });
  });

  it('IS_NOT_EMPTY — boolean field (not null)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f4', operator: 'IS_NOT_EMPTY' })],
      fieldMap(boolField),
    );
    expect(result).toEqual({ isActive: { not: null } });
  });

  it('IS_EMPTY — currency field (null only)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f6', operator: 'IS_EMPTY' })],
      fieldMap(currencyField),
    );
    expect(result).toEqual({ total: { equals: null } });
  });

  it('IS_NOT_EMPTY — currency field (not null)', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f6', operator: 'IS_NOT_EMPTY' })],
      fieldMap(currencyField),
    );
    expect(result).toEqual({ total: { not: null } });
  });
});

// ---------------------------------------------------------------------------
// Group bracketing tests (5.3)
// ---------------------------------------------------------------------------

describe('filter-builder: group bracketing', () => {
  const statusField = makeField('f1', 'status', 'ENUM');
  const amountField = makeField('f2', 'amount', 'NUMBER');
  const nameField = makeField('f3', 'name', 'STRING');
  const fields = fieldMap(statusField, amountField, nameField);

  it('single group with AND logic', () => {
    const conditions: FilterCondition[] = [
      makeCondition({
        dataViewFieldId: 'f1',
        operator: 'EQUALS',
        value: 'POSTED',
        groupId: 0,
        groupLogic: 'AND',
        conditionOrder: 0,
      }),
      makeCondition({
        dataViewFieldId: 'f2',
        operator: 'GT',
        value: '1000',
        groupId: 0,
        groupLogic: 'AND',
        conditionOrder: 1,
      }),
    ];

    const result = buildPrismaWhere(conditions, fields, 'AND');

    expect(result).toEqual({
      AND: [{ status: { equals: 'POSTED' } }, { amount: { gt: 1000 } }],
    });
  });

  it('single group with OR logic', () => {
    const conditions: FilterCondition[] = [
      makeCondition({
        dataViewFieldId: 'f1',
        operator: 'EQUALS',
        value: 'DRAFT',
        groupId: 0,
        groupLogic: 'OR',
        conditionOrder: 0,
      }),
      makeCondition({
        dataViewFieldId: 'f1',
        operator: 'EQUALS',
        value: 'POSTED',
        groupId: 0,
        groupLogic: 'OR',
        conditionOrder: 1,
      }),
    ];

    const result = buildPrismaWhere(conditions, fields, 'AND');

    expect(result).toEqual({
      OR: [{ status: { equals: 'DRAFT' } }, { status: { equals: 'POSTED' } }],
    });
  });

  it('multiple groups combined with outer logic', () => {
    // (status = POSTED AND amount > 1000) OR (name CONTAINS Acme)
    const conditions: FilterCondition[] = [
      makeCondition({
        dataViewFieldId: 'f1',
        operator: 'EQUALS',
        value: 'POSTED',
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      }),
      makeCondition({
        dataViewFieldId: 'f2',
        operator: 'GT',
        value: '1000',
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 1,
      }),
      makeCondition({
        dataViewFieldId: 'f3',
        operator: 'CONTAINS',
        value: 'Acme',
        groupId: 1,
        groupLogic: 'AND',
        outerLogic: 'OR',
        conditionOrder: 2,
      }),
    ];

    const result = buildPrismaWhere(conditions, fields, 'OR');

    expect(result).toEqual({
      OR: [
        { AND: [{ status: { equals: 'POSTED' } }, { amount: { gt: 1000 } }] },
        { name: { contains: 'Acme', mode: 'insensitive' } },
      ],
    });
  });

  it('single condition in a group does not wrap in array', () => {
    const conditions: FilterCondition[] = [
      makeCondition({
        dataViewFieldId: 'f1',
        operator: 'EQUALS',
        value: 'POSTED',
        groupId: 0,
        groupLogic: 'AND',
        conditionOrder: 0,
      }),
    ];

    const result = buildPrismaWhere(conditions, fields, 'AND');

    expect(result).toEqual({ status: { equals: 'POSTED' } });
  });

  it('conditions are processed in conditionOrder', () => {
    const conditions: FilterCondition[] = [
      makeCondition({
        dataViewFieldId: 'f2',
        operator: 'GT',
        value: '500',
        groupId: 0,
        groupLogic: 'AND',
        conditionOrder: 2,
      }),
      makeCondition({
        dataViewFieldId: 'f1',
        operator: 'EQUALS',
        value: 'ACTIVE',
        groupId: 0,
        groupLogic: 'AND',
        conditionOrder: 1,
      }),
    ];

    const result = buildPrismaWhere(conditions, fields, 'AND');

    // Should be ordered by conditionOrder: status first, amount second
    expect(result).toEqual({
      AND: [{ status: { equals: 'ACTIVE' } }, { amount: { gt: 500 } }],
    });
  });
});

// ---------------------------------------------------------------------------
// Date preset resolution tests (5.4)
// ---------------------------------------------------------------------------

describe('filter-builder: resolveDatePreset', () => {
  // Use a fixed date: Wednesday 2026-02-25 12:00:00 UTC
  const fixedNow = new Date('2026-02-25T12:00:00.000Z');

  it('today', () => {
    const range = resolveDatePreset('today', fixedNow)!;
    expect(range.gte.getDate()).toBe(25);
    expect(range.lte.getDate()).toBe(25);
    expect(range.gte.getHours()).toBe(0);
    expect(range.lte.getHours()).toBe(23);
  });

  it('yesterday', () => {
    const range = resolveDatePreset('yesterday', fixedNow)!;
    expect(range.gte.getDate()).toBe(24);
    expect(range.lte.getDate()).toBe(24);
    expect(range.gte.getHours()).toBe(0);
    expect(range.lte.getHours()).toBe(23);
  });

  it('tomorrow', () => {
    const range = resolveDatePreset('tomorrow', fixedNow)!;
    expect(range.gte.getDate()).toBe(26);
    expect(range.lte.getDate()).toBe(26);
    expect(range.gte.getHours()).toBe(0);
    expect(range.lte.getHours()).toBe(23);
  });

  it('last3days', () => {
    const range = resolveDatePreset('last3days', fixedNow)!;
    expect(range.gte.getDate()).toBe(22);
    expect(range.lte.getDate()).toBe(25);
    expect(range.gte.getHours()).toBe(0);
    expect(range.lte.getHours()).toBe(23);
  });

  it('last7days', () => {
    const range = resolveDatePreset('last7days', fixedNow)!;
    expect(range.gte.getDate()).toBe(18);
    expect(range.lte.getDate()).toBe(25);
    expect(range.gte.getHours()).toBe(0);
    expect(range.lte.getHours()).toBe(23);
  });

  it('last30days', () => {
    const range = resolveDatePreset('last30days', fixedNow)!;
    expect(range.gte.getMonth()).toBe(0); // January
    expect(range.gte.getDate()).toBe(26);
    expect(range.lte.getDate()).toBe(25);
  });

  it('next7days', () => {
    const range = resolveDatePreset('next7days', fixedNow)!;
    expect(range.gte.getDate()).toBe(25);
    expect(range.lte.getMonth()).toBe(2); // March
    expect(range.lte.getDate()).toBe(4);
  });

  it('next30days', () => {
    const range = resolveDatePreset('next30days', fixedNow)!;
    expect(range.gte.getDate()).toBe(25);
    expect(range.lte.getMonth()).toBe(2); // March
    expect(range.lte.getDate()).toBe(27);
  });

  it('thisweek (Monday to Sunday)', () => {
    const range = resolveDatePreset('thisweek', fixedNow)!;
    // Feb 25 is a Wednesday, so Monday = Feb 23, Sunday = Mar 1
    expect(range.gte.getDate()).toBe(23);
    expect(range.lte.getDate()).toBe(1);
    expect(range.lte.getMonth()).toBe(2); // March
    expect(range.gte.getHours()).toBe(0);
    expect(range.lte.getHours()).toBe(23);
  });

  it('lastweek', () => {
    const range = resolveDatePreset('lastweek', fixedNow)!;
    // last week: Feb 16 (Mon) to Feb 22 (Sun)
    expect(range.gte.getDate()).toBe(16);
    expect(range.lte.getDate()).toBe(22);
    expect(range.gte.getHours()).toBe(0);
    expect(range.lte.getHours()).toBe(23);
  });

  it('nextweek', () => {
    const range = resolveDatePreset('nextweek', fixedNow)!;
    // next week: Mar 2 (Mon) to Mar 8 (Sun)
    expect(range.gte.getDate()).toBe(2);
    expect(range.lte.getDate()).toBe(8);
    expect(range.gte.getMonth()).toBe(2); // March
    expect(range.gte.getHours()).toBe(0);
    expect(range.lte.getHours()).toBe(23);
  });

  it('thismonth', () => {
    const range = resolveDatePreset('thismonth', fixedNow)!;
    expect(range.gte.getDate()).toBe(1);
    expect(range.gte.getMonth()).toBe(1); // February
    expect(range.lte.getDate()).toBe(28); // 2026 is not leap year
    expect(range.lte.getMonth()).toBe(1);
  });

  it('lastmonth', () => {
    const range = resolveDatePreset('lastmonth', fixedNow)!;
    expect(range.gte.getDate()).toBe(1);
    expect(range.gte.getMonth()).toBe(0); // January
    expect(range.lte.getDate()).toBe(31);
    expect(range.lte.getMonth()).toBe(0);
  });

  it('nextmonth', () => {
    const range = resolveDatePreset('nextmonth', fixedNow)!;
    expect(range.gte.getDate()).toBe(1);
    expect(range.gte.getMonth()).toBe(2); // March
    expect(range.lte.getDate()).toBe(31);
    expect(range.lte.getMonth()).toBe(2);
  });

  it('thisyear', () => {
    const range = resolveDatePreset('thisyear', fixedNow)!;
    expect(range.gte.getFullYear()).toBe(2026);
    expect(range.gte.getMonth()).toBe(0);
    expect(range.gte.getDate()).toBe(1);
    expect(range.lte.getFullYear()).toBe(2026);
    expect(range.lte.getMonth()).toBe(11);
    expect(range.lte.getDate()).toBe(31);
  });

  it('lastyear', () => {
    const range = resolveDatePreset('lastyear', fixedNow)!;
    expect(range.gte.getFullYear()).toBe(2025);
    expect(range.lte.getFullYear()).toBe(2025);
  });

  it('nextyear', () => {
    const range = resolveDatePreset('nextyear', fixedNow)!;
    expect(range.gte.getFullYear()).toBe(2027);
    expect(range.lte.getFullYear()).toBe(2027);
  });

  it('mtd (month to date)', () => {
    const range = resolveDatePreset('mtd', fixedNow)!;
    expect(range.gte.getDate()).toBe(1);
    expect(range.gte.getMonth()).toBe(1); // February
    expect(range.lte.getDate()).toBe(25);
  });

  it('ytd (year to date)', () => {
    const range = resolveDatePreset('ytd', fixedNow)!;
    expect(range.gte.getFullYear()).toBe(2026);
    expect(range.gte.getMonth()).toBe(0);
    expect(range.gte.getDate()).toBe(1);
    expect(range.lte.getDate()).toBe(25);
  });

  it('unknown preset returns null', () => {
    expect(resolveDatePreset('invalid_key', fixedNow)).toBeNull();
  });
});

describe('filter-builder: date preset in conditions', () => {
  const dateField = makeField('f1', 'createdAt', 'DATE');
  const fields = fieldMap(dateField);
  const presets = new Map<string, DatePresetInfo>([
    ['preset-today', { id: 'preset-today', presetKey: 'today' }],
    ['preset-custom', { id: 'preset-custom', presetKey: 'custom' }],
    ['preset-ytd', { id: 'preset-ytd', presetKey: 'ytd' }],
  ]);

  it('resolves date preset to date range', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', datePresetId: 'preset-today' })],
      fields,
      'AND',
      presets,
    );

    expect(result).toHaveProperty('createdAt.gte');
    expect(result).toHaveProperty('createdAt.lte');
    expect((result.createdAt as { gte: Date }).gte).toBeInstanceOf(Date);
  });

  it('resolves custom preset using value JSON', () => {
    const result = buildPrismaWhere(
      [
        makeCondition({
          dataViewFieldId: 'f1',
          operator: 'BETWEEN',
          datePresetId: 'preset-custom',
          value: '["2026-01-01", "2026-01-31"]',
        }),
      ],
      fields,
      'AND',
      presets,
    );

    expect(result).toHaveProperty('createdAt.gte');
    expect(result).toHaveProperty('createdAt.lte');
  });

  it('returns empty when preset not found', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', datePresetId: 'nonexistent' })],
      fields,
      'AND',
      presets,
    );

    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Type-safe value parsing tests (5.5)
// ---------------------------------------------------------------------------

describe('filter-builder: type-safe value parsing', () => {
  it('STRING — preserves string value', () => {
    const field = makeField('f1', 'name', 'STRING');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: '  test  ' })],
      fieldMap(field),
    );
    expect(result).toEqual({ name: { equals: '  test  ' } });
  });

  it('NUMBER — parses integer', () => {
    const field = makeField('f1', 'count', 'NUMBER');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: '42' })],
      fieldMap(field),
    );
    expect(result).toEqual({ count: { equals: 42 } });
  });

  it('NUMBER — parses float', () => {
    const field = makeField('f1', 'rate', 'NUMBER');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: '3.14' })],
      fieldMap(field),
    );
    expect(result).toEqual({ rate: { equals: 3.14 } });
  });

  it('NUMBER — invalid string returns empty where', () => {
    const field = makeField('f1', 'count', 'NUMBER');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: 'not-a-number' })],
      fieldMap(field),
    );
    expect(result).toEqual({});
  });

  it('DATE — parses ISO date string', () => {
    const field = makeField('f1', 'dueDate', 'DATE');
    const result = buildPrismaWhere(
      [
        makeCondition({
          dataViewFieldId: 'f1',
          operator: 'EQUALS',
          value: '2026-03-15T00:00:00.000Z',
        }),
      ],
      fieldMap(field),
    );
    expect(result).toEqual({ dueDate: { equals: new Date('2026-03-15T00:00:00.000Z') } });
  });

  it('BOOLEAN — parses "true"', () => {
    const field = makeField('f1', 'active', 'BOOLEAN');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: 'true' })],
      fieldMap(field),
    );
    expect(result).toEqual({ active: { equals: true } });
  });

  it('BOOLEAN — parses "True" (case-insensitive)', () => {
    const field = makeField('f1', 'active', 'BOOLEAN');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: 'True' })],
      fieldMap(field),
    );
    expect(result).toEqual({ active: { equals: true } });
  });

  it('ENUM — case-sensitive string comparison', () => {
    const field = makeField('f1', 'status', 'ENUM');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: 'POSTED' })],
      fieldMap(field),
    );
    expect(result).toEqual({ status: { equals: 'POSTED' } });
  });

  it('CURRENCY — numeric parsing', () => {
    const field = makeField('f1', 'total', 'CURRENCY');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'GTE', value: '1500.00' })],
      fieldMap(field),
    );
    expect(result).toEqual({ total: { gte: 1500 } });
  });

  it('IN — parses number valueList', () => {
    const field = makeField('f1', 'count', 'NUMBER');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'IN', valueList: ['1', '2', '3'] })],
      fieldMap(field),
    );
    expect(result).toEqual({ count: { in: [1, 2, 3] } });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('filter-builder: edge cases', () => {
  it('empty conditions returns empty where', () => {
    expect(buildPrismaWhere([], new Map())).toEqual({});
  });

  it('null conditions returns empty where', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildPrismaWhere(null as any, new Map())).toEqual({});
  });

  it('condition with unknown field is skipped', () => {
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'unknown', operator: 'EQUALS', value: 'test' })],
      new Map(),
    );
    expect(result).toEqual({});
  });

  it('condition with null value for EQUALS is skipped', () => {
    const field = makeField('f1', 'name', 'STRING');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: null })],
      fieldMap(field),
    );
    expect(result).toEqual({});
  });

  it('CONTAINS with empty value is skipped', () => {
    const field = makeField('f1', 'name', 'STRING');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'CONTAINS', value: '' })],
      fieldMap(field),
    );
    expect(result).toEqual({});
  });

  it('IN with empty valueList is skipped', () => {
    const field = makeField('f1', 'status', 'ENUM');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'IN', valueList: [] })],
      fieldMap(field),
    );
    expect(result).toEqual({});
  });

  it('BETWEEN with invalid JSON value is skipped', () => {
    const field = makeField('f1', 'amount', 'NUMBER');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'BETWEEN', value: 'not-json' })],
      fieldMap(field),
    );
    expect(result).toEqual({});
  });

  it('mixed valid and invalid conditions — valid ones still produce output', () => {
    const stringField = makeField('f1', 'name', 'STRING');
    const numberField = makeField('f2', 'amount', 'NUMBER');
    const fields = fieldMap(stringField, numberField);

    const conditions: FilterCondition[] = [
      makeCondition({
        dataViewFieldId: 'f1',
        operator: 'EQUALS',
        value: 'Acme',
        conditionOrder: 0,
      }),
      makeCondition({
        dataViewFieldId: 'f2',
        operator: 'EQUALS',
        value: 'not-a-number',
        conditionOrder: 1,
      }), // invalid
    ];

    const result = buildPrismaWhere(conditions, fields, 'AND');
    // Only the valid condition should appear
    expect(result).toEqual({ name: { equals: 'Acme' } });
  });
});

// ---------------------------------------------------------------------------
// Nested field resolution
// ---------------------------------------------------------------------------

describe('filter-builder: nested fields', () => {
  it('dot-notation field key produces nested where', () => {
    const field = makeField('f1', 'customer.name', 'STRING');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'CONTAINS', value: 'Acme' })],
      fieldMap(field),
    );
    expect(result).toEqual({ customer: { name: { contains: 'Acme', mode: 'insensitive' } } });
  });

  it('deeply nested field key', () => {
    const field = makeField('f1', 'order.customer.address.city', 'STRING');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: 'London' })],
      fieldMap(field),
    );
    expect(result).toEqual({
      order: { customer: { address: { city: { equals: 'London' } } } },
    });
  });

  it('simple (non-nested) field key', () => {
    const field = makeField('f1', 'email', 'STRING');
    const result = buildPrismaWhere(
      [makeCondition({ dataViewFieldId: 'f1', operator: 'EQUALS', value: 'a@b.com' })],
      fieldMap(field),
    );
    expect(result).toEqual({ email: { equals: 'a@b.com' } });
  });
});

// ---------------------------------------------------------------------------
// Complex scenario (integration-style)
// ---------------------------------------------------------------------------

describe('filter-builder: complex scenario', () => {
  it('multi-group with mixed types and date presets', () => {
    const statusField = makeField('f1', 'status', 'ENUM');
    const amountField = makeField('f2', 'totalAmount', 'CURRENCY');
    const dateField = makeField('f3', 'transactionDate', 'DATE');
    const fields = fieldMap(statusField, amountField, dateField);

    const presets = new Map<string, DatePresetInfo>([
      ['p-thismonth', { id: 'p-thismonth', presetKey: 'thismonth' }],
    ]);

    const conditions: FilterCondition[] = [
      // Group 0: status = POSTED AND amount > 1000
      makeCondition({
        dataViewFieldId: 'f1',
        operator: 'EQUALS',
        value: 'POSTED',
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 0,
      }),
      makeCondition({
        dataViewFieldId: 'f2',
        operator: 'GT',
        value: '1000',
        groupId: 0,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 1,
      }),
      // Group 1: transactionDate in this month (date preset)
      makeCondition({
        dataViewFieldId: 'f3',
        operator: 'BETWEEN',
        datePresetId: 'p-thismonth',
        groupId: 1,
        groupLogic: 'AND',
        outerLogic: 'AND',
        conditionOrder: 2,
      }),
    ];

    const result = buildPrismaWhere(conditions, fields, 'AND', presets);

    expect(result).toEqual({
      AND: [
        {
          AND: [{ status: { equals: 'POSTED' } }, { totalAmount: { gt: 1000 } }],
        },
        {
          transactionDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
      ],
    });
  });
});
