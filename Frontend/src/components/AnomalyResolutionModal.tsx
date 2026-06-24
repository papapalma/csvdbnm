import { useState } from 'react';
import { Anomaly, ResolutionRequest } from '../types/anomaly';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { CheckCircle, XCircle, Wand2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { resolveAnomaly } from '../utils/anomalyApi';
import { Card, CardContent } from './ui/card';
import logger from '../utils/logger';

interface AnomalyResolutionModalProps {
  anomaly: Anomaly | null;
  open: boolean;
  onClose: () => void;
  onResolved: (anomaly: Anomaly) => void;
}

export default function AnomalyResolutionModal({
  anomaly,
  open,
  onClose,
  onResolved
}: AnomalyResolutionModalProps) {
  const [resolutionType, setResolutionType] = useState<'auto_fix' | 'manual' | 'dismiss'>('manual');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!anomaly) return;

    if (!notes.trim()) {
      toast.error('Please provide resolution notes');
      return;
    }

    setIsSubmitting(true);

    try {
      const resolution: ResolutionRequest = {
        resolution_type: resolutionType,
        resolution_notes: notes
      };

      const resolved = await resolveAnomaly(anomaly.id, resolution);
      
      toast.success(
        resolutionType === 'dismiss' 
          ? 'Anomaly dismissed successfully' 
          : 'Anomaly resolved successfully'
      );
      
      onResolved(resolved);
      handleClose();
    } catch (error) {
      logger.error('Error resolving anomaly', { error });
      toast.error('Failed to resolve anomaly');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setResolutionType('manual');
    setNotes('');
    onClose();
  };

  if (!anomaly) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Resolve Anomaly</DialogTitle>
          <DialogDescription>
            Choose how to resolve this data quality issue and provide notes for documentation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Anomaly Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium leading-relaxed">{anomaly.description}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Entity: {anomaly.entity_identifier || 'N/A'}</span>
                  <span>•</span>
                  <span>Type: {anomaly.anomaly_type.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resolution Type */}
          <div className="space-y-3">
            <Label>Resolution Method</Label>
            <RadioGroup value={resolutionType} onValueChange={(v: any) => setResolutionType(v)}>
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="auto_fix" id="auto_fix" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="auto_fix" className="flex items-center gap-2 cursor-pointer">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950">
                          <Wand2 className="size-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="font-semibold">Auto-Fix</p>
                          <p className="text-sm text-muted-foreground font-normal mt-0.5">
                            System automatically corrects the issue
                          </p>
                        </div>
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="manual" id="manual" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="manual" className="flex items-center gap-2 cursor-pointer">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-secondary/10">
                          <CheckCircle className="size-4 text-secondary" />
                        </div>
                        <div>
                          <p className="font-semibold">Manual Resolution</p>
                          <p className="text-sm text-muted-foreground font-normal mt-0.5">
                            I have manually fixed this issue
                          </p>
                        </div>
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="dismiss" id="dismiss" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="dismiss" className="flex items-center gap-2 cursor-pointer">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                          <XCircle className="size-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold">Dismiss</p>
                          <p className="text-sm text-muted-foreground font-normal mt-0.5">
                            This is not an issue or cannot be fixed
                          </p>
                        </div>
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </RadioGroup>
          </div>

          {/* Resolution Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Resolution Notes *</Label>
            <Textarea
              id="notes"
              placeholder="Describe how you resolved this issue or why it was dismissed..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Provide detailed notes for audit and documentation purposes
            </p>
          </div>

          {/* Recommendation */}
          {anomaly.recommendation && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Info className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Recommendation</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {anomaly.recommendation}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Resolving...' : 'Confirm Resolution'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
