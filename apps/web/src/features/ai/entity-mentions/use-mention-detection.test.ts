import { describe, expect, it } from 'vitest';

import type { EntityTrigger } from './types';
import { detectMention } from './use-mention-detection';

describe('detectMention with // trigger', () => {
  const triggerMap = new Map<string, EntityTrigger>([
    [
      'customer',
      {
        id: '1',
        moduleKey: 'sales',
        triggerWord: 'customer',
        entityType: 'Customer',
        searchEndpoint: '/search',
        displayField: 'name',
        subtitleField: null,
        scopeBy: null,
        icon: null,
        priority: 10,
      },
    ],
    [
      'account',
      {
        id: '2',
        moduleKey: 'finance',
        triggerWord: 'account',
        entityType: 'ChartOfAccount',
        searchEndpoint: '/search',
        displayField: 'name',
        subtitleField: null,
        scopeBy: null,
        icon: null,
        priority: 10,
      },
    ],
    [
      'dimension',
      {
        id: '3',
        moduleKey: 'finance',
        triggerWord: 'dimension',
        entityType: 'DimensionValue',
        searchEndpoint: '/search',
        displayField: 'name',
        subtitleField: null,
        scopeBy: null,
        icon: null,
        priority: 10,
      },
    ],
  ]);

  it('detects // with context word "customer"', () => {
    const result = detectMention(triggerMap, 'run report for customer //POL');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('Customer');
    expect(result!.searchQuery).toBe('POL');
  });

  it('detects // with context word "account"', () => {
    const result = detectMention(triggerMap, 'show account //100');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('ChartOfAccount');
    expect(result!.searchQuery).toBe('100');
  });

  it('returns null when no // present', () => {
    const result = detectMention(
      triggerMap,
      'I want to communicate with a customer about an invoice',
    );
    expect(result).toBeNull();
  });

  it('returns null when // has less than 2 chars after it', () => {
    const result = detectMention(triggerMap, 'customer //P');
    expect(result).toBeNull();
  });

  it('uses universal search when no context word matches', () => {
    const result = detectMention(triggerMap, 'find //POL');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('_universal');
    expect(result!.searchQuery).toBe('POL');
  });

  it('handles // at start of input with context word', () => {
    const result = detectMention(triggerMap, 'customer //Polish');
    expect(result).not.toBeNull();
    expect(result!.searchQuery).toBe('Polish');
  });

  it('returns null for empty input', () => {
    const result = detectMention(triggerMap, '');
    expect(result).toBeNull();
  });

  it('falls back to universal search with empty trigger map', () => {
    const result = detectMention(new Map(), 'customer //POL');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('_universal');
    expect(result!.searchQuery).toBe('POL');
  });

  it('detects // with context word "dimension"', () => {
    const result = detectMention(triggerMap, 'filter by dimension //Sales');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('DimensionValue');
    expect(result!.searchQuery).toBe('Sales');
  });

  it('uses last occurrence of // when multiple present', () => {
    const result = detectMention(triggerMap, 'customer //old text account //New');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('ChartOfAccount');
    expect(result!.searchQuery).toBe('New');
  });

  it('sets correct triggerStartIndex for scoped search', () => {
    const result = detectMention(triggerMap, 'show customer //POL');
    expect(result).not.toBeNull();
    // "show " is 5 chars, "customer" starts at index 5
    expect(result!.triggerStartIndex).toBe(5);
  });

  it('sets triggerStartIndex to // position for universal search', () => {
    const result = detectMention(triggerMap, 'find //POL');
    expect(result).not.toBeNull();
    // "find " is 5 chars, "//" starts at index 5
    expect(result!.triggerStartIndex).toBe(5);
  });

  it('is case-insensitive for context word matching', () => {
    // The triggerMap keys are lowercase; context word is extracted as lowercase
    const result = detectMention(triggerMap, 'show Customer //POL');
    // "Customer" lowercased → "customer" matches triggerMap
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('Customer');
  });

  it('trims trailing whitespace from search query', () => {
    const result = detectMention(triggerMap, 'customer //POL   ');
    expect(result).not.toBeNull();
    expect(result!.searchQuery).toBe('POL');
  });

  it('returns null when // is at end of input with no query', () => {
    const result = detectMention(triggerMap, 'customer //');
    expect(result).toBeNull();
  });

  it('does not trigger on bare words without //', () => {
    const result = detectMention(triggerMap, 'customer polaris');
    expect(result).toBeNull();
  });
});
