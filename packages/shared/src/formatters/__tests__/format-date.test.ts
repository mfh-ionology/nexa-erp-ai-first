import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from '../format-date.js';

describe('formatDate', () => {
  it('formats date as short (default) in en-GB', () => {
    expect(formatDate('2026-02-17', 'en-GB')).toBe('17/02/2026');
  });

  it('formats date with explicit short preset in en-GB', () => {
    expect(formatDate('2026-02-17', 'en-GB', 'short')).toBe('17/02/2026');
  });

  it('formats date as medium in en-GB', () => {
    expect(formatDate('2026-02-17', 'en-GB', 'medium')).toBe('17 Feb 2026');
  });

  it('formats date as long in en-GB', () => {
    expect(formatDate('2026-02-17', 'en-GB', 'long')).toBe('17 February 2026');
  });

  it('accepts Date object input', () => {
    expect(formatDate(new Date('2026-02-17'), 'en-GB')).toBe('17/02/2026');
  });

  it('accepts ISO 8601 string with time component', () => {
    expect(formatDate('2026-02-17T10:30:00Z', 'en-GB')).toBe('17/02/2026');
  });

  it('returns empty string for invalid date string', () => {
    expect(formatDate('not-a-date', 'en-GB')).toBe('');
  });
});

describe('formatDateTime', () => {
  it('formats date-time as short in en-GB (includes time)', () => {
    const result = formatDateTime('2026-02-17T10:30:00Z', 'en-GB', 'short');
    expect(result).toContain('17/02/2026');
    expect(result).toMatch(/10:30/);
  });

  it('formats date-time as long in en-GB (includes seconds)', () => {
    const result = formatDateTime('2026-02-17T10:30:45Z', 'en-GB', 'long');
    expect(result).toContain('17 February 2026');
    expect(result).toMatch(/10:30:45/);
  });

  it('returns empty string for invalid date', () => {
    expect(formatDateTime('not-a-date', 'en-GB')).toBe('');
  });
});
