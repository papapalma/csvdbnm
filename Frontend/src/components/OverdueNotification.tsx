import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
import overdueNotificationService, { OverdueLending } from '../services/overdueNotificationService';
import OverdueDetailsModal from './OverdueDetailsModal';
import logger from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';

export default function OverdueNotification() {
  const { isAuthenticated } = useAuth();
  const [overdueItems, setOverdueItems] = useState<OverdueLending[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    fetchOverdueItems();
    
    // Check for overdue items every 5 minutes
    const interval = setInterval(() => {
      fetchOverdueItems();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const fetchOverdueItems = async () => {
    try {
      setLoading(true);
      const response = await overdueNotificationService.getOverdueLendings();
      const items = response.data || [];
      setOverdueItems(items);
      
      // Show notification if there are overdue items and not dismissed
      if (items.length > 0 && !isDismissed) {
        setIsVisible(true);
      } else if (items.length === 0) {
        setIsVisible(false);
        setIsDismissed(false);
      }
    } catch (error) {
      logger.error('Failed to fetch overdue items', { error });
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
  };

  const handleShowDetails = () => {
    setModalOpen(true);
  };

  // Don't render if not authenticated
  if (!isAuthenticated || !isVisible || overdueItems.length === 0 || loading) {
    return null;
  }

  const totalOverdue = overdueItems.length;
  const criticalCount = overdueItems.filter(item => {
    const daysOverdue = overdueNotificationService.calculateDaysOverdue(item.expected_return_date);
    return daysOverdue > 7;
  }).length;

  return (
    <>
      <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2">
        <Alert variant="destructive" className="shadow-lg border-2">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="flex items-center justify-between">
            <span className="font-semibold">Overdue Items Alert</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive/20"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription className="mt-2">
            <div className="space-y-2">
              <p className="text-sm">
                You have <strong>{totalOverdue}</strong> overdue item{totalOverdue !== 1 ? 's' : ''} 
                {criticalCount > 0 && (
                  <span className="ml-1">
                    (<strong>{criticalCount}</strong> critical)
                  </span>
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-background hover:bg-background/90 text-foreground"
                onClick={handleShowDetails}
              >
                View Details
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>

      <OverdueDetailsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        overdueItems={overdueItems}
        onRefresh={fetchOverdueItems}
      />
    </>
  );
}
