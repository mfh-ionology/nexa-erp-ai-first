import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    exchangeRate: {
      findFirst: vi.fn(),
    },
    companyProfile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  Prisma: {
    Decimal: class Decimal {
      private value: number;
      constructor(v: number | string) {
        this.value = Number(v);
      }
      toNumber() {
        return this.value;
      }
      toString() {
        return String(this.value);
      }
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  lookupExchangeRate,
  convertLineToBaseCurrency,
  convertLinesToBaseCurrency,
  getBaseCurrencyCode,
  calculateExchangeGainLoss,
  createExchangeGainLossLines,
} from './multi-currency.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';
const BASE_CURRENCY = 'GBP';
const TX_DATE = new Date('2025-06-15');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('multi-currency.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // lookupExchangeRate
  // =========================================================================

  describe('lookupExchangeRate', () => {
    it('should return the midRate from the latest exchange rate on or before the date', async () => {
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({
        midRate: 1.2345,
        rateDate: new Date('2025-06-14'),
      });

      const rate = await lookupExchangeRate(mockPrisma as any, TEST_COMPANY_ID, 'USD', TX_DATE);

      expect(rate).toBe(1.2345);
      expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: TEST_COMPANY_ID,
          currencyCode: 'USD',
          rateDate: { lte: TX_DATE },
        },
        orderBy: { rateDate: 'desc' },
        select: { midRate: true, rateDate: true },
      });
    });

    it('should throw EXCHANGE_RATE_NOT_FOUND when no rate exists', async () => {
      mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);

      await expect(
        lookupExchangeRate(mockPrisma as any, TEST_COMPANY_ID, 'JPY', TX_DATE),
      ).rejects.toThrow('No exchange rate found for JPY');
    });

    it('should handle Prisma Decimal midRate values', async () => {
      // Simulate a Prisma Decimal object
      const decimalValue = {
        toNumber() {
          return 0.8765;
        },
        toString() {
          return '0.8765';
        },
      };
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({
        midRate: decimalValue,
        rateDate: new Date('2025-06-15'),
      });

      const rate = await lookupExchangeRate(mockPrisma as any, TEST_COMPANY_ID, 'EUR', TX_DATE);

      expect(rate).toBe(0.8765);
    });
  });

  // =========================================================================
  // convertLineToBaseCurrency
  // =========================================================================

  describe('convertLineToBaseCurrency', () => {
    it('should pass through a line with no currencyCode unchanged', async () => {
      const line = {
        accountCode: '1100',
        debit: 100,
        credit: 0,
        description: 'Test',
      };

      const result = await convertLineToBaseCurrency(
        mockPrisma as any,
        TEST_COMPANY_ID,
        BASE_CURRENCY,
        TX_DATE,
        line,
      );

      expect(result.debit).toBe(100);
      expect(result.credit).toBe(0);
      expect(result.currencyCode).toBeNull();
      expect(result.foreignAmount).toBeNull();
      expect(result.exchangeRate).toBeNull();
    });

    it('should pass through a line with base currency unchanged', async () => {
      const line = {
        accountCode: '1100',
        debit: 200,
        credit: 0,
        currencyCode: 'GBP',
        foreignAmount: 200,
        exchangeRate: 1,
      };

      const result = await convertLineToBaseCurrency(
        mockPrisma as any,
        TEST_COMPANY_ID,
        BASE_CURRENCY,
        TX_DATE,
        line,
      );

      expect(result.debit).toBe(200);
      expect(result.credit).toBe(0);
      expect(result.currencyCode).toBe('GBP');
    });

    it('should convert foreign debit line using provided exchange rate (AC-2)', async () => {
      const line = {
        accountCode: '1200',
        debit: 0, // will be replaced by converted amount
        credit: 0,
        currencyCode: 'USD',
        foreignAmount: 1000, // 1000 USD
        exchangeRate: 0.79, // 1 USD = 0.79 GBP
      };

      const result = await convertLineToBaseCurrency(
        mockPrisma as any,
        TEST_COMPANY_ID,
        BASE_CURRENCY,
        TX_DATE,
        line,
      );

      // 1000 * 0.79 = 790 GBP
      expect(result.debit).toBe(790);
      expect(result.credit).toBe(0);
      expect(result.currencyCode).toBe('USD');
      expect(result.foreignAmount).toBe(1000);
      expect(result.exchangeRate).toBe(0.79);
    });

    it('should convert foreign credit line using provided exchange rate', async () => {
      const line = {
        accountCode: '4100',
        debit: 0,
        credit: 50, // explicit credit direction
        currencyCode: 'EUR',
        foreignAmount: 50,
        exchangeRate: 0.86,
      };

      const result = await convertLineToBaseCurrency(
        mockPrisma as any,
        TEST_COMPANY_ID,
        BASE_CURRENCY,
        TX_DATE,
        line,
      );

      // 50 * 0.86 = 43 GBP on credit side
      expect(result.debit).toBe(0);
      expect(result.credit).toBe(43);
      expect(result.exchangeRate).toBe(0.86);
    });

    it('should auto-fetch exchange rate when not provided (AC-3)', async () => {
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({
        midRate: 0.79,
        rateDate: new Date('2025-06-14'),
      });

      const line = {
        accountCode: '1200',
        debit: 100, // explicit debit direction
        credit: 0,
        currencyCode: 'USD',
        foreignAmount: 500, // 500 USD
        // exchangeRate intentionally omitted
      };

      const result = await convertLineToBaseCurrency(
        mockPrisma as any,
        TEST_COMPANY_ID,
        BASE_CURRENCY,
        TX_DATE,
        line,
      );

      // 500 * 0.79 = 395 GBP
      expect(result.debit).toBe(395);
      expect(result.credit).toBe(0);
      expect(result.exchangeRate).toBe(0.79);
      expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalled();
    });

    it('should throw FOREIGN_AMOUNT_REQUIRED when currencyCode set but no foreignAmount', async () => {
      const line = {
        accountCode: '1200',
        debit: 100,
        credit: 0,
        currencyCode: 'USD',
        // foreignAmount missing
      };

      await expect(
        convertLineToBaseCurrency(mockPrisma as any, TEST_COMPANY_ID, BASE_CURRENCY, TX_DATE, line),
      ).rejects.toThrow('no foreignAmount');
    });

    it('should throw INVALID_EXCHANGE_RATE for negative rate', async () => {
      const line = {
        accountCode: '1200',
        debit: 100,
        credit: 0,
        currencyCode: 'USD',
        foreignAmount: 500,
        exchangeRate: -0.5,
      };

      await expect(
        convertLineToBaseCurrency(mockPrisma as any, TEST_COMPANY_ID, BASE_CURRENCY, TX_DATE, line),
      ).rejects.toThrow('Exchange rate must be positive');
    });

    it('should derive debit direction from positive foreignAmount when both debit/credit are 0', async () => {
      const line = {
        accountCode: '1200',
        debit: 0,
        credit: 0,
        currencyCode: 'USD',
        foreignAmount: 250,
        exchangeRate: 0.8,
      };

      const result = await convertLineToBaseCurrency(
        mockPrisma as any,
        TEST_COMPANY_ID,
        BASE_CURRENCY,
        TX_DATE,
        line,
      );

      // 250 * 0.8 = 200 on debit side (positive foreignAmount = debit)
      expect(result.debit).toBe(200);
      expect(result.credit).toBe(0);
    });

    it('should derive credit direction from negative foreignAmount when both debit/credit are 0', async () => {
      const line = {
        accountCode: '4100',
        debit: 0,
        credit: 0,
        currencyCode: 'USD',
        foreignAmount: -250,
        exchangeRate: 0.8,
      };

      const result = await convertLineToBaseCurrency(
        mockPrisma as any,
        TEST_COMPANY_ID,
        BASE_CURRENCY,
        TX_DATE,
        line,
      );

      // abs(-250) * 0.8 = 200 on credit side (negative foreignAmount = credit)
      expect(result.debit).toBe(0);
      expect(result.credit).toBe(200);
    });

    it('should round base currency amounts to 4 decimal places', async () => {
      const line = {
        accountCode: '1200',
        debit: 100, // explicit debit
        credit: 0,
        currencyCode: 'USD',
        foreignAmount: 333.33,
        exchangeRate: 0.7891,
      };

      const result = await convertLineToBaseCurrency(
        mockPrisma as any,
        TEST_COMPANY_ID,
        BASE_CURRENCY,
        TX_DATE,
        line,
      );

      // 333.33 * 0.7891 = 263.030703 → 263.0307 rounded to 4dp
      expect(result.debit).toBe(263.0307);
      expect(result.credit).toBe(0);
    });

    it('should preserve dimensions through conversion', async () => {
      const dims = [{ dimensionValueId: 'dim-1' }, { dimensionValueId: 'dim-2' }];
      const line = {
        accountCode: '1200',
        debit: 100,
        credit: 0,
        currencyCode: 'USD',
        foreignAmount: 500,
        exchangeRate: 0.79,
        dimensions: dims,
      };

      const result = await convertLineToBaseCurrency(
        mockPrisma as any,
        TEST_COMPANY_ID,
        BASE_CURRENCY,
        TX_DATE,
        line,
      );

      expect(result.dimensions).toEqual(dims);
    });
  });

  // =========================================================================
  // convertLinesToBaseCurrency
  // =========================================================================

  describe('convertLinesToBaseCurrency', () => {
    it('should convert multiple lines with mixed currencies', async () => {
      mockPrisma.exchangeRate.findFirst.mockResolvedValue({
        midRate: 0.86,
        rateDate: new Date('2025-06-14'),
      });

      const lines = [
        {
          accountCode: '1200',
          debit: 100,
          credit: 0,
          currencyCode: 'USD',
          foreignAmount: 1000,
          exchangeRate: 0.79,
        },
        {
          accountCode: '4100',
          debit: 0,
          credit: 100,
          // no currencyCode — GBP line
        },
        {
          accountCode: '1300',
          debit: 50,
          credit: 0,
          currencyCode: 'EUR',
          foreignAmount: 500,
          // exchangeRate omitted — auto-fetch
        },
      ];

      const results = await convertLinesToBaseCurrency(
        mockPrisma as any,
        TEST_COMPANY_ID,
        BASE_CURRENCY,
        TX_DATE,
        lines,
      );

      expect(results).toHaveLength(3);
      // USD line: 1000 * 0.79 = 790
      expect(results[0]!.debit).toBe(790);
      expect(results[0]!.currencyCode).toBe('USD');
      // GBP line: unchanged
      expect(results[1]!.credit).toBe(100);
      expect(results[1]!.currencyCode).toBeNull();
      // EUR line: 500 * 0.86 = 430
      expect(results[2]!.debit).toBe(430);
      expect(results[2]!.currencyCode).toBe('EUR');
      expect(results[2]!.exchangeRate).toBe(0.86);
    });
  });

  // =========================================================================
  // getBaseCurrencyCode
  // =========================================================================

  describe('getBaseCurrencyCode', () => {
    it('should return the company base currency code', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue({
        baseCurrencyCode: 'GBP',
      });

      const code = await getBaseCurrencyCode(mockPrisma as any, TEST_COMPANY_ID);
      expect(code).toBe('GBP');
    });

    it('should throw COMPANY_NOT_FOUND when company does not exist', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(null);

      await expect(getBaseCurrencyCode(mockPrisma as any, 'nonexistent')).rejects.toThrow(
        'Company nonexistent not found',
      );
    });
  });

  // =========================================================================
  // calculateExchangeGainLoss (AC-4 stub)
  // =========================================================================

  describe('calculateExchangeGainLoss', () => {
    it('should calculate a gain when settlement rate is higher', () => {
      const result = calculateExchangeGainLoss(1000, 0.79, 0.82, 'USD');

      // 1000 * (0.82 - 0.79) = 30
      expect(result.amount).toBe(30);
      expect(result.originalRate).toBe(0.79);
      expect(result.settlementRate).toBe(0.82);
      expect(result.currencyCode).toBe('USD');
    });

    it('should calculate a loss when settlement rate is lower', () => {
      const result = calculateExchangeGainLoss(1000, 0.79, 0.76, 'USD');

      // 1000 * (0.76 - 0.79) = -30
      expect(result.amount).toBe(-30);
    });

    it('should return zero when rates are equal', () => {
      const result = calculateExchangeGainLoss(1000, 0.79, 0.79, 'USD');
      expect(result.amount).toBe(0);
    });

    it('should handle fractional amounts with rounding', () => {
      const result = calculateExchangeGainLoss(333.33, 0.7891, 0.7921, 'EUR');

      // 333.33 * (0.7921 - 0.7891) = 333.33 * 0.003 = 0.99999 → 1
      expect(result.amount).toBe(1);
    });
  });

  // =========================================================================
  // createExchangeGainLossLines (AC-4 stub)
  // =========================================================================

  describe('createExchangeGainLossLines', () => {
    it('should return an empty array (stub)', () => {
      const gainLoss = {
        amount: 30,
        originalRate: 0.79,
        settlementRate: 0.82,
        currencyCode: 'USD',
      };

      const lines = createExchangeGainLossLines(
        TEST_COMPANY_ID,
        gainLoss,
        '7800', // gain account
        '7801', // loss account
      );

      expect(lines).toEqual([]);
    });
  });
});
