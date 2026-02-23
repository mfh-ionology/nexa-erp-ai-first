/** Formatting-relevant fields from the Currency model. */
export type CurrencyInfo = {
  code: string;
  symbol: string;
  minorUnit: number;
};

/** Preset names for date formatting. */
export type DateFormatPreset = 'short' | 'medium' | 'long';

/** Optional overrides for formatCurrency(). */
export type FormatCurrencyOptions = {
  /** Override Intl's default decimal places for the currency. */
  minorUnit?: number;
  /** If false, display currency code instead of symbol. Defaults to true. */
  useSymbol?: boolean;
};

/** Pass-through options for formatNumber(). */
export type FormatNumberOptions = Intl.NumberFormatOptions;
