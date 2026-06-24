import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { WifiOff, RefreshCw, Database, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { getDatabaseSize, getAllItems, STORES } from '../utils/offlineDB';
import { offlineManager } from '../utils/offlineManager';
import logger from '../utils/logger';

export default function OfflinePage() {
  const [, setIsOnline] = useState(navigator.onLine);
  const [dbSize, setDbSize] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [cachedData, setCachedData] = useState<Record<string, number>>({});

  useEffect(() => {
    loadOfflineInfo();

    const handleOnline = () => {
      setIsOnline(true);
      window.location.reload();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check status every 5 seconds
    const interval = setInterval(loadOfflineInfo, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const loadOfflineInfo = async () => {
    try {
      // Get database size
      const size = await getDatabaseSize();
      setDbSize(size);

      // Get pending sync count
      const pending = await offlineManager.getPendingSyncCount();
      setPendingCount(pending);

      // Get cached data counts
      const trainees = await getAllItems(STORES.TRAINEES);
      const items = await getAllItems(STORES.ITEMS);
      const lendings = await getAllItems(STORES.LENDINGS);
      const programs = await getAllItems(STORES.PROGRAMS);

      setCachedData({
        trainees: trainees.length,
        items: items.length,
        lendings: lendings.length,
        programs: programs.length,
      });
    } catch (error) {
      logger.error('Failed to load offline info', { error });
    }
  };

  const handleRetry = () => {
    window.location.reload();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-4">
        {/* Main Offline Card */}
        <Card className="border-2 border-red-500/20">
          <CardContent className="flex flex-col items-center py-12 text-center">
            {/* Offline Icon */}
            <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-red-500/10">
              <WifiOff className="size-12 text-red-500" />
            </div>

            {/* Status Badge */}
            <Badge variant="destructive" className="mb-4">
              <WifiOff className="mr-1 size-3" />
              Offline Mode
            </Badge>

            {/* Message */}
            <h2 className="mb-3 text-2xl font-bold">You're Offline</h2>
            <p className="mb-6 text-muted-foreground max-w-md">
              No internet connection detected. You can still view cached data and make changes that will sync when you're back online.
            </p>

            {/* Retry Button */}
            <Button onClick={handleRetry} size="lg" className="w-full sm:w-auto">
              <RefreshCw className="mr-2 size-5" />
              Try Again
            </Button>
          </CardContent>
        </Card>

        {/* Offline Status Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Cached Data */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4 text-blue-500" />
                Cached Data
              </CardTitle>
              <CardDescription>Available offline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trainees:</span>
                <span className="font-medium">{cachedData.trainees || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items:</span>
                <span className="font-medium">{cachedData.items || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lendings:</span>
                <span className="font-medium">{cachedData.lendings || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Programs:</span>
                <span className="font-medium">{cachedData.programs || 0}</span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Storage Used:</span>
                  <span className="font-medium">{formatBytes(dbSize)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Sync */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-orange-500" />
                Pending Sync
              </CardTitle>
              <CardDescription>Changes waiting to sync</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingCount > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{pendingCount}</span>
                    <Badge variant="secondary">
                      <AlertCircle className="mr-1 size-3" />
                      Pending
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These changes will automatically sync when connection is restored
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center py-4">
                    <CheckCircle2 className="size-12 text-green-500" />
                  </div>
                  <p className="text-sm text-center text-muted-foreground">
                    All changes are synced
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* What Works Offline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What Works Offline</CardTitle>
            <CardDescription>Features available without internet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">View Cached Data</p>
                  <p className="text-xs text-muted-foreground">
                    Browse previously loaded information
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Create & Edit</p>
                  <p className="text-xs text-muted-foreground">
                    Make changes that sync later
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Navigate Pages</p>
                  <p className="text-xs text-muted-foreground">
                    Access cached routes
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">
                    All settings work offline
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="size-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Offline Tips</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Your changes are saved locally and will sync automatically</li>
                  <li>• Check your WiFi or mobile data connection</li>
                  <li>• Some features like QR scanning require internet</li>
                  <li>• The app will automatically reconnect when online</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}