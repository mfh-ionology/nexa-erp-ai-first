/* eslint-disable i18next/no-literal-string */
import { describe, it, expect } from 'vitest';

import { cronToHumanReadable } from './cron-builder';

describe('cronToHumanReadable', () => {
  // --- Common patterns ---

  it('converts "0 7 * * 1-5" to weekday morning schedule', () => {
    const result = cronToHumanReadable('0 7 * * 1-5');
    expect(result).toBe('At 7:00 AM, Monday through Friday');
  });

  it('converts "0 0 1 * *" to monthly on day 1', () => {
    const result = cronToHumanReadable('0 0 1 * *');
    expect(result).toBe('At 12:00 AM, on day 1 of the month');
  });

  it('converts "*/15 * * * *" to every 15 minutes', () => {
    const result = cronToHumanReadable('*/15 * * * *');
    expect(result).toBe('Every 15 minutes');
  });

  it('converts "* * * * *" to every minute', () => {
    const result = cronToHumanReadable('* * * * *');
    expect(result).toBe('Every minute');
  });

  it('converts "0 * * * *" to hourly', () => {
    const result = cronToHumanReadable('0 * * * *');
    expect(result).toBe('Every hour at :00');
  });

  it('converts "0 0 * * *" to daily at midnight', () => {
    const result = cronToHumanReadable('0 0 * * *');
    expect(result).toBe('At 12:00 AM');
  });

  it('converts "0 9 * * 1-5" to weekday at 9 AM', () => {
    const result = cronToHumanReadable('0 9 * * 1-5');
    expect(result).toBe('At 9:00 AM, Monday through Friday');
  });

  it('converts "0 0 * * 1" to weekly on Monday', () => {
    const result = cronToHumanReadable('0 0 * * 1');
    expect(result).toBe('At 12:00 AM, on Monday');
  });

  // --- PM times ---

  it('converts "0 14 * * *" to 2 PM', () => {
    const result = cronToHumanReadable('0 14 * * *');
    expect(result).toBe('At 2:00 PM');
  });

  it('converts "30 17 * * *" to 5:30 PM', () => {
    const result = cronToHumanReadable('30 17 * * *');
    expect(result).toBe('At 5:30 PM');
  });

  // --- Step values ---

  it('converts "*/5 * * * *" to every 5 minutes', () => {
    const result = cronToHumanReadable('*/5 * * * *');
    expect(result).toBe('Every 5 minutes');
  });

  // --- Weekend pattern ---

  it('converts "0 9 * * 0,6" to weekends', () => {
    const result = cronToHumanReadable('0 9 * * 0,6');
    expect(result).toBe('At 9:00 AM, on weekends');
  });

  // --- Day-of-month patterns ---

  it('converts "0 8 15 * *" to day 15', () => {
    const result = cronToHumanReadable('0 8 15 * *');
    expect(result).toBe('At 8:00 AM, on day 15 of the month');
  });

  // --- Month constraints ---

  it('converts "0 0 1 6 *" to June 1st', () => {
    const result = cronToHumanReadable('0 0 1 6 *');
    expect(result).toContain('12:00 AM');
    expect(result).toContain('Jun');
  });

  // --- Day-of-week comma-separated ---

  it('converts "0 9 * * 1,3,5" to specific days', () => {
    const result = cronToHumanReadable('0 9 * * 1,3,5');
    expect(result).toContain('9:00 AM');
    expect(result).toContain('Monday');
    expect(result).toContain('Wednesday');
    expect(result).toContain('Friday');
  });

  // --- Edge cases ---

  it('returns "Invalid cron expression" for empty string', () => {
    expect(cronToHumanReadable('')).toBe('Invalid cron expression');
  });

  it('returns "Invalid cron expression" for invalid cron with wrong field count', () => {
    expect(cronToHumanReadable('0 0 * *')).toBe('Invalid cron expression');
  });

  it('returns "Invalid cron expression" for malformed fields', () => {
    expect(cronToHumanReadable('abc def ghi jkl mno')).toBe('Invalid cron expression');
  });

  it('returns "Invalid cron expression" for too many fields', () => {
    expect(cronToHumanReadable('0 0 * * * *')).toBe('Invalid cron expression');
  });

  // --- Hourly at specific minute ---

  it('converts "30 * * * *" to hourly at :30', () => {
    const result = cronToHumanReadable('30 * * * *');
    expect(result).toBe('Every hour at :30');
  });

  // --- Every N hours ---

  it('converts "0 */2 * * *" to every 2 hours', () => {
    const result = cronToHumanReadable('0 */2 * * *');
    expect(result).toBe('Every 2 hours');
  });
});
