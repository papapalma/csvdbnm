import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ReactNode } from 'react';
import { UserRole } from '../utils/roles';

interface ProtectedRouteProps {
  children: ReactNode;
  /** If provided, only users with one of these roles can access the route.
   *  Others are redirected to /dashboard (or /trainee/dashboard for trainee role). */
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ openLogin: true }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role as UserRole)) {
    // Redirect to the appropriate home for their role
    if (user.role === 'trainee') return <Navigate to="/trainee/dashboard" replace />;
    if (user.role === 'super_admin') return <Navigate to="/super-admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
