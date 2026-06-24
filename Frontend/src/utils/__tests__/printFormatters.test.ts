/**
 * Unit Tests for Print Formatter Utilities
 * 
 * These tests verify the correct behavior of print formatting functions
 * used in the admin reports print functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  formatPrintDate,
  formatPrintTimestamp,
  calculatePercentage,
  formatReportType,
  formatPrintValue
} from '../printFormatters';

describe('formatPrintDate', () => {
  it('should convert ISO date to readable format', () => {
    const result = formatPrintDate('2024-10-01');
    expect(result).toBe('October 1, 2024');
  });

  it('should handle different months correctly', () => {
    expect(formatPrintDate('2024-01-15')).toBe('January 15, 2024');
    expect(formatPrintDate('2024-12-31')).toBe('December 31, 2024');
  });

  it('should handle leap year dates', () => {
    const result = formatPrintDate('2024-02-29');
    expect(result).toBe('February 29, 2024');
  });
});

describe('formatPrintTimestamp', () => {
  it('should include date and time with AM/PM', () => {
    const date = new Date('2024-10-01T14:30:00');
    const result = formatPrintTimestamp(date);
    expect(result).toContain('October 1, 2024');
    expect(result).toContain('02:30 PM');
  });

  it('should format morning times with AM', () => {
    const date = new Date('2024-10-01T09:15:00');
    const result = formatPrintTimestamp(date);
    expect(result).toContain('09:15 AM');
  });

  it('should format midnight correctly', () => {
    const date = new Date('2024-10-01T00:00:00');
    const result = formatPrintTimestamp(date);
    expect(result).toContain('12:00 AM');
  });
});

describe('calculatePercentage', () => {
  it('should return correct percentage string', () => {
    expect(calculatePercentage(15, 40)).toBe('37.5%');
  });

  it('should handle zero total by returning 0%', () => {
    expect(calculatePercentage(0, 0)).toBe('0%');
    expect(calculatePercentage(10, 0)).toBe('0%');
  });

  it('should round to one decimal place', () => {
    expect(calculatePercentage(1, 3)).toBe('33.3%');
    expect(calculatePercentage(2, 3)).toBe('66.7%');
  });

  it('should handle 100% correctly', () => {
    expect(calculatePercentage(100, 100)).toBe('100.0%');
  });

  it('should handle small percentages', () => {
    expect(calculatePercentage(1, 1000)).toBe('0.1%');
  });
});

describe('formatReportType', () => {
  it('should map "all" to "All Activity"', () => {
    expect(formatReportType('all')).toBe('All Activity');
  });

  it('should map "trainees" to "Trainees Only"', () => {
    expect(formatReportType('trainees')).toBe('Trainees Only');
  });

  it('should map "items" to "Items Only"', () => {
    expect(formatReportType('items')).toBe('Items Only');
  });

  it('should map "lendings" to "Lendings Only"', () => {
    expect(formatReportType('lendings')).toBe('Lendings Only');
  });

  it('should return original value for unknown types', () => {
    expect(formatReportType('unknown')).toBe('unknown');
    expect(formatReportType('custom-report')).toBe('custom-report');
  });
});

describe('formatPrintValue', () => {
  it('should return "N/A" for null', () => {
    expect(formatPrintValue(null)).toBe('N/A');
  });

  it('should return "N/A" for undefined', () => {
    expect(formatPrintValue(undefined)).toBe('N/A');
  });

  it('should return "N/A" for empty string', () => {
    expect(formatPrintValue('')).toBe('N/A');
  });

  it('should return string representation for valid values', () => {
    expect(formatPrintValue(42)).toBe('42');
    expect(formatPrintValue('text')).toBe('text');
    expect(formatPrintValue(true)).toBe('true');
    expect(formatPrintValue(false)).toBe('false');
  });

  it('should handle zero as a valid value', () => {
    expect(formatPrintValue(0)).toBe('0');
  });

  it('should handle objects by converting to string', () => {
    const obj = { key: 'value' };
    expect(formatPrintValue(obj)).toBe('[object Object]');
  });

  it('should handle arrays by converting to string', () => {
    expect(formatPrintValue([1, 2, 3])).toBe('1,2,3');
  });
});
