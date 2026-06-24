import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, TenantSelectionRequired } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Eye, EyeOff, ArrowLeft, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, selectTenant, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Tenant selection state
  const [tenantSelection, setTenantSelection] = useState<TenantSelectionRequired | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantLoading, setTenantLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'trainee') {
        navigate('/trainee/dashboard');
      } else if (user.role === 'super_admin') {
        navigate('/super-admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result === true) {
        toast.success('Welcome back!');
        // useEffect handles redirect
      } else if (result === false) {
        toast.error('Invalid email or password');
      } else {
        // Multi-tenant selection required
        setTenantSelection(result as TenantSelectionRequired);
        // Pre-select primary tenant if available
        const primary = (result as TenantSelectionRequired).tenants.find(t => t.is_primary);
        if (primary) setSelectedTenantId(primary.id);
      }
    } catch {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTenantSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantSelection || !selectedTenantId) return;

    setTenantLoading(true);
    try {
      const success = await selectTenant(tenantSelection.selectionToken, selectedTenantId);
      if (success) {
        toast.success('Welcome back!');
        // useEffect handles redirect
      } else {
        toast.error('Failed to select tenant. Please try again.');
      }
    } catch {
      toast.error('Tenant selection failed. Please try again.');
    } finally {
      setTenantLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/5 via-secondary/5 to-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-4">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      {/* Login / Tenant Selection Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <span className="text-2xl text-primary-foreground">BMDC</span>
            </div>
            <h2 className="mb-2">Welcome Back</h2>
            <p className="text-muted-foreground">Sign in to your account to continue</p>
          </div>

          {tenantSelection ? (
            /* Tenant Selection Card */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5" />
                  Select Organization
                </CardTitle>
                <CardDescription>
                  Your account is associated with multiple organizations. Please select one to continue.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTenantSelect} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <div className="space-y-2">
                      {tenantSelection.tenants.map((tenant) => (
                        <button
                          key={tenant.id}
                          type="button"
                          onClick={() => setSelectedTenantId(tenant.id)}
                          className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                            selectedTenantId === tenant.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted'
                          }`}
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Building2 className="size-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{tenant.name}</p>
                            {tenant.is_primary && (
                              <p className="text-xs text-muted-foreground">Primary organization</p>
                            )}
                          </div>
                          {selectedTenantId === tenant.id && (
                            <div className="size-4 rounded-full bg-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={tenantLoading || !selectedTenantId}
                  >
                    {tenantLoading ? 'Signing in...' : 'Continue'}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setTenantSelection(null)}
                  >
                    Back to Login
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            /* Login Card */
            <Card>
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>Enter your credentials to access the system</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
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

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Want to enroll in a program?{' '}
                    <Link to="/register" className="font-medium text-primary hover:underline">
                      Register as a Trainee
                    </Link>
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
