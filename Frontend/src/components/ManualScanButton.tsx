import { useState } from 'react';
import { Button } from './ui/button';
import { RefreshCw, Play } from 'lucide-react';
import { toast } from 'sonner';
import { triggerManualScan } from '../utils/anomalyApi';
import logger from '../utils/logger';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';

interface ManualScanButtonProps {
  onScanComplete?: () => void;
  disabled?: boolean;
}

export default function ManualScanButton({ onScanComplete, disabled }: ManualScanButtonProps) {
  const [isScanning, setIsScanning] = useState(false);

  const handleTriggerScan = async () => {
    setIsScanning(true);
    
    try {
      const run = await triggerManualScan();
      
      toast.success(
        `Detection scan completed! Found ${run.total_anomalies_found} anomalies`,
        {
          description: `${run.critical_count} critical, ${run.warning_count} warnings, ${run.info_count} info`
        }
      );
      
      if (onScanComplete) {
        onScanComplete();
      }
    } catch (error) {
      logger.error('Error triggering manual scan', { error });
      toast.error('Failed to trigger detection scan');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled || isScanning}>
          {isScanning ? (
            <>
              <RefreshCw className="size-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Play className="size-4 mr-2" />
              Run Manual Scan
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Trigger Manual Detection Scan?</AlertDialogTitle>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              This will run a comprehensive data quality scan across all modules:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm pl-2">
              <li>Trainee data validation</li>
              <li>Inventory stock reconciliation</li>
              <li>Lending operations review</li>
              <li>Program data integrity checks</li>
              <li>Activity log analysis</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-2">
              The scan typically takes 1-2 minutes to complete. You can continue working while it runs.
            </p>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleTriggerScan}>
            Start Scan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
