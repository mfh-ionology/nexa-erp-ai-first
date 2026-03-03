import { describe, expect, it } from 'vitest';

import type { EntityTrigger } from '../types';
import { detectMention } from '../use-mention-detection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrigger(overrides: Partial<EntityTrigger> = {}): EntityTrigger {
  return {
    id: 'trigger-1',
    moduleKey: 'test',
    triggerWord: 'contact',
    entityType: 'Contact',
    searchEndpoint: '/api/contacts/search',
    displayField: 'fullName',
    subtitleField: 'email',
    scopeBy: null,
    icon: null,
    priority: 100,
    ...overrides,
  };
}

function buildTriggerMap(triggers: EntityTrigger[]): Map<string, EntityTrigger> {
  const map = new Map<string, EntityTrigger>();
  for (const trigger of triggers) {
    map.set(trigger.triggerWord.toLowerCase(), trigger);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectMention', () => {
  const contactTrigger = makeTrigger();
  const invoiceTrigger = makeTrigger({
    id: 'trigger-2',
    triggerWord: 'invoice',
    entityType: 'Invoice',
    searchEndpoint: '/api/invoices/search',
    displayField: 'invoiceNumber',
    subtitleField: 'customerName',
  });
  const customerTrigger = makeTrigger({
    id: 'trigger-3',
    triggerWord: 'customer',
    entityType: 'Customer',
    searchEndpoint: '/api/customers/search',
    displayField: 'name',
    subtitleField: null,
  });
  const savedViewTrigger = makeTrigger({
    id: 'trigger-4',
    triggerWord: 'saved view',
    entityType: 'SavedView',
    searchEndpoint: '/api/saved-views/search',
    displayField: 'name',
    subtitleField: null,
  });

  const triggerMap = buildTriggerMap([
    contactTrigger,
    invoiceTrigger,
    customerTrigger,
    savedViewTrigger,
  ]);

  it('detects single-word trigger: "send to contact jo" → trigger="contact", query="jo"', () => {
    const result = detectMention(triggerMap, 'send to contact jo');
    expect(result).not.toBeNull();
    expect(result!.trigger.triggerWord).toBe('contact');
    expect(result!.searchQuery).toBe('jo');
  });

  it('detects multi-word trigger: "open saved view over" → trigger="saved view", query="over"', () => {
    const result = detectMention(triggerMap, 'open saved view over');
    expect(result).not.toBeNull();
    expect(result!.trigger.triggerWord).toBe('saved view');
    expect(result!.searchQuery).toBe('over');
  });

  it('returns null when query is too short (< 2 chars): "send to contact j"', () => {
    const result = detectMention(triggerMap, 'send to contact j');
    expect(result).toBeNull();
  });

  it('returns null without a trigger word: "hello world"', () => {
    const result = detectMention(triggerMap, 'hello world');
    expect(result).toBeNull();
  });

  it('is case-insensitive: "send to Contact jo" detects "contact"', () => {
    const result = detectMention(triggerMap, 'send to Contact jo');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('Contact');
    expect(result!.searchQuery).toBe('jo');
  });

  it('last trigger wins: "customer acme contact jo" → trigger="contact" (not "customer")', () => {
    const result = detectMention(triggerMap, 'customer acme contact jo');
    expect(result).not.toBeNull();
    expect(result!.trigger.triggerWord).toBe('contact');
    expect(result!.searchQuery).toBe('jo');
  });

  it('enforces word boundary: "invoices are ready" → null ("invoices" ≠ "invoice")', () => {
    const result = detectMention(triggerMap, 'invoices are ready');
    expect(result).toBeNull();
  });

  it('returns null for empty input', () => {
    const result = detectMention(triggerMap, '');
    expect(result).toBeNull();
  });

  it('returns null for empty trigger map', () => {
    const result = detectMention(new Map(), 'send to contact jo');
    expect(result).toBeNull();
  });

  it('returns null when trigger word is at end with no search query', () => {
    const result = detectMention(triggerMap, 'look up invoice');
    expect(result).toBeNull();
  });

  it('returns null when trigger is followed by space but no query text', () => {
    const result = detectMention(triggerMap, 'look up invoice ');
    expect(result).toBeNull();
  });

  it('returns the correct triggerStartIndex', () => {
    const result = detectMention(triggerMap, 'send to contact john');
    expect(result).not.toBeNull();
    // "send to contact john"
    //  0123456789...
    // "contact" starts at index 8
    expect(result!.triggerStartIndex).toBe(8);
  });

  it('handles input with only a trigger word and query', () => {
    const result = detectMention(triggerMap, 'invoice 1042');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('Invoice');
    expect(result!.searchQuery).toBe('1042');
  });

  it('trims trailing whitespace from the search query', () => {
    const result = detectMention(triggerMap, 'find customer acme  ');
    expect(result).not.toBeNull();
    expect(result!.searchQuery).toBe('acme');
  });
});
