/**
 * Edge Cases and Error Scenarios Tests for PrintableReport Component
 * 
 * This test suite validates edge cases and error scenarios for the print functionality:
 * - Data edge cases (empty, single item, large datasets, special characters)
 * - Null/undefined value handling
 * - Date range edge cases
 * - Special character handling
 * - Large dataset performance
 * 
 * Requirements: 3.8, 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrintableReport, { PrintableReportProps } from '../PrintableReport';

/**
 * Helper function to create base test props
 */
function createBaseProps(): PrintableReportProps {
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
    ],
    categoryData: [
      { name: 'Tools', value: 45 },
    ],
    programData: [
      { program: 'Computer Literacy', trainees: 20 },
    ],
  };
}

describe('PrintableReport - Edge Cases and Error Scenarios', () => {
  describe('Empty Data Arrays', () => {
    it('should handle empty activityData array', () => {
      const props = {
        ...createBaseProps(),
        activityData: [],
      };
      render(<PrintableReport {...props} />);
      
      const noDataMessages = screen.getAllByText('No data available for selected period');
      expect(noDataMessages.length).toBeGreaterThan(0);
    });

    it('should handle empty categoryData array', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [],
      };
      render(<PrintableReport {...props} />);
      
      const noDataMessages = screen.getAllByText('No data available for selected period');
      expect(noDataMessages.length).toBeGreaterThan(0);
    });

    it('should handle empty programData array', () => {
      const props = {
        ...createBaseProps(),
        programData: [],
      };
      render(<PrintableReport {...props} />);
      
      const noDataMessages = screen.getAllByText('No data available for selected period');
      expect(noDataMessages.length).toBeGreaterThan(0);
    });

    it('should handle all empty data arrays simultaneously', () => {
      const props = {
        ...createBaseProps(),
        activityData: [],
        categoryData: [],
        programData: [],
      };
      render(<PrintableReport {...props} />);
      
      // Should display "No data available" for all three tables
      const noDataMessages = screen.getAllByText('No data available for selected period');
      expect(noDataMessages.length).toBe(3);
      
      // Summary statistics should still be visible
      expect(screen.getByText('Total Lendings')).toBeInTheDocument();
      expect(screen.getByText('127')).toBeInTheDocument();
    });
  });

  describe('Single Data Point in Arrays', () => {
    it('should handle single data point in activityData', () => {
      const props = {
        ...createBaseProps(),
        activityData: [{ date: 'Jan 1', borrowed: 5, returned: 3 }],
      };
      const { container } = render(<PrintableReport {...props} />);
      
      const activityRows = container.querySelector('.activity-trend-table tbody')?.querySelectorAll('tr');
      expect(activityRows?.length).toBe(1);
      
      expect(screen.getByText('Jan 1')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should handle single data point in categoryData', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [{ name: 'Tools', value: 100 }],
      };
      const { container } = render(<PrintableReport {...props} />);
      
      const categoryRows = container.querySelector('.category-distribution-table tbody')?.querySelectorAll('tr');
      expect(categoryRows?.length).toBe(1);
      
      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('100.0%')).toBeInTheDocument(); // 100/100 = 100%
    });

    it('should handle single data point in programData', () => {
      const props = {
        ...createBaseProps(),
        programData: [{ program: 'Computer Literacy', trainees: 25 }],
      };
      const { container } = render(<PrintableReport {...props} />);
      
      const programRows = container.querySelector('.program-enrollment-table tbody')?.querySelectorAll('tr');
      expect(programRows?.length).toBe(1);
      
      expect(screen.getByText('Computer Literacy')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('should handle single data point in all arrays', () => {
      const props = {
        ...createBaseProps(),
        activityData: [{ date: 'Jan 1', borrowed: 5, returned: 3 }],
        categoryData: [{ name: 'Tools', value: 100 }],
        programData: [{ program: 'Computer Literacy', trainees: 25 }],
      };
      const { container } = render(<PrintableReport {...props} />);
      
      // Verify each table has exactly 1 row
      const activityRows = container.querySelector('.activity-trend-table tbody')?.querySelectorAll('tr');
      expect(activityRows?.length).toBe(1);
      
      const categoryRows = container.querySelector('.category-distribution-table tbody')?.querySelectorAll('tr');
      expect(categoryRows?.length).toBe(1);
      
      const programRows = container.querySelector('.program-enrollment-table tbody')?.querySelectorAll('tr');
      expect(programRows?.length).toBe(1);
    });
  });

  describe('Large Datasets (100+ items)', () => {
    it('should handle 100+ items in activityData', () => {
      const largeActivityData = Array.from({ length: 150 }, (_, i) => ({
        date: `Day ${i + 1}`,
        borrowed: Math.floor(Math.random() * 50),
        returned: Math.floor(Math.random() * 50),
      }));
      
      const props = {
        ...createBaseProps(),
        activityData: largeActivityData,
      };
      const { container } = render(<PrintableReport {...props} />);
      
      const activityRows = container.querySelector('.activity-trend-table tbody')?.querySelectorAll('tr');
      expect(activityRows?.length).toBe(150);
    });

    it('should handle 100+ items in categoryData', () => {
      const largeCategoryData = Array.from({ length: 120 }, (_, i) => ({
        name: `Category ${i + 1}`,
        value: i + 1,
      }));
      
      const props = {
        ...createBaseProps(),
        categoryData: largeCategoryData,
      };
      const { container } = render(<PrintableReport {...props} />);
      
      const categoryRows = container.querySelector('.category-distribution-table tbody')?.querySelectorAll('tr');
      expect(categoryRows?.length).toBe(120);
    });

    it('should handle 100+ items in programData', () => {
      const largeProgramData = Array.from({ length: 110 }, (_, i) => ({
        program: `Program ${i + 1}`,
        trainees: Math.floor(Math.random() * 100),
      }));
      
      const props = {
        ...createBaseProps(),
        programData: largeProgramData,
      };
      const { container } = render(<PrintableReport {...props} />);
      
      const programRows = container.querySelector('.program-enrollment-table tbody')?.querySelectorAll('tr');
      expect(programRows?.length).toBe(110);
    });

    it('should handle large datasets in all arrays simultaneously', () => {
      const props = {
        ...createBaseProps(),
        activityData: Array.from({ length: 100 }, (_, i) => ({
          date: `Day ${i + 1}`,
          borrowed: i,
          returned: i - 1,
        })),
        categoryData: Array.from({ length: 100 }, (_, i) => ({
          name: `Category ${i + 1}`,
          value: i + 1,
        })),
        programData: Array.from({ length: 100 }, (_, i) => ({
          program: `Program ${i + 1}`,
          trainees: i + 1,
        })),
      };
      const { container } = render(<PrintableReport {...props} />);
      
      // Verify all tables render correctly
      expect(container.querySelector('.activity-trend-table')).toBeInTheDocument();
      expect(container.querySelector('.category-distribution-table')).toBeInTheDocument();
      expect(container.querySelector('.program-enrollment-table')).toBeInTheDocument();
    });
  });

  describe('Very Long Names', () => {
    it('should handle very long category names', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { 
            name: 'This is an extremely long category name that might cause layout issues in the print view and should be handled gracefully by the component', 
            value: 50 
          },
          { 
            name: 'Another very long category name with lots of text to test wrapping and overflow behavior', 
            value: 30 
          },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/This is an extremely long category name/)).toBeInTheDocument();
      expect(screen.getByText(/Another very long category name/)).toBeInTheDocument();
    });

    it('should handle very long program names', () => {
      const props = {
        ...createBaseProps(),
        programData: [
          { 
            program: 'Advanced Computer Programming and Software Development with Modern Web Technologies and Cloud Computing', 
            trainees: 25 
          },
          { 
            program: 'Professional Welding and Metal Fabrication Techniques for Industrial Applications', 
            trainees: 15 
          },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/Advanced Computer Programming/)).toBeInTheDocument();
      expect(screen.getByText(/Professional Welding/)).toBeInTheDocument();
    });

    it('should handle very long report title', () => {
      const props = {
        ...createBaseProps(),
        reportTitle: 'Comprehensive Annual Reports and Analytics Dashboard for Administrative Oversight and Management',
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Comprehensive Annual Reports/);
    });
  });

  describe('Zero Values in Summary Statistics', () => {
    it('should display zero values correctly (not as N/A)', () => {
      const props = {
        ...createBaseProps(),
        summaryStats: {
          totalLendings: 0,
          itemsReturned: 0,
          activeLoans: 0,
          newTrainees: 0,
        },
      };
      render(<PrintableReport {...props} />);
      
      // Zero should be displayed as "0", not "N/A"
      const cells = screen.getAllByRole('cell');
      const zeroCells = cells.filter(cell => cell.textContent === '0');
      expect(zeroCells.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle mix of zero and non-zero values', () => {
      const props = {
        ...createBaseProps(),
        summaryStats: {
          totalLendings: 100,
          itemsReturned: 0,
          activeLoans: 50,
          newTrainees: 0,
        },
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      
      const cells = screen.getAllByRole('cell');
      const zeroCells = cells.filter(cell => cell.textContent === '0');
      expect(zeroCells.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle zero values in activity data', () => {
      const props = {
        ...createBaseProps(),
        activityData: [
          { date: 'Jan 1', borrowed: 0, returned: 0 },
          { date: 'Jan 2', borrowed: 5, returned: 0 },
          { date: 'Jan 3', borrowed: 0, returned: 3 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      const cells = screen.getAllByRole('cell');
      const zeroCells = cells.filter(cell => cell.textContent === '0');
      expect(zeroCells.length).toBeGreaterThan(0);
    });

    it('should handle zero values in category data', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Tools', value: 0 },
          { name: 'Equipment', value: 0 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      // When all values are 0, percentage should be "0%"
      const percentageCells = screen.getAllByText('0%');
      expect(percentageCells.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Null and Undefined Values', () => {
    it('should handle null values in summary statistics', () => {
      const props = {
        ...createBaseProps(),
        summaryStats: {
          totalLendings: null as any,
          itemsReturned: null as any,
          activeLoans: null as any,
          newTrainees: null as any,
        },
      };
      render(<PrintableReport {...props} />);
      
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle undefined values in summary statistics', () => {
      const props = {
        ...createBaseProps(),
        summaryStats: {
          totalLendings: undefined as any,
          itemsReturned: undefined as any,
          activeLoans: undefined as any,
          newTrainees: undefined as any,
        },
      };
      render(<PrintableReport {...props} />);
      
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle null values in activity data', () => {
      const props = {
        ...createBaseProps(),
        activityData: [
          { date: 'Jan 1', borrowed: null as any, returned: null as any },
          { date: 'Jan 2', borrowed: 10, returned: null as any },
        ],
      };
      render(<PrintableReport {...props} />);
      
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle undefined values in category data', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Tools', value: undefined as any },
          { name: 'Equipment', value: 50 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('N/A')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should handle null values in program data', () => {
      const props = {
        ...createBaseProps(),
        programData: [
          { program: 'Computer Literacy', trainees: null as any },
          { program: 'Welding', trainees: undefined as any },
        ],
      };
      render(<PrintableReport {...props} />);
      
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty string values', () => {
      const props = {
        ...createBaseProps(),
        activityData: [
          { date: 'Jan 1', borrowed: '' as any, returned: '' as any },
        ],
      };
      render(<PrintableReport {...props} />);
      
      const naCells = screen.getAllByText('N/A');
      expect(naCells.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Special Characters in Data', () => {
    it('should handle quotes in category names', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Tools "Professional"', value: 30 },
          { name: 'Books "Reference"', value: 20 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('Tools "Professional"')).toBeInTheDocument();
      expect(screen.getByText('Books "Reference"')).toBeInTheDocument();
    });

    it('should handle ampersands in data', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Tools & Equipment', value: 40 },
          { name: 'Books & Manuals', value: 25 },
        ],
        programData: [
          { program: 'Computer & IT Training', trainees: 30 },
          { program: 'Welding & Fabrication', trainees: 20 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('Tools & Equipment')).toBeInTheDocument();
      expect(screen.getByText('Books & Manuals')).toBeInTheDocument();
      expect(screen.getByText('Computer & IT Training')).toBeInTheDocument();
      expect(screen.getByText('Welding & Fabrication')).toBeInTheDocument();
    });

    it('should handle less-than and greater-than symbols', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Items <10kg', value: 15 },
          { name: 'Items >10kg', value: 25 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('Items <10kg')).toBeInTheDocument();
      expect(screen.getByText('Items >10kg')).toBeInTheDocument();
    });

    it('should handle apostrophes and single quotes', () => {
      const props = {
        ...createBaseProps(),
        programData: [
          { program: "Beginner's Computer Course", trainees: 20 },
          { program: "Advanced 'Pro' Training", trainees: 15 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText("Beginner's Computer Course")).toBeInTheDocument();
      expect(screen.getByText("Advanced 'Pro' Training")).toBeInTheDocument();
    });

    it('should handle forward slashes', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Tools/Equipment', value: 30 },
          { name: 'Books/Manuals', value: 20 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('Tools/Equipment')).toBeInTheDocument();
      expect(screen.getByText('Books/Manuals')).toBeInTheDocument();
    });

    it('should handle parentheses and brackets', () => {
      const props = {
        ...createBaseProps(),
        programData: [
          { program: 'Computer Literacy (Basic)', trainees: 25 },
          { program: 'Welding [Advanced]', trainees: 15 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('Computer Literacy (Basic)')).toBeInTheDocument();
      expect(screen.getByText('Welding [Advanced]')).toBeInTheDocument();
    });

    it('should handle multiple special characters together', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Tools & Equipment "Pro" (>10kg)', value: 50 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText('Tools & Equipment "Pro" (>10kg)')).toBeInTheDocument();
    });
  });

  describe('Date Range Edge Cases', () => {
    it('should handle date ranges spanning multiple years', () => {
      const props = {
        ...createBaseProps(),
        dateFrom: '2023-01-01',
        dateTo: '2025-12-31',
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/January 1, 2023 - December 31, 2025/)).toBeInTheDocument();
    });

    it('should handle same dateFrom and dateTo (single day report)', () => {
      const props = {
        ...createBaseProps(),
        dateFrom: '2024-05-15',
        dateTo: '2024-05-15',
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/May 15, 2024 - May 15, 2024/)).toBeInTheDocument();
    });

    it('should handle date range within same month', () => {
      const props = {
        ...createBaseProps(),
        dateFrom: '2024-03-01',
        dateTo: '2024-03-15',
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/March 1, 2024 - March 15, 2024/)).toBeInTheDocument();
    });

    it('should handle date range spanning year boundary', () => {
      const props = {
        ...createBaseProps(),
        dateFrom: '2023-12-15',
        dateTo: '2024-01-15',
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/December 15, 2023 - January 15, 2024/)).toBeInTheDocument();
    });

    it('should handle leap year dates', () => {
      const props = {
        ...createBaseProps(),
        dateFrom: '2024-02-29',
        dateTo: '2024-03-01',
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/February 29, 2024 - March 1, 2024/)).toBeInTheDocument();
    });
  });

  describe('Mixed Edge Cases', () => {
    it('should handle combination of empty arrays and null values', () => {
      const props = {
        ...createBaseProps(),
        summaryStats: {
          totalLendings: null as any,
          itemsReturned: 0,
          activeLoans: undefined as any,
          newTrainees: 10,
        },
        activityData: [],
        categoryData: [{ name: 'Tools', value: null as any }],
        programData: [],
      };
      render(<PrintableReport {...props} />);
      
      // Should handle both "N/A" for nulls and "No data available" for empty arrays
      expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
      expect(screen.getAllByText('No data available for selected period').length).toBeGreaterThan(0);
    });

    it('should handle large dataset with special characters', () => {
      const props = {
        ...createBaseProps(),
        categoryData: Array.from({ length: 100 }, (_, i) => ({
          name: `Category ${i + 1} & "Special" <${i}>`,
          value: i + 1,
        })),
      };
      const { container } = render(<PrintableReport {...props} />);
      
      const categoryRows = container.querySelector('.category-distribution-table tbody')?.querySelectorAll('tr');
      expect(categoryRows?.length).toBe(100);
    });

    it('should handle single day report with empty data', () => {
      const props = {
        ...createBaseProps(),
        dateFrom: '2024-06-15',
        dateTo: '2024-06-15',
        activityData: [],
        categoryData: [],
        programData: [],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/June 15, 2024 - June 15, 2024/)).toBeInTheDocument();
      expect(screen.getAllByText('No data available for selected period').length).toBe(3);
    });

    it('should handle very long names with special characters', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { 
            name: 'Professional Tools & Equipment "Heavy Duty" for Industrial Applications (>50kg) - Advanced Category', 
            value: 75 
          },
        ],
      };
      render(<PrintableReport {...props} />);
      
      expect(screen.getByText(/Professional Tools & Equipment/)).toBeInTheDocument();
    });
  });

  describe('Percentage Calculation Edge Cases', () => {
    it('should handle percentage calculation with zero total', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Category1', value: 0 },
          { name: 'Category2', value: 0 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      // When total is 0, all percentages should be "0%"
      const percentageCells = screen.getAllByText('0%');
      expect(percentageCells.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle percentage calculation with very small values', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Category1', value: 1 },
          { name: 'Category2', value: 999 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      // 1/1000 = 0.1%
      expect(screen.getByText('0.1%')).toBeInTheDocument();
      // 999/1000 = 99.9%
      expect(screen.getByText('99.9%')).toBeInTheDocument();
    });

    it('should handle percentage calculation with equal values', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Category1', value: 25 },
          { name: 'Category2', value: 25 },
          { name: 'Category3', value: 25 },
          { name: 'Category4', value: 25 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      // Each should be 25/100 = 25.0%
      const percentageCells = screen.getAllByText('25.0%');
      expect(percentageCells.length).toBe(4);
    });

    it('should handle percentage calculation with null values', () => {
      const props = {
        ...createBaseProps(),
        categoryData: [
          { name: 'Category1', value: null as any },
          { name: 'Category2', value: 50 },
        ],
      };
      render(<PrintableReport {...props} />);
      
      // Null value should display as "N/A"
      expect(screen.getByText('N/A')).toBeInTheDocument();
      // Valid value should still calculate percentage
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });
  });

  describe('Component Resilience', () => {
    it('should render without crashing with minimal valid props', () => {
      const props = {
        reportTitle: 'Test',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        reportType: 'all',
        generatedAt: '2024-01-31T00:00:00.000Z',
        summaryStats: {
          totalLendings: 0,
          itemsReturned: 0,
          activeLoans: 0,
          newTrainees: 0,
        },
        activityData: [],
        categoryData: [],
        programData: [],
      };
      const { container } = render(<PrintableReport {...props} />);
      
      expect(container.querySelector('.print-container')).toBeInTheDocument();
    });

    it('should render all sections even with problematic data', () => {
      const props = {
        ...createBaseProps(),
        summaryStats: {
          totalLendings: null as any,
          itemsReturned: undefined as any,
          activeLoans: '' as any,
          newTrainees: 0,
        },
        activityData: [
          { date: '', borrowed: null as any, returned: undefined as any },
        ],
        categoryData: [
          { name: '', value: null as any },
        ],
        programData: [
          { program: '', trainees: undefined as any },
        ],
      };
      render(<PrintableReport {...props} />);
      
      // All section headings should still be present
      expect(screen.getByText('Summary Statistics')).toBeInTheDocument();
      expect(screen.getByText('Lending Activity Trend')).toBeInTheDocument();
      expect(screen.getByText('Items by Category')).toBeInTheDocument();
      expect(screen.getByText('Trainees by Program')).toBeInTheDocument();
    });
  });
});
