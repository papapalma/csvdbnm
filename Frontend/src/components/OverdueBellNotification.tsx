import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Bell } from 'lucide-react';
import overdueNotificationService from '../services/overdueNotificationService';
import OverdueDetailsModal from './OverdueDetailsModal';
import logger from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';

export default function OverdueBellNotification() {
  const { user, isAuthenticated } = useAuth();
  const [overdueItems, setOverdueItems] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  // Only show for roles that manage inventory (matches backend role names)
  const shouldShow = isAuthenticated && user &&
    ['super_admin', 'local_admin', 'staff_inventory_manager'].includes(user.role);

  useEffect(() => {
    if (!shouldShow) {
      return;
    }

    fetchOverdueItems();
    
    // Check for overdue items every 5 minutes
    const interval = setInterval(() => {
      fetchOverdueItems();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [shouldShow]);

  const fetchOverdueItems = async () => {
    try {
      const response = await overdueNotificationService.getOverdueLendings();
      const items = response.data || [];
      setOverdueItems(items);
    } catch (error) {
      logger.error('Failed to fetch overdue items for bell notification', { error });
    }
  };

  const handleBellClick = () => {
    setModalOpen(true);
  };

  if (!shouldShow) {
    return null;
  }

  const overdueCount = overdueItems.length;
  const hasCritical = overdueItems.some(item => {
    const daysOverdue = overdueNotificationService.calculateDaysOverdue(item.expected_return_date);
    return daysOverdue > 7;
  });

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBellClick}
          className={`relative ${overdueCount > 0 ? 'hover:bg-destructive/10' : ''}`}
          title={overdueCount > 0 ? `${overdueCount} overdue item${overdueCount !== 1 ? 's' : ''}` : 'No overdue items'}
        >
          <Bell className={`size-5 ${overdueCount > 0 ? 'text-destructive' : ''}`} />
          {overdueCount > 0 && (
            <>
              {/* Badge with count */}
              <Badge
                variant={hasCritical ? 'destructive' : 'default'}
                className="absolute -top-1 -right-1 size-5 flex items-center justify-center p-0 text-[10px] font-bold rounded-full"
              >
                {overdueCount > 99 ? '99+' : overdueCount}
              </Badge>
              {/* Pulse animation for critical items */}
              {hasCritical && (
                <span className="absolute -top-1 -right-1 size-5 rounded-full bg-destructive animate-ping opacity-75" />
              )}
            </>
          )}
        </Button>
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
