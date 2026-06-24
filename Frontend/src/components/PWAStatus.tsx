import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import {
  Download,
  Bell,
  BellOff,
  Wifi,
  WifiOff,
  Smartphone,
  HardDrive,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { requestNotificationPermission } from '../utils/pwa';

export default function PWAStatus() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<'active' | 'installing' | 'waiting' | 'none'>('none');

  useEffect(() => {
    // Check if installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.active) {
          setServiceWorkerStatus('active');
        } else if (registration.installing) {
          setServiceWorkerStatus('installing');
        } else if (registration.waiting) {
          setServiceWorkerStatus('waiting');
        }
      });
    }

    // Get storage estimate
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((estimate) => {
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      });
    }

    // Online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleNotificationToggle = async () => {
    if (notificationPermission === 'granted') {
      toast.info('Notification permissions are managed in your browser settings');
      return;
    }

    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      toast.success('Notifications enabled!');
    } else if (permission === 'denied') {
      toast.error('Notifications blocked. Please enable in browser settings.');
    }
  };

  const handleClearCache = async () => {
    if (!('caches' in window)) {
      toast.error('Cache API not supported');
      return;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      toast.success('Cache cleared successfully');
      
      // Update storage estimate
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setStorageEstimate({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      }
    } catch (error) {
      toast.error('Failed to clear cache');
    }
  };

  const handleUpdateServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      toast.error('Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        toast.success('Checking for updates...');
      }
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStoragePercentage = (): number => {
    if (!storageEstimate || storageEstimate.quota === 0) return 0;
    return Math.round((storageEstimate.usage / storageEstimate.quota) * 100);
  };

  return (
    <div className="space-y-4">
      {/* Installation Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="size-5" />
                Installation Status
              </CardTitle>
              <CardDescription>
                Progressive Web App (PWA) installation
              </CardDescription>
            </div>
            {isInstalled ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="mr-1 size-3" />
                Installed
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Info className="mr-1 size-3" />
                Not Installed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isInstalled && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                Install the BMDC app for:
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Faster loading times
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Offline access to cached data
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Home screen shortcut
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  Native app experience
                </li>
              </ul>
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  if (isIOS) {
                    toast.info('Tap the Share button and select "Add to Home Screen"');
                  } else {
                    toast.info('Look for the install prompt in your browser address bar');
                  }
                }}
              >
                <Download className="mr-2 size-4" />
                How to Install
              </Button>
            </div>
          )}

          {isInstalled && (
            <div className="rounded-lg bg-green-500/10 p-4 border border-green-500/20">
              <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                You're using BMDC as an installed app!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="size-5 text-green-600" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="size-5 text-red-600" />
                Offline
              </>
            )}
          </CardTitle>
          <CardDescription>Network connection status</CardDescription>
        </CardHeader>
        <CardContent>
          {isOnline ? (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
              <CheckCircle2 className="size-4" />
              Connected to the internet
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                <XCircle className="size-4" />
                No internet connection
              </div>
              <p className="text-xs text-muted-foreground">
                You can still view cached data while offline
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {notificationPermission === 'granted' ? (
              <Bell className="size-5" />
            ) : (
              <BellOff className="size-5" />
            )}
            Notifications
          </CardTitle>
          <CardDescription>Receive updates and alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">Enable Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Get notified about important updates
              </p>
            </div>
            <Switch
              id="notifications"
              checked={notificationPermission === 'granted'}
              onCheckedChange={handleNotificationToggle}
            />
          </div>

          {notificationPermission === 'denied' && (
            <div className="rounded-lg bg-red-500/10 p-3 border border-red-500/20">
              <p className="text-xs text-red-700 dark:text-red-300">
                Notifications are blocked. Please enable them in your browser settings.
              </p>
            </div>
          )}

          {notificationPermission === 'granted' && (
            <div className="rounded-lg bg-green-500/10 p-3 border border-green-500/20">
              <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                <CheckCircle2 className="size-3" />
                Notifications enabled
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="size-5" />
            Storage
          </CardTitle>
          <CardDescription>App data and cache usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storageEstimate && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">
                  {formatBytes(storageEstimate.usage)} of {formatBytes(storageEstimate.quota)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${getStoragePercentage()}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {getStoragePercentage()}% of available storage used
              </p>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleClearCache}
          >
            <Trash2 className="mr-2 size-4" />
            Clear Cache
          </Button>
        </CardContent>
      </Card>

      {/* Service Worker */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="size-5" />
                Service Worker
              </CardTitle>
              <CardDescription>Background sync and offline support</CardDescription>
            </div>
            <Badge
              variant={serviceWorkerStatus === 'active' ? 'default' : 'secondary'}
              className={serviceWorkerStatus === 'active' ? 'bg-green-500' : ''}
            >
              {serviceWorkerStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {serviceWorkerStatus === 'active' && (
            <div className="rounded-lg bg-green-500/10 p-3 border border-green-500/20">
              <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                <CheckCircle2 className="size-3" />
                Service worker is running properly
              </p>
            </div>
          )}

          {serviceWorkerStatus === 'none' && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                Service worker not registered. Some offline features may not be available.
              </p>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={handleUpdateServiceWorker}
          >
            <RefreshCw className="mr-2 size-4" />
            Check for Updates
          </Button>
        </CardContent>
      </Card>

      {/* PWA Features */}
      <Card>
        <CardHeader>
          <CardTitle>PWA Features</CardTitle>
          <CardDescription>Available progressive web app capabilities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Offline Mode</span>
              {'serviceWorker' in navigator ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="mr-1 size-3" />
                  Supported
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 size-3" />
                  Not Supported
                </Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Push Notifications</span>
              {'Notification' in window ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="mr-1 size-3" />
                  Supported
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 size-3" />
                  Not Supported
                </Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Background Sync</span>
              {'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="mr-1 size-3" />
                  Supported
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 size-3" />
                  Not Supported
                </Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Camera Access</span>
              {'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="mr-1 size-3" />
                  Supported
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 size-3" />
                  Not Supported
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
