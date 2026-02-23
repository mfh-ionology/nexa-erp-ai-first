import { describe, it, expect } from 'vitest';
import { formatNumber } from '../format-number.js';

describe('formatNumber', () => {
  it('formats number with thousands separator in en-GB', () => {
    expect(formatNumber(1234.56, 'en-GB')).toBe('1,234.56');
  });

  it('formats integer with thousands separator', () => {
    expect(formatNumber(1000, 'en-GB')).toBe('1,000');
  });

  it('formats negative numbers', () => {
    const result = formatNumber(-1234.56, 'en-GB');
    expect(result).toContain('1,234.56');
    expect(result).toMatch(/-/);
  });

  it('formats zero', () => {
    expect(formatNumber(0, 'en-GB')).toBe('0');
  });

  it('returns empty string for NaN', () => {
    expect(formatNumber(NaN, 'en-GB')).toBe('');
  });

  it('returns "Infinity" for Infinity', () => {
    expect(formatNumber(Infinity, 'en-GB')).toBe('Infinity');
  });

  it('returns "-Infinity" for negative Infinity', () => {
    expect(formatNumber(-Infinity, 'en-GB')).toBe('-Infinity');
  });

  it('supports custom options (style: percent)', () => {
    expect(formatNumber(0.5, 'en-GB', { style: 'percent' })).toBe('50%');
  });

  it('supports minimumFractionDigits option', () => {
    expect(formatNumber(1234.5, 'en-GB', { minimumFractionDigits: 2 })).toBe('1,234.50');
  });
});
