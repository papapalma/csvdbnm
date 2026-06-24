/**
 * Unit Tests for PrintableReport Component
 * 
 * This test suite validates the PrintableReport component and all its sub-components.
 * Tests cover rendering with valid props, data display, empty data handling, null value
 * handling, and date/report type formatting.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 3.8
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrintableReport, { PrintableReportProps } from '../PrintableReport';

/**
 * Helper function to create valid test props
 */
function createValidProps(): PrintableReportProps {
  return {
    reportTitle: 'Reports & Analytics',
    dateFrom: '2024-01-01',
    dateTo: '2024-01-31',
    reportType: 'all',
    generatedAt: '2024-01-31T15:30:00.000Z',
    summaryStats: {
      totalLendings: 127,
      itemsReturned: 98,
      activeLoans: 29,
      newTrainees: 34,
    },
    activityData: [
      { date: 'Jan 1', borrowed: 10, returned: 8 },
      { date: 'Jan 2', borrowed: 15, returned: 12 },
      { date: 'Jan 3', borrowed: 8, returned: 10 },
    ],
    categoryData: [
      { name: 'Tools', value: 45 },
      { name: 'Equipment', value: 30 },
      { name: 'Books', value: 25 },
    ],
    programData: [
      { program: 'Computer Literacy', trainees: 20 },
      { program: 'Welding', trainees: 15 },
      { program: 'Carpentry', trainees: 10 },
    ],
  };
}

describe('PrintableReport Component', () => {
  describe('Component Rendering with Valid Props', () => {
    it('should render the component with valid props', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      expect(container.querySelector('.print-container')).toBeInTheDocument();
    });

    it('should render the report title', () => {
      const props = createValidProps();
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
    });

    it('should render all sub-components', () => {
      const props = createValidProps();
      render(<PrintableReport {...props} />);
      
      // Check for section headings that indicate sub-components are rendered
      expect(screen.getByText('Summary Statistics')).toBeInTheDocument();
      expect(screen.getByText('Lending Activity Trend')).toBeInTheDocument();
      expect(screen.getByText('Items by Category')).toBeInTheDocument();
      expect(screen.getByText('Trainees by Program')).toBeInTheDocument();
    });
  });

  describe('PrintHeader Sub-component', () => {
    it('should display the report title correctly', () => {
      const props = createValidProps();
      render(<PrintableReport {...props} />);
      
      expect(screen.getByRole('heading', { level: 1, name: 'Reports & Analytics' })).toBeInTheDocument();
    });

    it('should render with custom report title', () => {
      const props = { ...createValidProps(), reportTitle: 'Custom Report Title' };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByRole('heading', { level: 1, name: 'Custom Report Title' })).toBeInTheDocument();
    });
  });

  describe('PrintMetadata Sub-component', () => {
    it('should display date range correctly', () => {
      const props = createValidProps();
      render(<PrintableReport {...props} />);
      
      // formatPrintDate converts "2024-01-01" to "January 1, 2024"
      expect(screen.getByText(/Date Range:/)).toBeInTheDocument();
      expect(screen.getByText(/January 1, 2024 - January 31, 2024/)).toBeInTheDocument();
    });

    it('should display report type correctly', () => {
      const props = createValidProps();
      render(<PrintableReport {...props} />);
      
      // formatReportType converts "all" to "All Activity"
      expect(screen.getByText(/Report Type:/)).toBeInTheDocument();
      expect(screen.getByText(/All Activity/)).toBeInTheDocument();
    });

    it('should display different report types correctly', () => {
      const reportTypes = [
        { type: 'trainees', expected: 'Trainees Only' },
        { type: 'items', expected: 'Items Only' },
        { type: 'lendings', expected: 'Lendings Only' },
      ];

      reportTypes.forEach(({ type, expected }) => {
        const props = { ...createValidProps(), reportType: type };
        const { unmount } = render(<PrintableReport {...props} />);
        
        expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
        unmount();
      });
    });

    it('should display generation timestamp', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      // formatPrintTimestamp converts ISO date to readable format
      // Use getAllByText since "Generated:" appears in both metadata and footer
      const generatedElements = screen.getAllByText(/Generated:/);
      expect(generatedElements.length).toBeGreaterThan(0);
      
      // Check that the metadata section contains the timestamp with time
      const metadata = container.querySelector('.print-metadata');
      expect(metadata?.textContent).toContain('January 31, 2024 at 11:30 PM');
    });
  });

  describe('SummaryStatsTable Sub-component', () => {
    it('should display all summary statistics', () => {
      const props = createValidProps();
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('Total Lendings')).toBeInTheDocument();
      expect(screen.getByText('127')).toBeInTheDocument();
      
      expect(screen.getByText('Items Returned')).toBeInTheDocument();
      expect(screen.getByText('98')).toBeInTheDocument();
      
      expect(screen.getByText('Active Loans')).toBeInTheDocument();
      expect(screen.getByText('29')).toBeInTheDocument();
      
      expect(screen.getByText('New Trainees')).toBeInTheDocument();
      expect(screen.getByText('34')).toBeInTheDocument();
    });

    it('should handle zero values in summary statistics', () => {
      const props = {
        ...createValidProps(),
        summaryStats: {
          totalLendings: 0,
          itemsReturned: 0,
          activeLoans: 0,
          newTrainees: 0,
        },
      };
      render(<PrintableReport {...props} />);
      
      // Zero values should be displayed as "0", not "N/A"
      const cells = screen.getAllByRole('cell');
      const zeroCells = cells.filter(cell => cell.textContent === '0');
      expect(zeroCells.length).toBeGreaterThan(0);
    });

    it('should handle null values in summary statistics', () => {
      const props = {
        ...createValidProps(),
        summaryStats: {
          totalLendings: null as any,
          itemsReturned: null as any,
          activeLoans: null as any,
          newTrainees: null as any,
        },
      };
      render(<PrintableReport {...props} />);
      
      // Null values should be displayed as "N/A"
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('ActivityTrendTable Sub-component', () => {
    it('should display activity trend data correctly', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      // Check table headers
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Borrowed')).toBeInTheDocument();
      expect(screen.getByText('Returned')).toBeInTheDocument();
      
      // Check data rows by finding the activity table specifically
      const activityTable = container.querySelector('.activity-trend-table');
      expect(activityTable).toBeInTheDocument();
      
      expect(activityTable?.textContent).toContain('Jan 1');
      expect(activityTable?.textContent).toContain('Jan 2');
      expect(activityTable?.textContent).toContain('Jan 3');
    });

    it('should display "No data available" for empty activity data', () => {
      const props = {
        ...createValidProps(),
        activityData: [],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('No data available for selected period')).toBeInTheDocument();
    });

    it('should handle null values in activity data', () => {
      const props = {
        ...createValidProps(),
        activityData: [
          { date: 'Jan 1', borrowed: null as any, returned: null as any },
        ],
      };
      render(<PrintableReport {...props} />);
      
      // Null values should be displayed as "N/A"
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThanOrEqual(2);
    });

    it('should render multiple activity data rows', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      // Find the activity trend table
      const activityTable = container.querySelector('.activity-trend-table table');
      expect(activityTable).toBeInTheDocument();
      
      // Count data rows (excluding header row)
      const rows = activityTable?.querySelectorAll('tbody tr');
      expect(rows?.length).toBe(3); // 3 data rows
    });
  });

  describe('CategoryDistributionTable Sub-component', () => {
    it('should display category distribution data correctly', () => {
      const props = createValidProps();
      render(<PrintableReport {...props} />);
      
      // Check table headers
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Count')).toBeInTheDocument();
      expect(screen.getByText('Percentage')).toBeInTheDocument();
      
      // Check data rows
      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      
      expect(screen.getByText('Equipment')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      
      expect(screen.getByText('Books')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('should calculate and display percentages correctly', () => {
      const props = createValidProps();
      render(<PrintableReport {...props} />);
      
      // Total = 45 + 30 + 25 = 100
      // Tools: 45/100 = 45.0%
      // Equipment: 30/100 = 30.0%
      // Books: 25/100 = 25.0%
      expect(screen.getByText('45.0%')).toBeInTheDocument();
      expect(screen.getByText('30.0%')).toBeInTheDocument();
      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });

    it('should display "No data available" for empty category data', () => {
      const props = {
        ...createValidProps(),
        categoryData: [],
      };
      render(<PrintableReport {...props} />);
      
      // Should find the "No data available" message in the category table
      const noDataMessages = screen.getAllByText('No data available for selected period');
      expect(noDataMessages.length).toBeGreaterThan(0);
    });

    it('should handle zero total for percentage calculation', () => {
      const props = {
        ...createValidProps(),
        categoryData: [
          { name: 'Category1', value: 0 },
          { name: 'Category2', value: 0 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      // When total is 0, percentage should be "0%"
      const percentageCells = screen.getAllByText('0%');
      expect(percentageCells.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle null values in category data', () => {
      const props = {
        ...createValidProps(),
        categoryData: [
          { name: 'Category1', value: null as any },
        ],
      };
      render(<PrintableReport {...props} />);
      
      // Null values should be displayed as "N/A"
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  describe('ProgramEnrollmentTable Sub-component', () => {
    it('should display program enrollment data correctly', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      // Check table headers
      expect(screen.getByText('Program')).toBeInTheDocument();
      expect(screen.getByText('Trainees')).toBeInTheDocument();
      
      // Check data rows by finding the program table specifically
      const programTable = container.querySelector('.program-enrollment-table');
      expect(programTable).toBeInTheDocument();
      
      expect(programTable?.textContent).toContain('Computer Literacy');
      expect(programTable?.textContent).toContain('20');
      
      expect(programTable?.textContent).toContain('Welding');
      
      expect(programTable?.textContent).toContain('Carpentry');
    });

    it('should display "No data available" for empty program data', () => {
      const props = {
        ...createValidProps(),
        programData: [],
      };
      render(<PrintableReport {...props} />);
      
      // Should find the "No data available" message in the program table
      const noDataMessages = screen.getAllByText('No data available for selected period');
      expect(noDataMessages.length).toBeGreaterThan(0);
    });

    it('should handle null values in program data', () => {
      const props = {
        ...createValidProps(),
        programData: [
          { program: 'Program1', trainees: null as any },
        ],
      };
      render(<PrintableReport {...props} />);
      
      // Null values should be displayed as "N/A"
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('should render multiple program data rows', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      // Find the program enrollment table
      const programTable = container.querySelector('.program-enrollment-table table');
      expect(programTable).toBeInTheDocument();
      
      // Count data rows (excluding header row)
      const rows = programTable?.querySelectorAll('tbody tr');
      expect(rows?.length).toBe(3); // 3 data rows
    });
  });

  describe('PrintFooter Sub-component', () => {
    it('should display generation timestamp in footer', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      const footer = container.querySelector('.print-footer');
      expect(footer).toBeInTheDocument();
      expect(footer?.textContent).toContain('Generated:');
      expect(footer?.textContent).toContain('January 31, 2024');
    });
  });

  describe('Empty Data Arrays', () => {
    it('should handle all empty data arrays', () => {
      const props = {
        ...createValidProps(),
        activityData: [],
        categoryData: [],
        programData: [],
      };
      render(<PrintableReport {...props} />);
      
      // Should display "No data available" message for each empty table
      const noDataMessages = screen.getAllByText('No data available for selected period');
      expect(noDataMessages.length).toBe(3); // One for each table
    });

    it('should still render summary statistics when data arrays are empty', () => {
      const props = {
        ...createValidProps(),
        activityData: [],
        categoryData: [],
        programData: [],
      };
      render(<PrintableReport {...props} />);
      
      // Summary statistics should still be displayed
      expect(screen.getByText('Total Lendings')).toBeInTheDocument();
      expect(screen.getByText('127')).toBeInTheDocument();
    });
  });

  describe('Null Value Handling', () => {
    it('should display "N/A" for null summary statistics', () => {
      const props = {
        ...createValidProps(),
        summaryStats: {
          totalLendings: null as any,
          itemsReturned: undefined as any,
          activeLoans: null as any,
          newTrainees: undefined as any,
        },
      };
      render(<PrintableReport {...props} />);
      
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThanOrEqual(4);
    });

    it('should display "N/A" for undefined values', () => {
      const props = {
        ...createValidProps(),
        activityData: [
          { date: 'Jan 1', borrowed: undefined as any, returned: undefined as any },
        ],
      };
      render(<PrintableReport {...props} />);
      
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThanOrEqual(2);
    });

    it('should display "N/A" for empty string values', () => {
      const props = {
        ...createValidProps(),
        activityData: [
          { date: 'Jan 1', borrowed: '' as any, returned: '' as any },
        ],
      };
      render(<PrintableReport {...props} />);
      
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Date Range Display', () => {
    it('should format date range correctly', () => {
      const props = createValidProps();
      render(<PrintableReport {...props} />);
      
      // Dates should be formatted as "Month Day, Year"
      expect(screen.getByText(/January 1, 2024 - January 31, 2024/)).toBeInTheDocument();
    });

    it('should handle different date ranges', () => {
      const props = {
        ...createValidProps(),
        dateFrom: '2024-06-15',
        dateTo: '2024-12-31',
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/June 15, 2024 - December 31, 2024/)).toBeInTheDocument();
    });

    it('should handle same start and end date', () => {
      const props = {
        ...createValidProps(),
        dateFrom: '2024-05-20',
        dateTo: '2024-05-20',
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/May 20, 2024 - May 20, 2024/)).toBeInTheDocument();
    });
  });

  describe('Report Type Display', () => {
    it('should display "All Activity" for "all" report type', () => {
      const props = { ...createValidProps(), reportType: 'all' };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/All Activity/)).toBeInTheDocument();
    });

    it('should display "Trainees Only" for "trainees" report type', () => {
      const props = { ...createValidProps(), reportType: 'trainees' };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/Trainees Only/)).toBeInTheDocument();
    });

    it('should display "Items Only" for "items" report type', () => {
      const props = { ...createValidProps(), reportType: 'items' };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/Items Only/)).toBeInTheDocument();
    });

    it('should display "Lendings Only" for "lendings" report type', () => {
      const props = { ...createValidProps(), reportType: 'lendings' };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/Lendings Only/)).toBeInTheDocument();
    });

    it('should display unknown report type as-is', () => {
      const props = { ...createValidProps(), reportType: 'unknown-type' };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/unknown-type/)).toBeInTheDocument();
    });
  });

  describe('Table Structure', () => {
    it('should render summary statistics table with correct structure', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      const summaryTable = container.querySelector('.summary-stats-table table');
      expect(summaryTable).toBeInTheDocument();
      
      // Should have tbody
      const tbody = summaryTable?.querySelector('tbody');
      expect(tbody).toBeInTheDocument();
      
      // Should have 2 rows (2x2 layout)
      const rows = tbody?.querySelectorAll('tr');
      expect(rows?.length).toBe(2);
    });

    it('should render activity trend table with correct structure', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      const activityTable = container.querySelector('.activity-trend-table table');
      expect(activityTable).toBeInTheDocument();
      
      // Should have thead and tbody
      expect(activityTable?.querySelector('thead')).toBeInTheDocument();
      expect(activityTable?.querySelector('tbody')).toBeInTheDocument();
      
      // Should have 3 column headers
      const headers = activityTable?.querySelectorAll('thead th');
      expect(headers?.length).toBe(3);
    });

    it('should render category distribution table with correct structure', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      const categoryTable = container.querySelector('.category-distribution-table table');
      expect(categoryTable).toBeInTheDocument();
      
      // Should have thead and tbody
      expect(categoryTable?.querySelector('thead')).toBeInTheDocument();
      expect(categoryTable?.querySelector('tbody')).toBeInTheDocument();
      
      // Should have 3 column headers (Category, Count, Percentage)
      const headers = categoryTable?.querySelectorAll('thead th');
      expect(headers?.length).toBe(3);
    });

    it('should render program enrollment table with correct structure', () => {
      const props = createValidProps();
      const { container } = render(<PrintableReport {...props} />);
      
      const programTable = container.querySelector('.program-enrollment-table table');
      expect(programTable).toBeInTheDocument();
      
      // Should have thead and tbody
      expect(programTable?.querySelector('thead')).toBeInTheDocument();
      expect(programTable?.querySelector('tbody')).toBeInTheDocument();
      
      // Should have 2 column headers (Program, Trainees)
      const headers = programTable?.querySelectorAll('thead th');
      expect(headers?.length).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers in summary statistics', () => {
      const props = {
        ...createValidProps(),
        summaryStats: {
          totalLendings: 999999,
          itemsReturned: 888888,
          activeLoans: 777777,
          newTrainees: 666666,
        },
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('999999')).toBeInTheDocument();
      expect(screen.getByText('888888')).toBeInTheDocument();
      expect(screen.getByText('777777')).toBeInTheDocument();
      expect(screen.getByText('666666')).toBeInTheDocument();
    });

    it('should handle special characters in data', () => {
      const props = {
        ...createValidProps(),
        categoryData: [
          { name: 'Tools & Equipment', value: 10 },
          { name: 'Books "Reference"', value: 5 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('Tools & Equipment')).toBeInTheDocument();
      expect(screen.getByText('Books "Reference"')).toBeInTheDocument();
    });

    it('should handle very long category names', () => {
      const props = {
        ...createValidProps(),
        categoryData: [
          { name: 'This is a very long category name that might cause layout issues', value: 10 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('This is a very long category name that might cause layout issues')).toBeInTheDocument();
    });

    it('should handle single data point in arrays', () => {
      const props = {
        ...createValidProps(),
        activityData: [{ date: 'Jan 1', borrowed: 5, returned: 3 }],
        categoryData: [{ name: 'Tools', value: 10 }],
        programData: [{ program: 'Computer Literacy', trainees: 15 }],
      };
      const { container } = render(<PrintableReport {...props} />);
      
      // Each table should have exactly 1 data row
      const activityRows = container.querySelector('.activity-trend-table tbody')?.querySelectorAll('tr');
      expect(activityRows?.length).toBe(1);
      
      const categoryRows = container.querySelector('.category-distribution-table tbody')?.querySelectorAll('tr');
      expect(categoryRows?.length).toBe(1);
      
      const programRows = container.querySelector('.program-enrollment-table tbody')?.querySelectorAll('tr');
      expect(programRows?.length).toBe(1);
    });

    it('should handle large datasets', () => {
      const largeActivityData = Array.from({ length: 100 }, (_, i) => ({
        date: `Day ${i + 1}`,
        borrowed: i * 2,
        returned: i,
      }));
      
      const props = {
        ...createValidProps(),
        activityData: largeActivityData,
      };
      const { container } = render(<PrintableReport {...props} />);
      
      const activityRows = container.querySelector('.activity-trend-table tbody')?.querySelectorAll('tr');
      expect(activityRows?.length).toBe(100);
    });
  });
});
