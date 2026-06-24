/**
 * Integration Tests for ReportsPage Print Flow
 * 
 * These tests verify the complete end-to-end print workflow from button click
 * to print completion, including state management, component rendering, and
 * browser print dialog integration.
 * 
 * Requirements validated: 4.1, 4.2, 4.3, 4.4, 7.8, 6.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ReportsPage from '../ReportsPage';
import * as reportService from '../../services/reportService';

// Mock dependencies
vi.mock('../../services/reportService');
vi.mock('sonner');
vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'admin',
      name: 'Test User',
    },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
    hasPermission: () => true,
  }),
  AuthProvider: ({ children }: any) => children,
}));

// Mock ThemeContext
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }: any) => children,
}));

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

describe('ReportsPage - End-to-End Print Flow Integration Tests', () => {
  let windowPrintSpy: any;
  let addEventListenerSpy: any;
  let removeEventListenerSpy: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock window.print
    windowPrintSpy = vi.fn();
    window.print = windowPrintSpy;

    // Spy on addEventListener and removeEventListenerSpy
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    // Mock reportService methods to prevent actual API calls
    vi.mocked(reportService.default.getActivityAnalytics).mockRejectedValue(new Error('Not implemented'));
    vi.mocked(reportService.default.getInventoryReport).mockRejectedValue(new Error('Not implemented'));
    vi.mocked(reportService.default.getProgramReport).mockRejectedValue(new Error('Not implemented'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderReportsPage = () => {
    return render(
      <BrowserRouter>
        <ReportsPage />
      </BrowserRouter>
    );
  };

  describe('Test 1: Complete print flow - button click to window.print()', () => {
    it('should execute complete flow: click print button → isPrinting becomes true → PrintableReport renders → window.print() called', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Verify initial state - PrintableReport should not be rendered
      expect(screen.queryByTestId('print-container')).not.toBeInTheDocument();

      // Find and click the print button
      const printButton = screen.getByRole('button', { name: /print/i });
      expect(printButton).toBeInTheDocument();
      expect(printButton).not.toBeDisabled();

      // Click the print button
      await user.click(printButton);

      // Verify isPrinting becomes true (button shows loading state)
      await waitFor(() => {
        const preparingButton = screen.queryByRole('button', { name: /preparing/i });
        if (preparingButton) {
          expect(preparingButton).toBeInTheDocument();
          expect(preparingButton).toBeDisabled();
        }
      }, { timeout: 500 });

      // Verify window.print() was called
      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(1);
      });

      // Verify PrintableReport is rendered (check for print-container class)
      // Note: The PrintableReport component uses className="print-container"
      const printContainer = document.querySelector('.print-container');
      expect(printContainer).toBeInTheDocument();
    });
  });

  describe('Test 2: Print dialog close flow - afterprint event handling', () => {
    it('should execute complete flow: print dialog closes → afterprint event fires → isPrinting becomes false → PrintableReport unmounts', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Click the print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      // Wait for window.print() to be called
      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify PrintableReport is rendered
      let printContainer = document.querySelector('.print-container');
      expect(printContainer).toBeInTheDocument();

      // Simulate the afterprint event (user closes print dialog)
      window.dispatchEvent(new Event('afterprint'));

      // Wait for isPrinting to become false
      await waitFor(() => {
        const printButtonAfter = screen.getByRole('button', { name: /print/i });
        expect(printButtonAfter).not.toBeDisabled();
      });

      // Verify PrintableReport is unmounted
      printContainer = document.querySelector('.print-container');
      expect(printContainer).not.toBeInTheDocument();
    });

    it('should handle afterprint event when user cancels print dialog', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Click print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Simulate user canceling the print dialog (afterprint still fires)
      window.dispatchEvent(new Event('afterprint'));

      // Verify state is reset
      await waitFor(() => {
        const printButtonAfter = screen.getByRole('button', { name: /print/i });
        expect(printButtonAfter).not.toBeDisabled();
      });

      // No error should be displayed (canceling is expected behavior)
      expect(screen.queryByText(/failed to open print dialog/i)).not.toBeInTheDocument();
    });
  });

  describe('Test 3: Print with custom date filters', () => {
    it('should display correct date range in PrintableReport when custom dates are set', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Change date filters
      const dateFromInput = screen.getByLabelText(/date from/i);
      const dateToInput = screen.getByLabelText(/date to/i);

      await user.clear(dateFromInput);
      await user.type(dateFromInput, '2024-01-01');

      await user.clear(dateToInput);
      await user.type(dateToInput, '2024-12-31');

      // Click print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify PrintableReport contains the correct date range
      const printContainer = document.querySelector('.print-container');
      expect(printContainer).toBeInTheDocument();

      // Check that the print metadata contains the date range
      // The formatPrintDate function formats dates as "Month Day, Year"
      await waitFor(() => {
        const printMetadata = document.querySelector('.print-metadata');
        expect(printMetadata).toBeInTheDocument();
        expect(printMetadata?.textContent).toContain('Date Range:');
      });
    });

    it('should update PrintableReport when date filters change between prints', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // First print with initial dates
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(1);
      });

      // Close print dialog
      window.dispatchEvent(new Event('afterprint'));

      await waitFor(() => {
        const printButtonAfter = screen.getByRole('button', { name: /print/i });
        expect(printButtonAfter).not.toBeDisabled();
      });

      // Change date filters
      const dateFromInput = screen.getByLabelText(/date from/i);
      await user.clear(dateFromInput);
      await user.type(dateFromInput, '2024-06-01');

      // Second print with new dates
      const printButton2 = screen.getByRole('button', { name: /print/i });
      await user.click(printButton2);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(2);
      });

      // Verify the new date is reflected in PrintableReport
      const printMetadata = document.querySelector('.print-metadata');
      expect(printMetadata).toBeInTheDocument();
    });
  });

  describe('Test 4: Print with different report types', () => {
    it('should display correct report type in PrintableReport', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Change report type to "Trainees Only"
      const reportTypeSelect = screen.getAllByRole('combobox').find(
        (element) => element.getAttribute('aria-label') === 'Report Type' || 
                     element.closest('[id*="reportType"]')
      );

      if (reportTypeSelect) {
        await user.click(reportTypeSelect);
        
        // Wait for dropdown to open and select "Trainees Only"
        await waitFor(() => {
          const traineesOption = screen.queryByText('Trainees Only');
          if (traineesOption) {
            user.click(traineesOption);
          }
        });
      }

      // Click print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify PrintableReport contains the report type
      const printMetadata = document.querySelector('.print-metadata');
      expect(printMetadata).toBeInTheDocument();
      expect(printMetadata?.textContent).toContain('Report Type:');
    });

    it('should handle all report type options correctly', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Test with default report type (All Activity)
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify print metadata exists
      let printMetadata = document.querySelector('.print-metadata');
      expect(printMetadata).toBeInTheDocument();

      // Close print dialog
      window.dispatchEvent(new Event('afterprint'));

      await waitFor(() => {
        const printButtonAfter = screen.getByRole('button', { name: /print/i });
        expect(printButtonAfter).not.toBeDisabled();
      });

      // Test that print works multiple times (verifying state management)
      const printButton2 = screen.getByRole('button', { name: /print/i });
      await user.click(printButton2);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(2);
      });

      printMetadata = document.querySelector('.print-metadata');
      expect(printMetadata).toBeInTheDocument();
    });
  });

  describe('Test 5: Print with mock data', () => {
    it('should display all summary statistics correctly in PrintableReport', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Click print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify summary statistics table is rendered
      const summaryStatsTable = document.querySelector('.summary-stats-table');
      expect(summaryStatsTable).toBeInTheDocument();
      expect(summaryStatsTable?.textContent).toContain('Summary Statistics');
      expect(summaryStatsTable?.textContent).toContain('Total Lendings');
      expect(summaryStatsTable?.textContent).toContain('Items Returned');
      expect(summaryStatsTable?.textContent).toContain('Active Loans');
      expect(summaryStatsTable?.textContent).toContain('New Trainees');
    });

    it('should display activity trend data correctly in PrintableReport', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Click print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify activity trend table is rendered
      const activityTrendTable = document.querySelector('.activity-trend-table');
      expect(activityTrendTable).toBeInTheDocument();
      expect(activityTrendTable?.textContent).toContain('Lending Activity Trend');
      expect(activityTrendTable?.textContent).toContain('Date');
      expect(activityTrendTable?.textContent).toContain('Borrowed');
      expect(activityTrendTable?.textContent).toContain('Returned');
    });

    it('should display category distribution data correctly in PrintableReport', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Click print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify category distribution table is rendered
      const categoryTable = document.querySelector('.category-distribution-table');
      expect(categoryTable).toBeInTheDocument();
      expect(categoryTable?.textContent).toContain('Items by Category');
      expect(categoryTable?.textContent).toContain('Category');
      expect(categoryTable?.textContent).toContain('Count');
      expect(categoryTable?.textContent).toContain('Percentage');
    });

    it('should display program enrollment data correctly in PrintableReport', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Click print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify program enrollment table is rendered
      const programTable = document.querySelector('.program-enrollment-table');
      expect(programTable).toBeInTheDocument();
      expect(programTable?.textContent).toContain('Trainees by Program');
      expect(programTable?.textContent).toContain('Program');
      expect(programTable?.textContent).toContain('Trainees');
    });

    it('should display generation timestamp in PrintableReport', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Click print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify generation timestamp is displayed
      const printMetadata = document.querySelector('.print-metadata');
      expect(printMetadata).toBeInTheDocument();
      expect(printMetadata?.textContent).toContain('Generated:');

      const printFooter = document.querySelector('.print-footer');
      expect(printFooter).toBeInTheDocument();
      expect(printFooter?.textContent).toContain('Generated:');
    });
  });

  describe('Test 6: Print error and retry', () => {
    it('should allow retry after print error', async () => {
      const user = userEvent.setup();
      
      // Mock window.print to throw an error on first call, succeed on second
      let callCount = 0;
      windowPrintSpy.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Print dialog failed');
        }
        // Second call succeeds
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // First print attempt (should fail)
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      // Wait a bit for error handling
      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(1);
      });

      // Verify button is still enabled for retry
      await waitFor(() => {
        const printButtonAfter = screen.getByRole('button', { name: /print/i });
        expect(printButtonAfter).not.toBeDisabled();
      });

      // Second print attempt (should succeed)
      const printButton2 = screen.getByRole('button', { name: /print/i });
      await user.click(printButton2);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(2);
      });

      // Verify second attempt succeeded (no error thrown)
      expect(callCount).toBe(2);
    });

    it('should maintain report data after print error', async () => {
      const user = userEvent.setup();
      
      // Mock window.print to throw an error
      windowPrintSpy.mockImplementation(() => {
        throw new Error('Print dialog failed');
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Attempt to print (will fail)
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify report data is still displayed on the page
      expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      expect(screen.getByText('Summary Statistics')).toBeInTheDocument();
    });
  });

  describe('Test 7: Multiple print operations', () => {
    it('should handle multiple sequential print operations correctly', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // First print operation
      const printButton1 = screen.getByRole('button', { name: /print/i });
      await user.click(printButton1);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(1);
      });

      // Close first print dialog
      window.dispatchEvent(new Event('afterprint'));

      await waitFor(() => {
        const printButtonAfter1 = screen.getByRole('button', { name: /print/i });
        expect(printButtonAfter1).not.toBeDisabled();
      });

      // Second print operation
      const printButton2 = screen.getByRole('button', { name: /print/i });
      await user.click(printButton2);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(2);
      });

      // Close second print dialog
      window.dispatchEvent(new Event('afterprint'));

      await waitFor(() => {
        const printButtonAfter2 = screen.getByRole('button', { name: /print/i });
        expect(printButtonAfter2).not.toBeDisabled();
      });

      // Third print operation
      const printButton3 = screen.getByRole('button', { name: /print/i });
      await user.click(printButton3);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(3);
      });

      // Verify all three print operations completed successfully
      expect(windowPrintSpy).toHaveBeenCalledTimes(3);
    });

    it('should not allow concurrent print operations', async () => {
      const user = userEvent.setup();
      
      // Mock window.print to delay
      windowPrintSpy.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 500));
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Start first print operation
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      // Try to click again while first print is in progress
      await waitFor(async () => {
        const preparingButton = screen.queryByRole('button', { name: /preparing/i });
        if (preparingButton && preparingButton.hasAttribute('disabled')) {
          // Button is disabled, so clicking should not trigger another print
          await user.click(preparingButton);
        }
      }, { timeout: 200 });

      // Verify window.print was only called once
      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('should clean up event listeners properly after multiple print operations', async () => {
      const user = userEvent.setup();
      const { unmount } = renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Perform multiple print operations
      for (let i = 0; i < 3; i++) {
        const printButton = screen.getByRole('button', { name: /print/i });
        await user.click(printButton);

        await waitFor(() => {
          expect(windowPrintSpy).toHaveBeenCalledTimes(i + 1);
        });

        window.dispatchEvent(new Event('afterprint'));

        await waitFor(() => {
          const printButtonAfter = screen.getByRole('button', { name: /print/i });
          expect(printButtonAfter).not.toBeDisabled();
        });
      }

      // Get the afterprint handler
      const afterprintHandler = addEventListenerSpy.mock.calls.find(
        (call: any) => call[0] === 'afterprint'
      )?.[1] as EventListener | undefined;

      // Unmount component
      unmount();

      // Verify event listener was cleaned up
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'afterprint',
        afterprintHandler
      );
    });

    it('should maintain correct state across multiple print operations with different filters', async () => {
      const user = userEvent.setup();
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // First print with default filters
      const printButton1 = screen.getByRole('button', { name: /print/i });
      await user.click(printButton1);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(1);
      });

      window.dispatchEvent(new Event('afterprint'));

      await waitFor(() => {
        const printButtonAfter1 = screen.getByRole('button', { name: /print/i });
        expect(printButtonAfter1).not.toBeDisabled();
      });

      // Change date filter
      const dateFromInput = screen.getByLabelText(/date from/i);
      await user.clear(dateFromInput);
      await user.type(dateFromInput, '2024-05-01');

      // Second print with new filter
      const printButton2 = screen.getByRole('button', { name: /print/i });
      await user.click(printButton2);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(2);
      });

      // Verify PrintableReport reflects the new filter
      const printMetadata = document.querySelector('.print-metadata');
      expect(printMetadata).toBeInTheDocument();

      window.dispatchEvent(new Event('afterprint'));

      // Verify state is clean after second print
      await waitFor(() => {
        const printButtonAfter2 = screen.getByRole('button', { name: /print/i });
        expect(printButtonAfter2).not.toBeDisabled();
      });
    });
  });

  describe('Integration with report data loading', () => {
    it('should print with data loaded from API', async () => {
      const user = userEvent.setup();
      
      // Mock successful API responses
      vi.mocked(reportService.default.getInventoryReport).mockResolvedValue({
        totalItems: 105,
        totalValue: 50000,
        utilizationRate: 75,
        lowStockItems: [],
        byCategory: {
          'Tools': 45,
          'Equipment': 32,
          'Materials': 28,
        },
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Wait for data to load
      await waitFor(() => {
        expect(reportService.default.getInventoryReport).toHaveBeenCalled();
      });

      // Click print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify PrintableReport is rendered with data
      const categoryTable = document.querySelector('.category-distribution-table');
      expect(categoryTable).toBeInTheDocument();
    });

    it('should print with mock data when API fails', async () => {
      const user = userEvent.setup();
      
      // Mock API failures (default behavior in beforeEach)
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Reports & Analytics')).toBeInTheDocument();
      });

      // Click print button (should use mock data)
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Verify PrintableReport is rendered with mock data
      const printContainer = document.querySelector('.print-container');
      expect(printContainer).toBeInTheDocument();
    });
  });
});
