import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AlertTriangle, Calendar, User, Package, Phone } from 'lucide-react';
import { OverdueLending } from '../services/overdueNotificationService';
import overdueNotificationService from '../services/overdueNotificationService';
import { Link } from 'react-router-dom';

interface OverdueDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overdueItems: OverdueLending[];
  onRefresh?: () => void;
}

export default function OverdueDetailsModal({
  open,
  onOpenChange,
  overdueItems,
}: OverdueDetailsModalProps) {
  const getSeverityColor = (daysOverdue: number) => {
    if (daysOverdue > 7) return 'destructive';
    if (daysOverdue > 3) return 'default';
    return 'secondary';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Overdue Items ({overdueItems.length})
          </DialogTitle>
          <DialogDescription>
            Items that have passed their expected return date and require immediate attention.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {overdueItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No overdue items found.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueItems.map((item) => {
                    const daysOverdue = overdueNotificationService.calculateDaysOverdue(
                      item.expected_return_date
                    );
                    const borrowerName = item.trainee
                      ? `${item.trainee.first_name} ${item.trainee.last_name}`
                      : item.borrower_name || 'Unknown';

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{item.item?.name || 'Unknown Item'}</div>
                              {item.notes && (
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {item.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="font-medium">{borrowerName}</div>
                              {item.borrower_contact && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {item.borrower_contact}
                                </div>
                              )}
                              {item.trainee && (
                                <Link
                                  to={`/trainees/${item.trainee_id}`}
                                  className="text-xs text-primary hover:underline"
                                >
                                  View Profile
                                </Link>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{formatDate(item.expected_return_date)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSeverityColor(daysOverdue)}>
                            {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{item.quantity}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to="/lendings">
                            <Button variant="outline" size="sm">
                              Manage
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <strong>Legend:</strong>
              <span className="ml-2">
                <Badge variant="secondary" className="mr-2">1-3 days</Badge>
                <Badge variant="default" className="mr-2">4-7 days</Badge>
                <Badge variant="destructive">7+ days (Critical)</Badge>
              </span>
            </div>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
