import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as standalone (already installed)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Don't show prompt if already installed
    if (standalone) {
      return;
    }

    // Check if user previously dismissed the prompt (within 7 days)
    const lastDismissed = localStorage.getItem('pwa-install-dismissed');
    if (lastDismissed) {
      const dismissedDate = new Date(lastDismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 10 seconds or on user interaction
      setTimeout(() => {
        setShowPrompt(true);
      }, 10000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show iOS install prompt immediately if on iOS and not installed
    if (ios && !standalone) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 10000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt && !isIOS) {
      return;
    }

    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('App installation started!');
      }

      // Clear the deferredPrompt
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
    toast.info('You can install the app anytime from Settings');
  };

  const handleIOSDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  if (isStandalone) {
    return null; // Already installed
  }

  if (!showPrompt) {
    return null;
  }

  // iOS Install Instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md">
        <Card className="border-2 border-primary shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="size-5 text-primary" />
                <CardTitle className="text-lg">Install BMDC App</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleIOSDismiss}
                className="h-6 w-6 p-0"
              >
                <X className="size-4" />
              </Button>
            </div>
            <CardDescription>
              Get the full experience with offline access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <p className="font-medium">To install on iOS:</p>
              <ol className="ml-4 space-y-1 list-decimal">
                <li>Tap the Share button <span className="inline-block px-1.5 py-0.5 rounded bg-muted">⎋</span></li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" in the top right corner</li>
              </ol>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleIOSDismiss}
                className="flex-1"
              >
                Maybe Later
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Android/Desktop Install Prompt
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md">
      <Card className="border-2 border-primary shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Download className="size-5 text-primary" />
              <CardTitle className="text-lg">Install BMDC App</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="size-4" />
            </Button>
          </div>
          <CardDescription>
            Install the app for faster access and offline functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <Monitor className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Quick Access</p>
              <p className="text-xs text-muted-foreground">
                Launch directly from your home screen or desktop
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <div className="flex size-10 items-center justify-center rounded-full bg-green-500/10">
              <svg
                className="size-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium">Offline Mode</p>
              <p className="text-xs text-muted-foreground">
                Access key features even without internet
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="flex-1"
            >
              Not Now
            </Button>
            <Button
              size="sm"
              onClick={handleInstallClick}
              className="flex-1"
            >
              <Download className="mr-2 size-4" />
              Install
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
