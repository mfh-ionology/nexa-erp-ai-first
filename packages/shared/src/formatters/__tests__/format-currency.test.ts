import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../format-currency.js';

describe('formatCurrency', () => {
  it('formats GBP in en-GB locale', () => {
    const result = formatCurrency(1234.56, 'GBP', 'en-GB');
    expect(result).toContain('£');
    expect(result).toContain('1,234.56');
  });

  it('formats GBP with explicit minorUnit: 2', () => {
    const result = formatCurrency(1234.56, 'GBP', 'en-GB', { minorUnit: 2 });
    expect(result).toContain('£');
    expect(result).toContain('1,234.56');
  });

  it('formats JPY with minorUnit: 0 (no decimals)', () => {
    const result = formatCurrency(1234, 'JPY', 'en-GB', { minorUnit: 0 });
    expect(result).toContain('¥');
    expect(result).toContain('1,234');
    expect(result).not.toContain('.');
  });

  it('formats BHD with minorUnit: 3 (three decimal places)', () => {
    const result = formatCurrency(1234.567, 'BHD', 'en-GB', { minorUnit: 3 });
    expect(result).toContain('1,234.567');
  });

  it('formats negative amounts', () => {
    const result = formatCurrency(-500.0, 'GBP', 'en-GB');
    expect(result).toContain('500.00');
    expect(result).toMatch(/-/);
  });

  it('formats zero amount', () => {
    const result = formatCurrency(0, 'GBP', 'en-GB');
    expect(result).toContain('£');
    expect(result).toContain('0.00');
  });

  it('accepts string amount from API (Decimal string)', () => {
    const result = formatCurrency('1234.5600', 'GBP', 'en-GB');
    const numericResult = formatCurrency(1234.56, 'GBP', 'en-GB');
    expect(result).toBe(numericResult);
  });

  it('returns empty string for NaN input', () => {
    expect(formatCurrency('not-a-number', 'GBP', 'en-GB')).toBe('');
  });

  it('returns empty string for Infinity', () => {
    expect(formatCurrency(Infinity, 'GBP', 'en-GB')).toBe('');
    expect(formatCurrency(-Infinity, 'GBP', 'en-GB')).toBe('');
  });

  it('returns empty string for invalid currency code', () => {
    expect(formatCurrency(100, 'INVALID', 'en-GB')).toBe('');
  });

  it('accepts CurrencyInfo object with automatic minorUnit', () => {
    const gbp = { code: 'GBP', symbol: '£', minorUnit: 2 };
    const result = formatCurrency(1234.56, gbp, 'en-GB');
    expect(result).toContain('£');
    expect(result).toContain('1,234.56');
  });

  it('uses CurrencyInfo.minorUnit for JPY (0 decimals)', () => {
    const jpy = { code: 'JPY', symbol: '¥', minorUnit: 0 };
    const result = formatCurrency(1234, jpy, 'en-GB');
    expect(result).toContain('¥');
    expect(result).not.toContain('.');
  });

  it('allows options.minorUnit to override CurrencyInfo.minorUnit', () => {
    const gbp = { code: 'GBP', symbol: '£', minorUnit: 2 };
    const result = formatCurrency(1234.5, gbp, 'en-GB', { minorUnit: 0 });
    expect(result).toContain('£');
    expect(result).not.toContain('.');
  });

  it('displays currency code when useSymbol is false', () => {
    const result = formatCurrency(1234.56, 'GBP', 'en-GB', { useSymbol: false });
    expect(result).toContain('GBP');
    expect(result).not.toContain('£');
  });

  it('formats large numbers with correct thousands grouping', () => {
    const result = formatCurrency(1000000.0, 'GBP', 'en-GB');
    expect(result).toContain('£');
    expect(result).toContain('1,000,000.00');
  });
});
