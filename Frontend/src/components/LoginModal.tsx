import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, TenantSelectionRequired } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Eye, EyeOff, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '../utils/roles';

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Determine the correct post-login route for a given role. */
function getDashboardRoute(role: UserRole | string): string {
  switch (role) {
    case 'super_admin':  return '/super-admin';
    case 'trainee':      return '/trainee/dashboard';
    default:             return '/dashboard';
  }
}

export default function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const navigate = useNavigate();
  const { login, selectTenant, isAuthenticated, user } = useAuth();

  // ── Credentials step ─────────────────────────────────────────────────────
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  // ── Tenant selection step ────────────────────────────────────────────────
  const [tenantStep, setTenantStep]         = useState(false);
  const [pendingSelection, setPendingSelection] =
    useState<TenantSelectionRequired | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectingTenant, setSelectingTenant]   = useState(false);

  // When already authenticated, close and go to the right dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      onOpenChange(false);
      navigate(getDashboardRoute(user.role));
    }
  }, [isAuthenticated, user, navigate, onOpenChange]);

  const resetState = () => {
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setTenantStep(false);
    setPendingSelection(null);
    setSelectedTenantId('');
  };

  // ── Step 1: credential submit ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result === false) {
        toast.error('Invalid email or password');
        return;
      }

      // Multi-tenant selection required
      if (typeof result === 'object' && result.requiresTenantSelection) {
        setPendingSelection(result as TenantSelectionRequired);
        setSelectedTenantId(
          result.tenants.find((t) => t.is_primary)?.id ?? result.tenants[0]?.id ?? ''
        );
        setTenantStep(true);
        return;
      }

      // Single-tenant direct login — AuthContext has already set the user
      toast.success('Welcome back!');
      onOpenChange(false);
      // Navigation is handled by the isAuthenticated useEffect above
    } catch {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: tenant select submit ──────────────────────────────────────────
  const handleSelectTenant = async () => {
    if (!pendingSelection || !selectedTenantId) return;
    setSelectingTenant(true);

    try {
      const ok = await selectTenant(pendingSelection.selectionToken, selectedTenantId);
      if (ok) {
        toast.success('Welcome back!');
        onOpenChange(false);
        // Navigation handled by isAuthenticated useEffect
      } else {
        toast.error('Tenant selection failed. Please log in again.');
        resetState();
      }
    } catch {
      toast.error('An error occurred. Please try again.');
      resetState();
    } finally {
      setSelectingTenant(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">

        {/* ── Tenant selection step ── */}
        {tenantStep && pendingSelection ? (
          <>
            <DialogHeader className="px-6 pt-6 pb-4">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
                <Building2 className="size-8 text-primary-foreground" />
              </div>
              <DialogTitle className="text-center">Select Organization</DialogTitle>
              <DialogDescription className="text-center">
                Your account belongs to multiple organizations. Choose one to continue.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-2">
              <div className="space-y-2">
                {pendingSelection.tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => setSelectedTenantId(tenant.id)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      selectedTenantId === tenant.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{tenant.name}</span>
                      {tenant.is_primary && (
                        <Badge variant="secondary" className="text-xs">Primary</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 border-t px-6 py-4 bg-muted/30">
              <Button
                variant="outline"
                className="flex-1"
                onClick={resetState}
                disabled={selectingTenant}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleSelectTenant}
                disabled={!selectedTenantId || selectingTenant}
              >
                {selectingTenant ? 'Signing in...' : 'Continue'}
              </Button>
            </div>
          </>
        ) : (
          /* ── Credentials step ── */
          <>
            <DialogHeader className="px-6 pt-6 pb-4">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
                <span className="text-2xl text-primary-foreground">BMDC</span>
              </div>
              <DialogTitle className="text-center">Welcome Back</DialogTitle>
              <DialogDescription className="text-center">
                Sign in to your account to continue
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6">
                <div className="space-y-4 pb-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-input-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-input-background pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t px-6 py-4 bg-muted/30">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
