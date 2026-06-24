/**
 * Print Formatter Utilities
 * 
 * This module provides utility functions for formatting data in print layouts.
 * These functions handle date formatting, percentage calculations, report type
 * mapping, and null value handling for the admin reports print functionality.
 */

/**
 * Formats a date string for display in print layout
 * 
 * @param dateString - ISO date string (e.g., "2024-10-01")
 * @returns Formatted date string (e.g., "October 1, 2024")
 * 
 * @example
 * formatPrintDate("2024-10-01") // Returns "October 1, 2024"
 */
export function formatPrintDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formats a timestamp for print footer
 * 
 * @param date - Date object to format
 * @returns Formatted timestamp string (e.g., "October 1, 2024, 02:30 PM")
 * 
 * @example
 * formatPrintTimestamp(new Date()) // Returns "October 1, 2024, 02:30 PM"
 */
export function formatPrintTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Calculates percentage for category distribution
 * 
 * @param value - The value to calculate percentage for
 * @param total - The total value to calculate percentage against
 * @returns Formatted percentage string (e.g., "37.5%")
 * 
 * @example
 * calculatePercentage(15, 40) // Returns "37.5%"
 * calculatePercentage(0, 0)   // Returns "0%"
 */
export function calculatePercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

/**
 * Formats report type for display
 * 
 * @param type - Report type code (e.g., "all", "trainees", "items", "lendings")
 * @returns Human-readable report type name
 * 
 * @example
 * formatReportType("all")      // Returns "All Activity"
 * formatReportType("trainees") // Returns "Trainees Only"
 */
export function formatReportType(type: string): string {
  const typeMap: Record<string, string> = {
    'all': 'All Activity',
    'trainees': 'Trainees Only',
    'items': 'Items Only',
    'lendings': 'Lendings Only'
  };
  return typeMap[type] || type;
}

/**
 * Handles null/undefined values for print display
 * 
 * @param value - Any value that might be null, undefined, or empty
 * @returns String representation of the value or "N/A" for null/undefined/empty
 * 
 * @example
 * formatPrintValue(null)      // Returns "N/A"
 * formatPrintValue(undefined) // Returns "N/A"
 * formatPrintValue("")        // Returns "N/A"
 * formatPrintValue(42)        // Returns "42"
 * formatPrintValue("text")    // Returns "text"
 */
export function formatPrintValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  return String(value);
}
