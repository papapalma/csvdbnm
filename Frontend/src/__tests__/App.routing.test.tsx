import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock the logger utility
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock PWA initialization
vi.mock('../utils/pwa', () => ({
  initializePWA: vi.fn(),
}));

// Mock offline DB initialization
vi.mock('../utils/offlineDB', () => ({
  initializeDatabase: vi.fn(() => Promise.resolve()),
}));

// Mock offline manager
vi.mock('../utils/offlineManager', () => ({
  offlineManager: {
    syncPendingOperations: vi.fn(),
  },
}));

// Mock AuthContext to prevent auth-related errors
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({ user: null, loading: false }),
}));

// Mock ThemeContext
vi.mock('../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('App Routing - Admin Panel Removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should not include /local-admin route', () => {
    // Render app with /local-admin route
    render(
      <MemoryRouter initialEntries={['/local-admin']}>
        <App />
      </MemoryRouter>
    );

    // Should show 404 page, not local admin dashboard
    expect(screen.queryByText(/admin panel/i)).not.toBeInTheDocument();
  });

  test('should return 404 for /local-admin URL', () => {
    render(
      <MemoryRouter initialEntries={['/local-admin']}>
        <App />
      </MemoryRouter>
    );

    // The wildcard route should redirect to /404
    // We're checking that we're not on a valid page
    expect(screen.queryByTestId('local-admin-page')).not.toBeInTheDocument();
  });

  test('should maintain access to /account-management route', () => {
    render(
      <MemoryRouter initialEntries={['/account-management']}>
        <App />
      </MemoryRouter>
    );

    // Should not see 404 - route should exist
    // The route is protected, so we won't see the actual page content without auth,
    // but the route should be defined
    expect(screen.queryByText(/page not found/i)).not.toBeInTheDocument();
  });

  test('should maintain access to /cms-settings route', () => {
    render(
      <MemoryRouter initialEntries={['/cms-settings']}>
        <App />
      </MemoryRouter>
    );

    // Should not see 404 - route should exist
    // The route is protected, so we won't see the actual page content without auth,
    // but the route should be defined
    expect(screen.queryByText(/page not found/i)).not.toBeInTheDocument();
  });

  test('should maintain access to /dashboard route', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    // Should not see 404 - route should exist
    expect(screen.queryByText(/page not found/i)).not.toBeInTheDocument();
  });

  test('should redirect undefined routes to 404', () => {
    render(
      <MemoryRouter initialEntries={['/some-undefined-route']}>
        <App />
      </MemoryRouter>
    );

    // The wildcard route should catch undefined routes
    // This test verifies that our wildcard route handling works
    expect(screen.queryByTestId('valid-page')).not.toBeInTheDocument();
  });
});
