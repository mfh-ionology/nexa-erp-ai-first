import Handlebars from 'handlebars';
import { formatDate, formatCurrency } from '@nexa/shared';

/**
 * Rendered notification content returned by the template engine.
 */
export interface RenderedNotification {
  title: string;
  body: string;
  actionUrl: string | null;
}

// Default locale for formatting helpers when none provided in context.
const DEFAULT_LOCALE = 'en-GB';
const DEFAULT_CURRENCY = 'GBP';

/**
 * Create a private Handlebars instance with custom helpers registered.
 *
 * Using an isolated instance avoids polluting the global Handlebars
 * namespace if other parts of the app use Handlebars independently.
 */
function createHandlebarsInstance(): typeof Handlebars {
  const hbs = Handlebars.create();

  /**
   * {{formatDate value [format] [locale]}}
   *
   * Formats a date/datetime value using @nexa/shared formatDate.
   * - format: 'short' (default), 'medium', 'long'
   * - locale: defaults to 'en-GB'
   */
  hbs.registerHelper('formatDate', function (value: unknown, ...args: unknown[]) {
    if (!value) return '';
    // Handlebars passes an options hash as the last argument
    const options = args[args.length - 1] as { hash?: Record<string, string> };
    const format = (typeof args[0] === 'string' ? args[0] : (options?.hash?.format ?? 'short')) as
      | 'short'
      | 'medium'
      | 'long';
    const locale =
      typeof args[1] === 'string' ? args[1] : (options?.hash?.locale ?? DEFAULT_LOCALE);
    return new hbs.SafeString(formatDate(value as Date | string, locale, format));
  });

  /**
   * {{formatMoney amount [currency] [locale]}}
   *
   * Formats a monetary value using @nexa/shared formatCurrency.
   * - currency: ISO 4217 code, defaults to 'GBP'
   * - locale: defaults to 'en-GB'
   */
  hbs.registerHelper('formatMoney', function (amount: unknown, ...args: unknown[]) {
    if (amount === null || amount === undefined) return '';
    const options = args[args.length - 1] as { hash?: Record<string, string> };
    const currency =
      typeof args[0] === 'string' ? args[0] : (options?.hash?.currency ?? DEFAULT_CURRENCY);
    const locale =
      typeof args[1] === 'string' ? args[1] : (options?.hash?.locale ?? DEFAULT_LOCALE);
    return new hbs.SafeString(formatCurrency(amount as string | number, currency, locale));
  });

  return hbs;
}

const hbs = createHandlebarsInstance();

/**
 * Compile and cache templates with LRU eviction.
 * Bounded to MAX_CACHE_SIZE entries to prevent unbounded growth in long-running servers.
 */
const MAX_CACHE_SIZE = 200;
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

function compileTemplate(template: string): HandlebarsTemplateDelegate {
  let compiled = templateCache.get(template);
  if (compiled) {
    // Move to end (most recently used) by re-inserting
    templateCache.delete(template);
    templateCache.set(template, compiled);
    return compiled;
  }
  compiled = hbs.compile(template);
  if (templateCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry (first key in insertion-order Map)
    const oldestKey = templateCache.keys().next().value;
    if (oldestKey !== undefined) templateCache.delete(oldestKey);
  }
  templateCache.set(template, compiled);
  return compiled;
}

/**
 * Render notification template content using Handlebars variable substitution.
 *
 * On template compilation or rendering error, returns a fallback with the raw
 * event name as title and JSON-serialised context as body (R-004 risk mitigation).
 *
 * @param titleTemplate   - Handlebars template string for the notification title
 * @param bodyTemplate    - Handlebars template string for the notification body
 * @param actionUrlTemplate - Handlebars template string for the action URL (nullable)
 * @param context         - Key-value data from the event payload used for substitution
 * @returns Rendered notification content
 */
export function renderNotificationTemplate(
  titleTemplate: string,
  bodyTemplate: string,
  actionUrlTemplate: string | null,
  context: Record<string, unknown>,
  logger?: { warn: (...args: unknown[]) => void },
): RenderedNotification {
  try {
    const title = compileTemplate(titleTemplate)(context);
    const body = compileTemplate(bodyTemplate)(context);
    const actionUrl = actionUrlTemplate ? compileTemplate(actionUrlTemplate)(context) : null;

    return { title, body, actionUrl };
  } catch (error) {
    const log = logger ?? console;
    const eventName = (context.eventName as string) ?? 'unknown_event';
    log.warn(
      `[template-renderer] Failed to render notification template: ${(error as Error).message}`,
      { eventName, titleTemplate, bodyTemplate },
    );
    return {
      title: eventName,
      body: JSON.stringify(context),
      actionUrl: null,
    };
  }
}
