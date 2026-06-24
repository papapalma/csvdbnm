import { Anomaly } from '../types/anomaly';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { 
  Clock, 
  User, 
  CheckCircle,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  Info
} from 'lucide-react';
import { getSeverityColor, getStatusColor, formatCategoryName, getCategoryIcon } from '../utils/anomalyApi';
import { format } from 'date-fns';
import { Card, CardContent } from './ui/card';

interface AnomalyDetailModalProps {
  anomaly: Anomaly | null;
  open: boolean;
  onClose: () => void;
  onResolve: (anomaly: Anomaly) => void;
  onReopen: (anomaly: Anomaly) => void;
  canResolve?: boolean;
}

export default function AnomalyDetailModal({
  anomaly,
  open,
  onClose,
  onResolve,
  onReopen,
  canResolve = true
}: AnomalyDetailModalProps) {
  if (!anomaly) return null;

  const isResolved = anomaly.status === 'resolved' || anomaly.status === 'dismissed';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Anomaly Details</DialogTitle>
          <DialogDescription>ID: {anomaly.id}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-12rem)] pr-4">
          <div className="space-y-6">
            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge className={getSeverityColor(anomaly.severity)}>
                <AlertTriangle className="size-3 mr-1" />
                {anomaly.severity}
              </Badge>
              <Badge variant="outline" className={getStatusColor(anomaly.status)}>
                {anomaly.status.replace('_', ' ')}
              </Badge>
              <Badge variant="secondary">
                {getCategoryIcon(anomaly.category)} {formatCategoryName(anomaly.category)}
              </Badge>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Description</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {anomaly.description}
              </p>
            </div>

            {/* Recommendation */}
            {anomaly.recommendation && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="size-4 text-primary" />
                    <h4 className="text-sm font-semibold">Recommendation</h4>
                  </div>
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {anomaly.recommendation}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            <Separator />

            {/* Entity Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Entity Information</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Type</p>
                  <p className="font-medium">{anomaly.entity_type || 'N/A'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Identifier</p>
                  <p className="font-mono text-xs">{anomaly.entity_identifier || 'N/A'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Anomaly Type</p>
                  <p className="font-medium">{anomaly.anomaly_type.replace(/_/g, ' ')}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Occurrences</p>
                  <p className="font-medium">{anomaly.occurrence_count} time(s)</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Timeline */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Timeline</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground">First Detected</span>
                  <span className="text-xs font-medium">
                    {anomaly.first_occurrence_at 
                      ? format(new Date(anomaly.first_occurrence_at), 'MMM d, yyyy h:mm a')
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-lg">
                  <span className="text-xs text-muted-foreground">Last Detected</span>
                  <span className="text-xs font-medium">
                    {format(new Date(anomaly.detected_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                {isResolved && anomaly.resolved_at && (
                  <div className="flex justify-between items-center py-2 px-3 bg-secondary/10 rounded-lg">
                    <span className="text-xs text-muted-foreground">Resolved</span>
                    <span className="text-xs font-medium">
                      {format(new Date(anomaly.resolved_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Resolution Info */}
            {isResolved && anomaly.resolution_notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="size-4 text-secondary" />
                    <h4 className="text-sm font-semibold">Resolution</h4>
                  </div>
                  <Card className="border-secondary/20 bg-secondary/5">
                    <CardContent className="pt-6 space-y-2">
                      {anomaly.auto_resolved && (
                        <Badge variant="outline" className="text-xs mb-2">
                          Auto-Resolved
                        </Badge>
                      )}
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {anomaly.resolution_notes}
                      </p>
                      {anomaly.resolved_by && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                          <User className="size-3" />
                          Resolved by {anomaly.resolved_by}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {/* Metadata */}
            {anomaly.metadata && Object.keys(anomaly.metadata).length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Additional Details</h4>
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs font-mono">
                    {Object.entries(anomaly.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-semibold">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Detection Logic */}
            {anomaly.detection_logic && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Detection Logic</h4>
                  <div className="rounded-lg bg-muted/50 p-3 overflow-x-auto">
                    <code className="text-xs whitespace-pre-wrap break-all">
                      {anomaly.detection_logic}
                    </code>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-border">
          {!isResolved && canResolve && (
            <Button
              onClick={() => onResolve(anomaly)}
              className="flex-1"
            >
              <CheckCircle className="size-4 mr-2" />
              Resolve Anomaly
            </Button>
          )}
          
          {isResolved && canResolve && (
            <Button
              onClick={() => onReopen(anomaly)}
              variant="outline"
              className="flex-1"
            >
              <RotateCcw className="size-4 mr-2" />
              Reopen Anomaly
            </Button>
          )}

          {anomaly.entity_id && (
            <Button
              variant="outline"
              className="flex-1"
            >
              <ExternalLink className="size-4 mr-2" />
              View Entity
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
