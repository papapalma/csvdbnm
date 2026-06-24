import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setShowOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {showOffline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-red-600 text-white px-4 py-2 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="size-5" />
            <span className="text-sm font-medium">
              You are currently offline. Some features may be limited.
            </span>
          </div>
        </motion.div>
      )}
      
      {!isOnline && !showOffline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-green-600 text-white px-4 py-2 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <Wifi className="size-5" />
            <span className="text-sm font-medium">
              You are back online!
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
