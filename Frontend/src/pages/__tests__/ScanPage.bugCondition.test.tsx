import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ScanPage from '../ScanPage';
import * as attendanceService from '../../services/attendanceService';
import { toast } from 'sonner';

/**
 * Bug Condition Exploration Test for Attendance Parameter Error Fix
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4**
 * 
 * This test encodes the EXPECTED BEHAVIOR after the fix is implemented.
 * When run on UNFIXED code, this test MUST FAIL - failure confirms the bug exists.
 * 
 * Bug Condition: isBugCondition(input) where:
 *   - input.selectedSessionId === null OR
 *   - input.selectedSessionId === '' OR
 *   - NOT isValidUUID(input.selectedSessionId)
 * 
 * Expected Behavior Properties (after fix):
 *   - Backend API call is prevented when session_id is invalid
 *   - User receives clear feedback message "Please select a valid session first"
 *   - Cooldown is NOT triggered when validation fails
 *   - User can immediately retry after selecting a valid session
 * 
 * CRITICAL: DO NOT attempt to fix the test or the code when it fails.
 * The test failure is the SUCCESS case for exploration - it proves the bug exists.
 */

// Mock dependencies
vi.mock('../../services/attendanceService');
vi.mock('../../services/inventoryService');
vi.mock('../../services/sessionService');
vi.mock('../../services/programService');
vi.mock('sonner');

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

// Mock jsQR to control QR code detection
vi.mock('jsqr', () => ({
  default: vi.fn(),
}));

describe('ScanPage - Bug Condition Exploration: Invalid Session ID Validation', () => {
  let scanAttendanceSpy: any;
  let toastWarningSpy: any;
  let toastErrorSpy: any;
  let getUserMediaSpy: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock toast functions
    toastWarningSpy = vi.mocked(toast.warning);
    toastErrorSpy = vi.mocked(toast.error);

    // Mock attendance service
    scanAttendanceSpy = vi.fn().mockResolvedValue({
      success: true,
      message: 'Attendance recorded',
      data: {
        trainee: {
          first_name: 'John',
          last_name: 'Doe',
        },
        status: 'present',
      },
    });
    vi.mocked(attendanceService.default.scanAttendance).mockImplementation(scanAttendanceSpy);

    // Mock getUserMedia to prevent actual camera access
    getUserMediaSpy = vi.fn().mockResolvedValue({
      getTracks: () => [{
        stop: vi.fn(),
        getCapabilities: () => ({}),
      }],
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: getUserMediaSpy,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderScanPage = () => {
    return render(
      <BrowserRouter>
        <ScanPage />
      </BrowserRouter>
    );
  };

  /**
   * Property 1: Bug Condition - Invalid Session ID Validation
   * 
   * Test Case 1: Scan with selectedSessionId = null
   * Expected: Should show warning, prevent backend call, NOT trigger cooldown
   * 
   * On UNFIXED code: May show warning but cooldown might still trigger,
   * or backend call might still be attempted in some edge cases
   */
  it('should prevent backend call when selectedSessionId is null', async () => {
    const user = userEvent.setup();
    renderScanPage();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/Live QR Scanner/i)).toBeInTheDocument();
    });

    // Switch to attendance mode (admin starts in item mode by default)
    const attendanceButton = screen.getByRole('button', { name: /Attendance/i });
    await user.click(attendanceButton);

    // Wait for attendance mode to activate
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Paste trainee QR/i)).toBeInTheDocument();
    });

    // No session selected (selectedSessionId = null)

    // Simulate manual QR code entry (easier to test than camera scanning)
    const manualInput = screen.getByPlaceholderText(/Paste trainee QR/i);
    const scanButton = screen.getByRole('button', { name: /^Scan$/i });

    // Enter a trainee QR code
    await user.type(manualInput, 'trainee-qr-code-123');
    await user.click(scanButton);

    // EXPECTED BEHAVIOR (after fix):
    // 1. Backend API call should be prevented
    await waitFor(() => {
      expect(scanAttendanceSpy).not.toHaveBeenCalled();
    });

    // 2. User should receive clear feedback
    await waitFor(() => {
      expect(toastWarningSpy).toHaveBeenCalledWith(
        expect.stringMatching(/select.*session/i)
      );
    });

    // 3. Cooldown should NOT be triggered - user can immediately retry
    // We verify this by attempting another scan immediately
    await user.clear(manualInput);
    await user.type(manualInput, 'trainee-qr-code-456');
    await user.click(scanButton);

    // Should still show warning, not be blocked by cooldown
    await waitFor(() => {
      expect(toastWarningSpy).toHaveBeenCalledTimes(2);
    });
  });

  /**
   * Test Case 2: Scan with selectedSessionId = '' (empty string)
   * Expected: Should prevent backend call, show clear message
   * 
   * On UNFIXED code: Backend call is likely attempted, resulting in 422 error
   */
  it('should prevent backend call when selectedSessionId is empty string', async () => {
    const user = userEvent.setup();
    
    // Mock program and session services to allow session selection
    const programService = await import('../../services/programService');
    const sessionService = await import('../../services/sessionService');
    
    vi.mocked(programService.default.getPrograms).mockResolvedValue({
      success: true,
      data: [{ id: 'prog-1', name: 'Test Program' }],
    } as any);
    
    vi.mocked(sessionService.default.getSessionsByProgram).mockResolvedValue({
      success: true,
      data: [],
    } as any);

    renderScanPage();

    await waitFor(() => {
      expect(screen.getByText(/Live QR Scanner/i)).toBeInTheDocument();
    });

    // Switch to attendance mode
    const attendanceButton = screen.getByRole('button', { name: /Attendance/i });
    await user.click(attendanceButton);

    // Wait for attendance mode to activate
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Paste trainee QR/i)).toBeInTheDocument();
    });

    // In this test, we're simulating the edge case where selectedSessionId
    // somehow becomes an empty string (could happen through state manipulation)
    // Since we can't easily set internal state, we test the scenario where
    // no session is selected, which has the same effect

    const manualInput = screen.getByPlaceholderText(/Paste trainee QR/i);
    const scanButton = screen.getByRole('button', { name: /^Scan$/i });

    await user.type(manualInput, 'trainee-qr-code-789');
    await user.click(scanButton);

    // EXPECTED BEHAVIOR (after fix):
    // Backend call should be prevented
    await waitFor(() => {
      expect(scanAttendanceSpy).not.toHaveBeenCalled();
    });

    // Clear feedback message
    await waitFor(() => {
      expect(toastWarningSpy).toHaveBeenCalledWith(
        expect.stringMatching(/select.*valid.*session/i)
      );
    });
  });

  /**
   * Test Case 3: Scan with selectedSessionId = 'invalid-uuid-format'
   * Expected: Should validate UUID format and prevent backend call
   * 
   * On UNFIXED code: Backend call is attempted with invalid UUID,
   * resulting in 422 validation error from backend
   */
  it('should prevent backend call when selectedSessionId has invalid UUID format', async () => {
    const user = userEvent.setup();
    
    // Mock program and session services
    const programService = await import('../../services/programService');
    const sessionService = await import('../../services/sessionService');
    
    vi.mocked(programService.default.getPrograms).mockResolvedValue({
      success: true,
      data: [{ id: 'prog-1', name: 'Test Program' }],
    } as any);
    
    // Return a session with invalid UUID format
    vi.mocked(sessionService.default.getSessionsByProgram).mockResolvedValue({
      success: true,
      data: [{
        id: 'invalid-uuid-format',
        title: 'Test Session',
        session_date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '10:00',
        program_id: 'prog-1',
      }],
    } as any);

    renderScanPage();

    await waitFor(() => {
      expect(screen.getByText(/Live QR Scanner/i)).toBeInTheDocument();
    });

    // Switch to attendance mode
    const attendanceButton = screen.getByRole('button', { name: /Attendance/i });
    await user.click(attendanceButton);

    // Wait for programs to load
    await waitFor(() => {
      expect(screen.getByText(/Program/i)).toBeInTheDocument();
    });

    // Select the program - need to find the Select trigger button
    const programTrigger = screen.getByText(/Choose a program/i);
    await user.click(programTrigger);
    
    await waitFor(() => {
      const programOption = screen.getByText('Test Program');
      user.click(programOption);
    });

    // Wait for sessions to load and select the invalid session
    await waitFor(() => {
      const sessionButton = screen.getByText('Test Session');
      expect(sessionButton).toBeInTheDocument();
    });

    const sessionButton = screen.getByText('Test Session');
    await user.click(sessionButton);

    // Now attempt to scan with invalid session ID
    const manualInput = screen.getByPlaceholderText(/Paste trainee QR/i);
    const scanButton = screen.getByRole('button', { name: /^Scan$/i });

    await user.type(manualInput, 'trainee-qr-code-999');
    await user.click(scanButton);

    // EXPECTED BEHAVIOR (after fix):
    // Backend call should be prevented due to UUID validation
    await waitFor(() => {
      expect(scanAttendanceSpy).not.toHaveBeenCalled();
    });

    // User should see validation message
    await waitFor(() => {
      expect(toastWarningSpy).toHaveBeenCalledWith(
        expect.stringMatching(/select.*valid.*session/i)
      );
    });
  });

  /**
   * Test Case 4: Verify cooldown is NOT triggered on validation failure
   * Expected: User can immediately retry after validation failure
   * 
   * On UNFIXED code: Cooldown is triggered in handleQRDetected before
   * validation check, preventing immediate retry
   */
  it('should NOT trigger cooldown when validation fails', async () => {
    const user = userEvent.setup();
    renderScanPage();

    await waitFor(() => {
      expect(screen.getByText(/Live QR Scanner/i)).toBeInTheDocument();
    });

    // Switch to attendance mode
    const attendanceButton = screen.getByRole('button', { name: /Attendance/i });
    await user.click(attendanceButton);

    // Wait for attendance mode to activate
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Paste trainee QR/i)).toBeInTheDocument();
    });

    const manualInput = screen.getByPlaceholderText(/Paste trainee QR/i);
    const scanButton = screen.getByRole('button', { name: /^Scan$/i });

    // First scan attempt with no session selected
    await user.type(manualInput, 'trainee-qr-code-001');
    await user.click(scanButton);

    await waitFor(() => {
      expect(toastWarningSpy).toHaveBeenCalledTimes(1);
    });

    // EXPECTED BEHAVIOR (after fix):
    // Should be able to immediately retry without cooldown blocking
    await user.clear(manualInput);
    await user.type(manualInput, 'trainee-qr-code-002');
    await user.click(scanButton);

    // Should show warning again immediately (not blocked by cooldown)
    await waitFor(() => {
      expect(toastWarningSpy).toHaveBeenCalledTimes(2);
    });

    // Third attempt - still should work immediately
    await user.clear(manualInput);
    await user.type(manualInput, 'trainee-qr-code-003');
    await user.click(scanButton);

    await waitFor(() => {
      expect(toastWarningSpy).toHaveBeenCalledTimes(3);
    });

    // Verify backend was never called
    expect(scanAttendanceSpy).not.toHaveBeenCalled();
  });

  /**
   * Test Case 5: Verify user can retry after selecting valid session
   * Expected: After validation failure, selecting a valid session allows successful scan
   * 
   * This tests the complete flow: fail validation → select session → succeed
   */
  it('should allow successful scan after selecting valid session', async () => {
    const user = userEvent.setup();
    
    // Mock program and session services with valid UUID
    const programService = await import('../../services/programService');
    const sessionService = await import('../../services/sessionService');
    
    vi.mocked(programService.default.getPrograms).mockResolvedValue({
      success: true,
      data: [{ id: 'prog-1', name: 'Test Program' }],
    } as any);
    
    const validSessionId = '12345678-1234-1234-1234-123456789abc';
    vi.mocked(sessionService.default.getSessionsByProgram).mockResolvedValue({
      success: true,
      data: [{
        id: validSessionId,
        title: 'Valid Session',
        session_date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '10:00',
        program_id: 'prog-1',
      }],
    } as any);

    renderScanPage();

    await waitFor(() => {
      expect(screen.getByText(/Live QR Scanner/i)).toBeInTheDocument();
    });

    // Switch to attendance mode
    const attendanceButton = screen.getByRole('button', { name: /Attendance/i });
    await user.click(attendanceButton);

    // Wait for attendance mode to activate
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Paste trainee QR/i)).toBeInTheDocument();
    });

    const manualInput = screen.getByPlaceholderText(/Paste trainee QR/i);
    const scanButton = screen.getByRole('button', { name: /^Scan$/i });

    // First attempt without session - should fail validation
    await user.type(manualInput, 'trainee-qr-code-valid');
    await user.click(scanButton);

    await waitFor(() => {
      expect(toastWarningSpy).toHaveBeenCalled();
      expect(scanAttendanceSpy).not.toHaveBeenCalled();
    });

    // Now select a valid session
    const programTrigger = screen.getByText(/Choose a program/i);
    await user.click(programTrigger);
    
    await waitFor(() => {
      const programOption = screen.getByText('Test Program');
      user.click(programOption);
    });

    await waitFor(() => {
      const sessionButton = screen.getByText('Valid Session');
      expect(sessionButton).toBeInTheDocument();
    });

    const sessionButton = screen.getByText('Valid Session');
    await user.click(sessionButton);

    // EXPECTED BEHAVIOR (after fix):
    // Now scan should succeed with valid session
    await user.clear(manualInput);
    await user.type(manualInput, 'trainee-qr-code-valid');
    await user.click(scanButton);

    await waitFor(() => {
      expect(scanAttendanceSpy).toHaveBeenCalledWith({
        session_id: validSessionId,
        qr_code: 'trainee-qr-code-valid',
      });
    });
  });

  /**
   * Test Case 6: Verify clear error messages for session-related errors
   * Expected: When backend returns session validation errors, user sees clear message
   * 
   * On UNFIXED code: Generic error messages don't clearly indicate session issue
   */
  it('should show clear error message when backend returns session validation error', async () => {
    const user = userEvent.setup();
    
    // Mock program and session services with valid UUID
    const programService = await import('../../services/programService');
    const sessionService = await import('../../services/sessionService');
    
    vi.mocked(programService.default.getPrograms).mockResolvedValue({
      success: true,
      data: [{ id: 'prog-1', name: 'Test Program' }],
    } as any);
    
    const validSessionId = '12345678-1234-1234-1234-123456789abc';
    vi.mocked(sessionService.default.getSessionsByProgram).mockResolvedValue({
      success: true,
      data: [{
        id: validSessionId,
        title: 'Valid Session',
        session_date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '10:00',
        program_id: 'prog-1',
      }],
    } as any);

    // Mock backend to return session validation error
    scanAttendanceSpy.mockRejectedValue({
      response: {
        data: {
          message: 'Invalid session ID',
        },
      },
    });

    renderScanPage();

    await waitFor(() => {
      expect(screen.getByText(/Live QR Scanner/i)).toBeInTheDocument();
    });

    // Switch to attendance mode
    const attendanceButton = screen.getByRole('button', { name: /Attendance/i });
    await user.click(attendanceButton);

    // Wait for programs to load
    await waitFor(() => {
      expect(screen.getByText(/Program/i)).toBeInTheDocument();
    });

    // Select program and session
    const programTrigger = screen.getByText(/Choose a program/i);
    await user.click(programTrigger);
    
    await waitFor(() => {
      const programOption = screen.getByText('Test Program');
      user.click(programOption);
    });

    await waitFor(() => {
      const sessionButton = screen.getByText('Valid Session');
      expect(sessionButton).toBeInTheDocument();
    });

    const sessionButton = screen.getByText('Valid Session');
    await user.click(sessionButton);

    // Attempt scan
    const manualInput = screen.getByPlaceholderText(/Paste trainee QR/i);
    const scanButton = screen.getByRole('button', { name: /^Scan$/i });

    await user.type(manualInput, 'trainee-qr-code-test');
    await user.click(scanButton);

    // EXPECTED BEHAVIOR (after fix):
    // Should show clear, actionable error message
    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/invalid.*session.*select.*session/i)
      );
    });
  });
});
