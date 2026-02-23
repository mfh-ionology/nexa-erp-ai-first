import { describe, expect, it } from 'vitest';

import {
  briefingItemSchema,
  briefingQuerySchema,
  briefingResponseSchema,
  suggestionChipSchema,
  suggestionsBodySchema,
  suggestionsResponseSchema,
} from './briefing.schema.js';

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

describe('briefingQuerySchema', () => {
  it('defaults forceRefresh to false when omitted', () => {
    const result = briefingQuerySchema.parse({});
    expect(result.forceRefresh).toBe(false);
  });

  it('parses forceRefresh string "true" to boolean', () => {
    const result = briefingQuerySchema.parse({ forceRefresh: 'true' });
    expect(result.forceRefresh).toBe(true);
  });

  it('parses forceRefresh string "false" to boolean', () => {
    const result = briefingQuerySchema.parse({ forceRefresh: 'false' });
    expect(result.forceRefresh).toBe(false);
  });

  it('passes boolean true directly', () => {
    const result = briefingQuerySchema.parse({ forceRefresh: true });
    expect(result.forceRefresh).toBe(true);
  });

  it('parses forceRefresh string "1" to true', () => {
    const result = briefingQuerySchema.parse({ forceRefresh: '1' });
    expect(result.forceRefresh).toBe(true);
  });

  it('parses forceRefresh string "0" to false', () => {
    const result = briefingQuerySchema.parse({ forceRefresh: '0' });
    expect(result.forceRefresh).toBe(false);
  });

  it('rejects arbitrary string values for forceRefresh', () => {
    const result = briefingQuerySchema.safeParse({ forceRefresh: 'maybe' });
    expect(result.success).toBe(false);
  });
});

describe('suggestionsBodySchema', () => {
  it('accepts empty body (all optional)', () => {
    const result = suggestionsBodySchema.parse({});
    expect(result).toEqual({});
  });

  it('accepts full body', () => {
    const input = {
      entityType: 'Customer',
      entityId: 'cust-123',
      pageRoute: '/ar/customers/cust-123',
    };
    const result = suggestionsBodySchema.parse(input);
    expect(result).toEqual(input);
  });

  it('rejects entityType exceeding max length', () => {
    const result = suggestionsBodySchema.safeParse({
      entityType: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects entityId exceeding max length', () => {
    const result = suggestionsBodySchema.safeParse({
      entityId: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects pageRoute exceeding max length', () => {
    const result = suggestionsBodySchema.safeParse({
      pageRoute: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Response schemas — briefing
// ---------------------------------------------------------------------------

const validBriefingItem = {
  id: 'item-1',
  title: '3 Overdue Invoices',
  description: 'Total outstanding: £12,400',
  category: 'overdue',
  priority: 'high' as const,
  metric: {
    value: '£12,400',
    delta: '+12%',
    trend: 'up' as const,
    comparisonPeriod: 'vs last month',
  },
  actions: [
    {
      label: 'Chase',
      actionType: 'chase' as const,
      entityType: 'CustomerInvoice',
      entityIds: ['inv-1', 'inv-2', 'inv-3'],
    },
    {
      label: 'View All',
      actionType: 'navigate' as const,
      route: '/ar/invoices?status=overdue',
    },
  ],
  entityLink: {
    entityType: 'CustomerInvoice',
    route: '/ar/invoices?status=overdue',
  },
};

const validBriefingResponse = {
  generatedAt: '2026-02-23T08:00:00Z',
  userId: 'user-1',
  role: 'FINANCE' as const,
  greeting: 'Good morning, Mohammed.',
  summary: 'You have 3 overdue invoices and 2 pending approvals.',
  items: [validBriefingItem],
  cachedAt: '2026-02-23T06:00:00Z',
  isStale: false,
};

describe('briefingItemSchema', () => {
  it('validates a complete briefing item', () => {
    const result = briefingItemSchema.safeParse(validBriefingItem);
    expect(result.success).toBe(true);
  });

  it('validates item without optional fields', () => {
    const minimal = {
      id: 'item-1',
      title: 'System Health OK',
      description: 'All services operational',
      category: 'system',
      priority: 'low',
      actions: [],
    };
    const result = briefingItemSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('rejects invalid priority value', () => {
    const invalid = { ...validBriefingItem, priority: 'critical' };
    const result = briefingItemSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = briefingItemSchema.safeParse({ id: 'item-1' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid action type', () => {
    const invalid = {
      ...validBriefingItem,
      actions: [{ label: 'Do', actionType: 'destroy' }],
    };
    const result = briefingItemSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates metric with only required value field', () => {
    const item = {
      ...validBriefingItem,
      metric: { value: '£5,000' },
    };
    const result = briefingItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects invalid trend value in metric', () => {
    const item = {
      ...validBriefingItem,
      metric: { value: '£5,000', trend: 'sideways' },
    };
    const result = briefingItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

describe('briefingResponseSchema', () => {
  it('validates a complete briefing response', () => {
    const result = briefingResponseSchema.safeParse(validBriefingResponse);
    expect(result.success).toBe(true);
  });

  it('validates response without optional cached fields', () => {
    const { cachedAt, isStale, ...minimal } = validBriefingResponse;
    const result = briefingResponseSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('validates all role values', () => {
    for (const role of ['OWNER', 'FINANCE', 'SALES', 'HR', 'WAREHOUSE', 'ADMIN']) {
      const response = { ...validBriefingResponse, role };
      const result = briefingResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    const invalid = { ...validBriefingResponse, role: 'MANAGER' };
    const result = briefingResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing greeting', () => {
    const { greeting, ...noGreeting } = validBriefingResponse;
    const result = briefingResponseSchema.safeParse(noGreeting);
    expect(result.success).toBe(false);
  });

  it('validates response with empty items array', () => {
    const response = { ...validBriefingResponse, items: [] };
    const result = briefingResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Response schemas — suggestions
// ---------------------------------------------------------------------------

const validSuggestionChip = {
  id: 'sug-1',
  label: 'Invoice this customer',
  prompt: 'Create a new invoice for customer CUST-001',
  category: 'action' as const,
  icon: 'receipt',
  priority: 1,
};

const validSuggestionsResponse = {
  entityType: 'Customer',
  entityId: 'cust-001',
  pageRoute: '/ar/customers/cust-001',
  suggestions: [validSuggestionChip],
};

describe('suggestionChipSchema', () => {
  it('validates a complete suggestion chip', () => {
    const result = suggestionChipSchema.safeParse(validSuggestionChip);
    expect(result.success).toBe(true);
  });

  it('validates chip without optional icon', () => {
    const { icon, ...noIcon } = validSuggestionChip;
    const result = suggestionChipSchema.safeParse(noIcon);
    expect(result.success).toBe(true);
  });

  it('validates all category values', () => {
    for (const category of ['action', 'query', 'navigation']) {
      const chip = { ...validSuggestionChip, category };
      const result = suggestionChipSchema.safeParse(chip);
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid category', () => {
    const invalid = { ...validSuggestionChip, category: 'other' };
    const result = suggestionChipSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing prompt', () => {
    const { prompt, ...noPrompt } = validSuggestionChip;
    const result = suggestionChipSchema.safeParse(noPrompt);
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric priority', () => {
    const invalid = { ...validSuggestionChip, priority: 'high' };
    const result = suggestionChipSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('suggestionsResponseSchema', () => {
  it('validates a complete suggestions response', () => {
    const result = suggestionsResponseSchema.safeParse(validSuggestionsResponse);
    expect(result.success).toBe(true);
  });

  it('validates response with only suggestions array', () => {
    const result = suggestionsResponseSchema.safeParse({
      suggestions: [validSuggestionChip],
    });
    expect(result.success).toBe(true);
  });

  it('validates response with empty suggestions', () => {
    const result = suggestionsResponseSchema.safeParse({ suggestions: [] });
    expect(result.success).toBe(true);
  });

  it('rejects missing suggestions array', () => {
    const result = suggestionsResponseSchema.safeParse({
      entityType: 'Customer',
    });
    expect(result.success).toBe(false);
  });
});
