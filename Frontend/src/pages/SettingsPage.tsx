import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import PWAStatus from '../components/PWAStatus';
import { useTheme } from '../contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Bell, Moon, Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { isDark, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if PWA is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsPWAInstalled(true);
    }

    // Listen for PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setIsPWAInstalled(true);
      setDeferredPrompt(null);
      toast.success('App installed successfully!');
    });
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('Installing app...');
      }
      setDeferredPrompt(null);
    } else if (isPWAInstalled) {
      toast.info('App is already installed!');
    } else {
      toast.info('To install: Use browser menu > "Add to Home Screen"');
    }
  };

  const handleNotificationToggle = (checked: boolean) => {
    setNotifications(checked);
    if (checked && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          toast.success('Notifications enabled');
        }
      });
    } else {
      toast.info('Notifications disabled');
    }
  };

  return (
    <DashboardLayout title="Settings">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h2>Settings</h2>
          <p className="text-muted-foreground">Manage your app preferences and configuration</p>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:block space-y-6">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel of the app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="size-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="dark-mode">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Switch between light and dark theme
                    </p>
                  </div>
                </div>
                <Switch
                  id="dark-mode"
                  checked={isDark}
                  onCheckedChange={toggleTheme}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="size-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="push-notifications">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications for overdue items
                    </p>
                  </div>
                </div>
                <Switch
                  id="push-notifications"
                  checked={notifications}
                  onCheckedChange={handleNotificationToggle}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive daily summary via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
            </CardContent>
          </Card>

          {/* PWA Status & Advanced Settings */}
          <div>
            <h3 className="text-lg font-semibold mb-4">PWA Advanced Settings</h3>
            <PWAStatus />
          </div>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>Application information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Version:</span>
                <span>1.0.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Build:</span>
                <span>2024.10.31</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Environment:</span>
                <span>Production</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile Layout (Accordion) */}
        <Accordion type="single" collapsible className="md:hidden space-y-4">
          <AccordionItem value="appearance" className="rounded-lg border bg-card px-4">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <Moon className="size-5" />
                <span>Appearance</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label htmlFor="dark-mode-mobile">Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Switch theme
                  </p>
                </div>
                <Switch
                  id="dark-mode-mobile"
                  checked={isDark}
                  onCheckedChange={toggleTheme}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notifications" className="rounded-lg border bg-card px-4">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <Bell className="size-5" />
                <span>Notifications</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label htmlFor="push-notifications-mobile">Push Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Overdue alerts
                  </p>
                </div>
                <Switch
                  id="push-notifications-mobile"
                  checked={notifications}
                  onCheckedChange={handleNotificationToggle}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications-mobile">Email</Label>
                  <p className="text-xs text-muted-foreground">
                    Daily summary
                  </p>
                </div>
                <Switch
                  id="email-notifications-mobile"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="pwa" className="rounded-lg border bg-card px-4">
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <Smartphone className="size-5" />
                <span>Install App</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              {isPWAInstalled ? (
                <Alert className="mt-2">
                  <CheckCircle2 className="size-4" />
                  <AlertDescription>App is installed!</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Install for offline access and faster performance
                  </p>
                  <Button className="w-full" onClick={handleInstallPWA}>
                    <Download className="mr-2 size-4" />
                    Install Now
                  </Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Save Button - Mobile */}
        <div className="md:hidden">
          <Button className="w-full" onClick={() => toast.success('Settings saved!')}>
            Save Settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}