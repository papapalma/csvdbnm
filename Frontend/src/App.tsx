import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';
import { useEffect } from 'react';
import { initializePWA } from './utils/pwa';
import { initializeDatabase } from './utils/offlineDB';
import { offlineManager } from './utils/offlineManager';
import { toast } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';
import { logger } from './utils/logger';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import OverdueNotification from './components/OverdueNotification';

// Pages
import LandingPage from './pages/NewLandingPage';
import DashboardPage from './pages/DashboardPage';
import TraineesPage from './pages/TraineesPage';
import TraineeFormPage from './pages/TraineeFormPage';
import ItemsPage from './pages/ItemsPage';
import ItemFormPage from './pages/ItemFormPage';
import LendingsPage from './pages/LendingsPage';
import ScanPage from './pages/ScanPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import ProgramsPage from './pages/ProgramsPage';
import ProgramFormPage from './pages/ProgramFormPage';
import CMSSettingsPage from './pages/CMSSettingsPage';
import AccountManagementPage from './pages/AccountManagementPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import AnomalyDashboardPage from './pages/AnomalyDashboardPage';
import OfflinePage from './pages/OfflinePage';
import NotFoundPage from './pages/NotFoundPage';
import TraineeDashboardPage from './pages/TraineeDashboardPage';
import TraineeProfilePage from './pages/TraineeProfilePage';
import TraineeProgramsPage from './pages/TraineeProgramsPage';
import NonAttendanceDatesPage from './pages/NonAttendanceDatesPage';
import AttendancePage from './pages/AttendancePage';
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage';
import SuperAdminReportsPage from './pages/SuperAdminReportsPage';
import PerformanceDashboardPage from './pages/PerformanceDashboardPage';
import ExtensionRequestsPage from './pages/ExtensionRequestsPage';

// Redirect components for login and register
function LoginRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { state: { openLogin: true }, replace: true });
  }, [navigate]);
  return null;
}

function RegisterRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { state: { openRegister: true }, replace: true });
  }, [navigate]);
  return null;
}

export default function App() {
  useEffect(() => {
    initializePWA({
      onOnline: () => {
        toast.success('Connection restored', { description: 'You are back online' });
        offlineManager.syncPendingOperations();
      },
      onOffline: () => {
        toast.warning('Connection lost', {
          description: 'You are now offline. Changes will sync when reconnected.',
        });
      },
    });

    initializeDatabase()
      .then(() => logger.info('Offline database initialized'))
      .catch((error) => logger.error('Failed to initialize offline database', { error }));
  }, []);

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <OfflineIndicator />
            <PWAInstallPrompt />
            <OverdueNotification />
            <Routes>
              {/* ── Public Routes ── */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginRedirect />} />
              <Route path="/register" element={<RegisterRedirect />} />
              <Route path="/offline" element={<OfflinePage />} />

              {/* ── Staff / Admin Routes (local_admin, staff_*, super_admin) ── */}
              <Route path="/dashboard"             element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/trainees"              element={<ProtectedRoute><TraineesPage /></ProtectedRoute>} />
              <Route path="/trainees/new"          element={<ProtectedRoute><TraineeFormPage /></ProtectedRoute>} />
              <Route path="/trainees/:id/edit"     element={<ProtectedRoute><TraineeFormPage /></ProtectedRoute>} />
              <Route path="/items"                 element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
              <Route path="/items/new"             element={<ProtectedRoute><ItemFormPage /></ProtectedRoute>} />
              <Route path="/items/:id/edit"        element={<ProtectedRoute><ItemFormPage /></ProtectedRoute>} />
              <Route path="/lendings"              element={<ProtectedRoute><LendingsPage /></ProtectedRoute>} />
              <Route path="/scan"                  element={<ProtectedRoute><ScanPage /></ProtectedRoute>} />
              <Route path="/programs"              element={<ProtectedRoute><ProgramsPage /></ProtectedRoute>} />
              <Route path="/programs/new"          element={<ProtectedRoute><ProgramFormPage /></ProtectedRoute>} />
              <Route path="/programs/:id/edit"     element={<ProtectedRoute><ProgramFormPage /></ProtectedRoute>} />
              <Route path="/programs/:id/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
              <Route path="/reports"               element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
              <Route path="/activity-logs"         element={<ProtectedRoute><ActivityLogsPage /></ProtectedRoute>} />
              <Route path="/settings"              element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/cms-settings"          element={<ProtectedRoute><CMSSettingsPage /></ProtectedRoute>} />
              <Route path="/account-management"    element={<ProtectedRoute><AccountManagementPage /></ProtectedRoute>} />
              <Route path="/anomalies"             element={<ProtectedRoute><AnomalyDashboardPage /></ProtectedRoute>} />
              <Route path="/non-attendance-dates"  element={<ProtectedRoute><NonAttendanceDatesPage /></ProtectedRoute>} />

              {/* ── Trainee-only Routes ── */}
              <Route path="/trainee/dashboard" element={<ProtectedRoute allowedRoles={['trainee']}><TraineeDashboardPage /></ProtectedRoute>} />
              <Route path="/trainee/profile"   element={<ProtectedRoute allowedRoles={['trainee']}><TraineeProfilePage /></ProtectedRoute>} />
              <Route path="/trainee/programs"  element={<ProtectedRoute allowedRoles={['trainee']}><TraineeProgramsPage /></ProtectedRoute>} />

              {/* ── Role-specific Admin Routes ── */}
              <Route path="/super-admin"         element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboardPage /></ProtectedRoute>} />
              <Route path="/super-admin/reports" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminReportsPage /></ProtectedRoute>} />
              <Route path="/performance"         element={<ProtectedRoute allowedRoles={['super_admin', 'local_admin']}><PerformanceDashboardPage /></ProtectedRoute>} />
              <Route path="/extension-requests"  element={<ProtectedRoute allowedRoles={['super_admin', 'local_admin']}><ExtensionRequestsPage /></ProtectedRoute>} />

              {/* ── 404 ── */}
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
            <Toaster />
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
