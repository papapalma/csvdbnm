/**
 * Error Handling Tests for ReportsPage Print Functionality
 * 
 * This test suite validates error scenarios for the print functionality:
 * - Print dialog error handling
 * - Browser compatibility error handling
 * - Error message display (suggesting PDF export alternative)
 * - Print button state after errors (remains enabled for retry)
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ReportsPage from '../ReportsPage';
import { toast } from 'sonner';

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

// Helper to render ReportsPage with router context
function renderReportsPage() {
  return render(
    <BrowserRouter>
      <ReportsPage />
    </BrowserRouter>
  );
}

describe('ReportsPage - Print Error Handling', () => {
  let originalWindowPrint: typeof window.print;
  let windowPrintSpy: any;

  beforeEach(() => {
    // Save original window.print
    originalWindowPrint = window.print;
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock window.print
    windowPrintSpy = vi.fn();
    window.print = windowPrintSpy;
  });

  afterEach(() => {
    // Restore original window.print
    window.print = originalWindowPrint;
  });

  describe('Print Dialog Error Handling', () => {
    it('should handle window.print() throwing an error', async () => {
      const user = userEvent.setup();
      
      // Mock window.print to throw an error
      windowPrintSpy.mockImplementation(() => {
        throw new Error('Print dialog failed');
      });

      renderReportsPage();

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      // Click print button
      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      // Wait for error handling
      await waitFor(() => {
        // Verify logger.error was called
        const logger = require('../../utils/logger').default;
        expect(logger.error).toHaveBeenCalledWith(
          'Print failed',
          expect.objectContaining({ error: expect.any(Error) })
        );
      });

      // Verify error toast was displayed
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to open print dialog. Please try exporting as PDF instead.'
      );

      // Verify print button is still enabled (for retry)
      expect(printButton).not.toBeDisabled();
    });

    it('should suggest PDF export alternative in error message', async () => {
      const user = userEvent.setup();
      
      windowPrintSpy.mockImplementation(() => {
        throw new Error('Print failed');
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('PDF')
        );
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('export')
        );
      });
    });

    it('should reset isPrinting state after error', async () => {
      const user = userEvent.setup();
      
      windowPrintSpy.mockImplementation(() => {
        throw new Error('Print failed');
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      
      // Click print button
      await user.click(printButton);

      // Wait for error handling to complete
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Button should show "Print" text (not "Preparing...")
      expect(printButton).toHaveTextContent('Print');
      expect(printButton).not.toBeDisabled();
    });
  });

  describe('Browser Compatibility Error Handling', () => {
    it('should handle missing window.print function', async () => {
      const user = userEvent.setup();
      
      // Remove window.print to simulate unsupported browser
      (window as any).print = undefined;

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('not supported')
        );
      });

      // Should suggest PDF export
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('PDF export')
      );
    });

    it('should handle window.print being null', async () => {
      const user = userEvent.setup();
      
      (window as any).print = null;

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('should not call window.print if it is not a function', async () => {
      const user = userEvent.setup();
      
      (window as any).print = 'not a function';

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      // window.print should not be called since it's not a function
      expect(windowPrintSpy).not.toHaveBeenCalled();

      // Error toast should be displayed
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  describe('Print Button State After Errors', () => {
    it('should keep print button enabled after error for retry', async () => {
      const user = userEvent.setup();
      
      windowPrintSpy.mockImplementation(() => {
        throw new Error('Print failed');
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      
      // First attempt
      await user.click(printButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Button should be enabled
      expect(printButton).not.toBeDisabled();
      expect(printButton).toHaveTextContent('Print');
    });

    it('should allow retry after print error', async () => {
      const user = userEvent.setup();
      
      let callCount = 0;
      windowPrintSpy.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First attempt failed');
        }
        // Second attempt succeeds
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      
      // First attempt (fails)
      await user.click(printButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Clear mock calls
      vi.clearAllMocks();

      // Second attempt (succeeds)
      await user.click(printButton);

      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalledTimes(1);
      });

      // No error toast on second attempt
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should show loading state during print preparation', async () => {
      const user = userEvent.setup();
      
      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      
      // Click print button
      await user.click(printButton);

      // Should show loading state immediately
      await waitFor(() => {
        expect(printButton).toHaveTextContent('Preparing...');
        expect(printButton).toBeDisabled();
      });
    });

    it('should restore button state after successful print', async () => {
      const user = userEvent.setup();

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      
      // Click print button
      await user.click(printButton);

      // Wait for print to be called
      await waitFor(() => {
        expect(windowPrintSpy).toHaveBeenCalled();
      });

      // Simulate afterprint event
      window.dispatchEvent(new Event('afterprint'));

      // Button should return to normal state
      await waitFor(() => {
        expect(printButton).toHaveTextContent('Print');
        expect(printButton).not.toBeDisabled();
      });
    });
  });

  describe('Error Logging', () => {
    it('should log print errors with context', async () => {
      const user = userEvent.setup();
      
      const testError = new Error('Test print error');
      windowPrintSpy.mockImplementation(() => {
        throw testError;
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        const logger = require('../../utils/logger').default;
        expect(logger.error).toHaveBeenCalledWith(
          'Print failed',
          expect.objectContaining({
            error: testError,
          })
        );
      });
    });
  });

  describe('Multiple Error Scenarios', () => {
    it('should handle consecutive print errors', async () => {
      const user = userEvent.setup();
      
      windowPrintSpy.mockImplementation(() => {
        throw new Error('Print always fails');
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      
      // First error
      await user.click(printButton);
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledTimes(1);
      });

      vi.clearAllMocks();

      // Second error
      await user.click(printButton);
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledTimes(1);
      });

      // Button should still be enabled
      expect(printButton).not.toBeDisabled();
    });

    it('should handle error during print preparation', async () => {
      const user = userEvent.setup();
      
      // Mock window.print to throw during the delay
      windowPrintSpy.mockImplementation(() => {
        throw new Error('Error during preparation');
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Should reset state
      expect(printButton).not.toBeDisabled();
    });
  });

  describe('User Experience During Errors', () => {
    it('should provide clear error message for print dialog failure', async () => {
      const user = userEvent.setup();
      
      windowPrintSpy.mockImplementation(() => {
        throw new Error('Dialog blocked');
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/failed to open print dialog/i)
        );
      });
    });

    it('should provide clear error message for browser compatibility', async () => {
      const user = userEvent.setup();
      
      (window as any).print = undefined;

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/not supported/i)
        );
      });
    });

    it('should always suggest PDF export as alternative', async () => {
      const user = userEvent.setup();
      
      windowPrintSpy.mockImplementation(() => {
        throw new Error('Print failed');
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/pdf/i)
        );
      });
    });
  });

  describe('Edge Cases in Error Handling', () => {
    it('should handle error with no error message', async () => {
      const user = userEvent.setup();
      
      windowPrintSpy.mockImplementation(() => {
        throw new Error();
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        const logger = require('../../utils/logger').default;
        expect(logger.error).toHaveBeenCalled();
      });

      // Should still display error toast
      expect(toast.error).toHaveBeenCalled();
    });

    it('should handle non-Error objects thrown', async () => {
      const user = userEvent.setup();
      
      windowPrintSpy.mockImplementation(() => {
        throw 'String error';
      });

      renderReportsPage();

      await waitFor(() => {
        expect(screen.getByText('Print')).toBeInTheDocument();
      });

      const printButton = screen.getByRole('button', { name: /print/i });
      await user.click(printButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Button should still be enabled
      expect(printButton).not.toBeDisabled();
    });
  });
});
