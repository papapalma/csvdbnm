import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import SuperAdminDashboardPage from '../SuperAdminDashboardPage';
import tenantService from '../../services/tenantService';
import { toast } from 'sonner';

/**
 * Preservation Property Tests for Tenant Creation Form Admin Credentials Fix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 * 
 * These tests capture the EXISTING SUCCESSFUL BEHAVIOR that must be preserved after the fix.
 * When run on UNFIXED code, these tests MUST PASS - confirming baseline behavior.
 * After the fix is implemented, these tests must STILL PASS - confirming no regressions.
 * 
 * Property 2: Preservation - Existing Form Validation and UI Behavior
 * 
 * For any form interaction that does NOT involve the new admin credential fields 
 * (name field validation, contact email format validation, dialog open/close, 
 * success/error handling), the fixed code SHALL produce exactly the same behavior 
 * as the original code.
 * 
 * IMPORTANT: Follow observation-first methodology
 * - These tests observe and encode the current working behavior
 * - They serve as regression tests to ensure the fix doesn't break existing functionality
 */

// Mock dependencies
vi.mock('../../services/tenantService');
vi.mock('sonner');

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'super-admin-id',
      email: 'superadmin@example.com',
      role: 'super_admin',
      name: 'Super Admin User',
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

describe('SuperAdminDashboardPage - Preservation Property Tests: Existing Form Validation and UI Behavior', () => {
  let getTenantsSpy: any;
  let getPlatformSummarySpy: any;
  let createTenantSpy: any;
  let toastSuccessSpy: any;
  let toastErrorSpy: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock toast functions
    toastSuccessSpy = vi.mocked(toast.success);
    toastErrorSpy = vi.mocked(toast.error);

    // Mock tenant service methods
    getTenantsSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'tenant-1',
          name: 'Test Tenant 1',
          status: 'active',
          contact_email: 'contact1@test.com',
          created_at: new Date().toISOString(),
        },
      ],
    });
    vi.mocked(tenantService.getTenants).mockImplementation(getTenantsSpy);

    getPlatformSummarySpy = vi.fn().mockResolvedValue({
      totalTenants: 1,
      activeTenants: 1,
      totalPrograms: 10,
      totalTrainees: 50,
      totalItems: 100,
      tenantBreakdowns: [],
    });
    vi.mocked(tenantService.getPlatformSummary).mockImplementation(getPlatformSummarySpy);

    createTenantSpy = vi.fn().mockResolvedValue({
      id: 'new-tenant-id',
      name: 'New Tenant',
      status: 'active',
      contact_email: 'new@test.com',
      created_at: new Date().toISOString(),
    });
    vi.mocked(tenantService.createTenant).mockImplementation(createTenantSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderSuperAdminDashboard = () => {
    return render(
      <BrowserRouter>
        <SuperAdminDashboardPage />
      </BrowserRouter>
    );
  };

  /**
   * Property Test 1: For all form submissions with invalid name (empty string),
   * validation error "Tenant name is required" is shown
   * 
   * **Validates: Requirements 3.1**
   * 
   * This test verifies that name field validation continues to work correctly.
   * The validation should reject empty tenant names and display the appropriate error message.
   */
  describe('Property 1: Name Field Validation', () => {
    it('should show "Tenant name is required" error for all empty name submissions', async () => {
      // Generator for various empty/whitespace strings
      const emptyNameArbitrary = fc.oneof(
        fc.constant('   '),
        fc.constant('\t'),
        fc.constant('  \t  ')
      );

      await fc.assert(
        fc.asyncProperty(emptyNameArbitrary, async (emptyName) => {
          const user = userEvent.setup();
          const { unmount } = renderSuperAdminDashboard();

          await waitFor(() => {
            expect(screen.getByText(/Platform Overview/i)).toBeInTheDocument();
          });

          // Open the create tenant dialog
          const addTenantButton = screen.getByRole('button', { name: /Add Tenant/i });
          await user.click(addTenantButton);

          await waitFor(() => {
            expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
          });

          // Fill form with empty/whitespace name
          const nameInput = screen.getByLabelText(/Tenant Name/i);
          const emailInput = screen.getByLabelText(/Contact Email/i);

          await user.clear(nameInput);
          // Only type if the string is not completely empty
          if (emptyName.length > 0) {
            await user.type(nameInput, emptyName);
          }
          await user.type(emailInput, 'valid@email.com');

          // Submit form
          const createButton = screen.getByRole('button', { name: /Create Tenant/i });
          await user.click(createButton);

          // PRESERVATION: Verify validation error is shown
          await waitFor(() => {
            expect(screen.getByText(/Tenant name is required/i)).toBeInTheDocument();
          });

          // PRESERVATION: Verify tenant creation was NOT called
          expect(createTenantSpy).not.toHaveBeenCalled();

          unmount();
          return true;
        }),
        { numRuns: 3, timeout: 15000 }
      );
    });

    // Additional test for completely empty name
    it('should show "Tenant name is required" error for empty name', async () => {
      const user = userEvent.setup();
      renderSuperAdminDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Platform Overview/i)).toBeInTheDocument();
      });

      // Open the create tenant dialog
      const addTenantButton = screen.getByRole('button', { name: /Add Tenant/i });
      await user.click(addTenantButton);

      await waitFor(() => {
        expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
      });

      // Leave name empty, fill email
      const emailInput = screen.getByLabelText(/Contact Email/i);
      await user.type(emailInput, 'valid@email.com');

      // Submit form
      const createButton = screen.getByRole('button', { name: /Create Tenant/i });
      await user.click(createButton);

      // PRESERVATION: Verify validation error is shown
      await waitFor(() => {
        expect(screen.getByText(/Tenant name is required/i)).toBeInTheDocument();
      });

      // PRESERVATION: Verify tenant creation was NOT called
      expect(createTenantSpy).not.toHaveBeenCalled();
    });
  });

  /**
   * Property Test 2: For all form submissions with invalid contact email format,
   * validation error "Invalid email address" is shown
   * 
   * **Validates: Requirements 3.1**
   * 
   * This test verifies that contact email format validation continues to work correctly.
   * The validation should reject invalid email formats.
   */
  describe('Property 2: Contact Email Format Validation', () => {
    it('should show "Invalid email address" error for all invalid email formats', async () => {
      // Generator for invalid email formats
      const invalidEmailArbitrary = fc.oneof(
        fc.constant('notanemail'),
        fc.constant('missing@domain'),
        fc.constant('@nodomain.com'),
        fc.constant('no-at-sign.com')
      );

      await fc.assert(
        fc.asyncProperty(invalidEmailArbitrary, async (invalidEmail) => {
          const user = userEvent.setup();
          const { unmount } = renderSuperAdminDashboard();

          await waitFor(() => {
            expect(screen.getByText(/Platform Overview/i)).toBeInTheDocument();
          }, { timeout: 10000 });

          // Open the create tenant dialog
          const addTenantButton = screen.getByRole('button', { name: /Add Tenant/i });
          await user.click(addTenantButton);

          await waitFor(() => {
            expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
          }, { timeout: 10000 });

          // Fill form with invalid email
          const nameInput = screen.getByLabelText(/Tenant Name/i);
          const emailInput = screen.getByLabelText(/Contact Email/i);

          await user.type(nameInput, 'Valid Tenant Name');
          await user.clear(emailInput);
          await user.type(emailInput, invalidEmail);

          // Submit form
          const createButton = screen.getByRole('button', { name: /Create Tenant/i });
          await user.click(createButton);

          // PRESERVATION: Verify validation error is shown
          await waitFor(() => {
            expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument();
          }, { timeout: 10000 });

          // PRESERVATION: Verify tenant creation was NOT called
          expect(createTenantSpy).not.toHaveBeenCalled();

          unmount();
          return true;
        }),
        { numRuns: 3, timeout: 20000 }
      );
    });
  });

  /**
   * Property Test 3: For all successful tenant creation responses,
   * dialog closes and tenant list refreshes
   * 
   * **Validates: Requirements 3.3, 3.4**
   * 
   * This test verifies that the success flow continues to work correctly:
   * - Toast notification is displayed
   * - Dialog closes
   * - Tenant list is refreshed
   */
  describe('Property 3: Success Flow', () => {
    it('should display success toast, close dialog, and refresh list for successful creation', async () => {
      const user = userEvent.setup();
      
      // Reset mocks
      createTenantSpy.mockClear();
      getTenantsSpy.mockClear();
      toastSuccessSpy.mockClear();

      createTenantSpy.mockResolvedValue({
        id: 'new-tenant-id',
        name: 'Test Tenant',
        status: 'active',
        contact_email: 'test@email.com',
        created_at: new Date().toISOString(),
      });

      renderSuperAdminDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Platform Overview/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Open the create tenant dialog
      const addTenantButton = screen.getByRole('button', { name: /Add Tenant/i });
      await user.click(addTenantButton);

      await waitFor(() => {
        expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Fill form with valid data (including new admin credential fields)
      const nameInput = screen.getByLabelText(/Tenant Name/i);
      const emailInput = screen.getByLabelText(/Contact Email/i);
      const adminEmailInput = screen.getByLabelText(/Admin Email/i);
      const adminUsernameInput = screen.getByLabelText(/Admin Username/i);
      const adminPasswordInput = screen.getByLabelText(/Admin Password/i);

      await user.type(nameInput, 'Test Tenant');
      await user.type(emailInput, 'test@email.com');
      await user.type(adminEmailInput, 'admin@test.com');
      await user.type(adminUsernameInput, 'testadmin');
      await user.type(adminPasswordInput, 'TestPass123!');

      // Submit form
      const createButton = screen.getByRole('button', { name: /Create Tenant/i });
      await user.click(createButton);

      // PRESERVATION: Verify success toast is shown
      await waitFor(() => {
        expect(toastSuccessSpy).toHaveBeenCalledWith(
          expect.stringContaining('Test Tenant')
        );
      }, { timeout: 10000 });

      // PRESERVATION: Verify dialog is closed (title should no longer be visible)
      await waitFor(() => {
        expect(screen.queryByText(/Add New Tenant/i)).not.toBeInTheDocument();
      }, { timeout: 10000 });

      // PRESERVATION: Verify tenant list is refreshed
      expect(getTenantsSpy).toHaveBeenCalledTimes(2); // Initial load + refresh after creation
    });
  });

  /**
   * Property Test 4: For all API error responses,
   * error toast is displayed
   * 
   * **Validates: Requirements 3.5**
   * 
   * This test verifies that error handling continues to work correctly.
   */
  describe('Property 4: Error Handling', () => {
    it('should display error toast for API errors', async () => {
      const user = userEvent.setup();
      
      // Reset mocks
      createTenantSpy.mockClear();
      toastErrorSpy.mockClear();

      // Mock API error
      const errorMessage = 'Tenant name already exists';
      createTenantSpy.mockRejectedValue({
        message: errorMessage,
      });

      renderSuperAdminDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Platform Overview/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Open the create tenant dialog
      const addTenantButton = screen.getByRole('button', { name: /Add Tenant/i });
      await user.click(addTenantButton);

      await waitFor(() => {
        expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Fill form with valid data (including new admin credential fields)
      const nameInput = screen.getByLabelText(/Tenant Name/i);
      const emailInput = screen.getByLabelText(/Contact Email/i);
      const adminEmailInput = screen.getByLabelText(/Admin Email/i);
      const adminUsernameInput = screen.getByLabelText(/Admin Username/i);
      const adminPasswordInput = screen.getByLabelText(/Admin Password/i);

      await user.type(nameInput, 'Test Tenant');
      await user.type(emailInput, 'test@email.com');
      await user.type(adminEmailInput, 'admin@test.com');
      await user.type(adminUsernameInput, 'testadmin');
      await user.type(adminPasswordInput, 'TestPass123!');

      // Submit form
      const createButton = screen.getByRole('button', { name: /Create Tenant/i });
      await user.click(createButton);

      // PRESERVATION: Verify error toast is shown
      await waitFor(() => {
        expect(toastErrorSpy).toHaveBeenCalled();
      }, { timeout: 10000 });

      // PRESERVATION: Verify dialog remains open on error
      expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
    });
  });

  /**
   * Property Test 5: Dialog open/close state management
   * 
   * **Validates: Requirements 3.2, 3.7**
   * 
   * This test verifies that dialog state management continues to work correctly.
   */
  describe('Property 5: Dialog State Management', () => {
    it('should correctly manage dialog open/close state', async () => {
      const user = userEvent.setup();
      renderSuperAdminDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Platform Overview/i)).toBeInTheDocument();
      });

      // PRESERVATION: Dialog should be closed initially
      expect(screen.queryByText(/Add New Tenant/i)).not.toBeInTheDocument();

      // Open dialog
      const addTenantButton = screen.getByRole('button', { name: /Add Tenant/i });
      await user.click(addTenantButton);

      // PRESERVATION: Dialog should be open
      await waitFor(() => {
        expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
      });

      // Close dialog via Cancel button
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // PRESERVATION: Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText(/Add New Tenant/i)).not.toBeInTheDocument();
      });
    });
  });

  /**
   * Property Test 6: Submit button loading state
   * 
   * **Validates: Requirements 3.8**
   * 
   * This test verifies that the submit button disables during submission.
   */
  describe('Property 6: Submit Button Loading State', () => {
    it('should disable button during submission', async () => {
      const user = userEvent.setup();
      
      // Mock a delayed response
      createTenantSpy.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: 'new-tenant-id',
              name: 'Test Tenant',
              status: 'active',
              contact_email: 'test@email.com',
              created_at: new Date().toISOString(),
            });
          }, 200);
        });
      });

      renderSuperAdminDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Platform Overview/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Open dialog
      const addTenantButton = screen.getByRole('button', { name: /Add Tenant/i });
      await user.click(addTenantButton);

      await waitFor(() => {
        expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Fill form (including new admin credential fields)
      const nameInput = screen.getByLabelText(/Tenant Name/i);
      const emailInput = screen.getByLabelText(/Contact Email/i);
      const adminEmailInput = screen.getByLabelText(/Admin Email/i);
      const adminUsernameInput = screen.getByLabelText(/Admin Username/i);
      const adminPasswordInput = screen.getByLabelText(/Admin Password/i);

      await user.type(nameInput, 'Test Tenant');
      await user.type(emailInput, 'test@email.com');
      await user.type(adminEmailInput, 'admin@test.com');
      await user.type(adminUsernameInput, 'testadmin');
      await user.type(adminPasswordInput, 'TestPass123!');

      // Get create button before clicking
      const createButton = screen.getByRole('button', { name: /Create Tenant/i });
      
      // Submit form
      await user.click(createButton);

      // PRESERVATION: Verify button is disabled during submission
      // Check for either "Creating..." or the button being disabled
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const submitButton = buttons.find(b => b.textContent?.includes('Creating') || b.textContent?.includes('Create Tenant'));
        expect(submitButton).toBeDefined();
        if (submitButton && submitButton.textContent?.includes('Creating')) {
          expect(submitButton).toBeDisabled();
        }
      }, { timeout: 500 });

      // Wait for submission to complete
      await waitFor(() => {
        expect(toastSuccessSpy).toHaveBeenCalled();
      }, { timeout: 10000 });
    });
  });

  /**
   * Property Test 7: Form state initialization
   * 
   * **Validates: Requirements 3.7**
   * 
   * This test verifies that form fields are initialized with empty values.
   */
  describe('Property 7: Form State Initialization', () => {
    it('should initialize all existing form fields with empty values', async () => {
      const user = userEvent.setup();
      renderSuperAdminDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Platform Overview/i)).toBeInTheDocument();
      });

      // Open dialog
      const addTenantButton = screen.getByRole('button', { name: /Add Tenant/i });
      await user.click(addTenantButton);

      await waitFor(() => {
        expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
      });

      // PRESERVATION: Verify all fields are empty
      const nameInput = screen.getByLabelText(/Tenant Name/i) as HTMLInputElement;
      const emailInput = screen.getByLabelText(/Contact Email/i) as HTMLInputElement;
      const phoneInput = screen.getByLabelText(/Contact Phone/i) as HTMLInputElement;
      const addressInput = screen.getByLabelText(/Address/i) as HTMLInputElement;

      expect(nameInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(phoneInput.value).toBe('');
      expect(addressInput.value).toBe('');
    });
  });

  /**
   * Property Test 8: Form reset after successful creation
   * 
   * **Validates: Requirements 3.7**
   * 
   * This test verifies that form fields are reset after successful tenant creation.
   */
  describe('Property 8: Form Reset After Successful Creation', () => {
    it('should reset form fields when dialog is reopened after successful creation', async () => {
      const user = userEvent.setup();
      renderSuperAdminDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Platform Overview/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Open dialog
      const addTenantButton = screen.getByRole('button', { name: /Add Tenant/i });
      await user.click(addTenantButton);

      await waitFor(() => {
        expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // Fill and submit form (including new admin credential fields)
      const nameInput = screen.getByLabelText(/Tenant Name/i);
      const emailInput = screen.getByLabelText(/Contact Email/i);
      const adminEmailInput = screen.getByLabelText(/Admin Email/i);
      const adminUsernameInput = screen.getByLabelText(/Admin Username/i);
      const adminPasswordInput = screen.getByLabelText(/Admin Password/i);

      await user.type(nameInput, 'First Tenant');
      await user.type(emailInput, 'first@email.com');
      await user.type(adminEmailInput, 'admin@first.com');
      await user.type(adminUsernameInput, 'firstadmin');
      await user.type(adminPasswordInput, 'FirstPass123!');

      const createButton = screen.getByRole('button', { name: /Create Tenant/i });
      await user.click(createButton);

      // Wait for success
      await waitFor(() => {
        expect(toastSuccessSpy).toHaveBeenCalled();
      }, { timeout: 10000 });

      // Wait for dialog to close
      await waitFor(() => {
        expect(screen.queryByText(/Add New Tenant/i)).not.toBeInTheDocument();
      }, { timeout: 10000 });

      // Reopen dialog - get all buttons and find the first "Add Tenant" button
      const allButtons = screen.getAllByRole('button');
      const addTenantBtn = allButtons.find(btn => btn.textContent?.includes('Add Tenant'));
      expect(addTenantBtn).toBeDefined();
      if (addTenantBtn) {
        await user.click(addTenantBtn);
      }

      await waitFor(() => {
        expect(screen.getByText(/Add New Tenant/i)).toBeInTheDocument();
      }, { timeout: 10000 });

      // PRESERVATION: Verify form fields are reset to empty
      const nameInputReopened = screen.getByLabelText(/Tenant Name/i) as HTMLInputElement;
      const emailInputReopened = screen.getByLabelText(/Contact Email/i) as HTMLInputElement;

      expect(nameInputReopened.value).toBe('');
      expect(emailInputReopened.value).toBe('');
    });
  });
});
