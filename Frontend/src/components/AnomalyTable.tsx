import { Anomaly } from '../types/anomaly';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';
import { Eye, AlertTriangle, Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { getSeverityColor, getStatusColor, formatCategoryName, getCategoryIcon } from '../utils/anomalyApi';
import { formatDistanceToNow } from 'date-fns';

interface AnomalyTableProps {
  anomalies: Anomaly[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  selectedIds: string[];
  isBulkActionLoading?: boolean;
  canResolve?: boolean;
  onPageChange: (page: number) => void;
  onSelectedIdsChange: (ids: string[]) => void;
  onBulkDismiss: () => void;
  onBulkAutoResolve: () => void;
  onViewDetails: (anomaly: Anomaly) => void;
}

export default function AnomalyTable({
  anomalies,
  isLoading,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  selectedIds,
  isBulkActionLoading,
  canResolve,
  onPageChange,
  onSelectedIdsChange,
  onBulkDismiss,
  onBulkAutoResolve,
  onViewDetails,
}: AnomalyTableProps) {
  const allSelectedOnPage = anomalies.length > 0 && anomalies.every((a) => selectedIds.includes(a.id));
  const hasSelection = selectedIds.length > 0;
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  const toggleSelectAllOnPage = (checked: boolean) => {
    if (!checked) {
      const pageIds = new Set(anomalies.map((a) => a.id));
      onSelectedIdsChange(selectedIds.filter((id) => !pageIds.has(id)));
      return;
    }

    const merged = new Set([...selectedIds, ...anomalies.map((a) => a.id)]);
    onSelectedIdsChange(Array.from(merged));
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectedIdsChange(Array.from(new Set([...selectedIds, id])));
      return;
    }
    onSelectedIdsChange(selectedIds.filter((selectedId) => selectedId !== id));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded w-32 mb-2"></div>
            <div className="h-4 bg-muted rounded w-48"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex gap-4 p-4 border border-border rounded-lg">
                <div className="h-12 bg-muted rounded flex-1"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (anomalies.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <AlertTriangle className="size-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">No Anomalies Found</h3>
              <p className="text-muted-foreground max-w-md">
                No data quality issues detected. Try adjusting your filters or wait for the next detection scan.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {hasSelection ? `${selectedIds.length} selected` : 'Select anomalies to run bulk actions'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkAutoResolve}
                disabled={isBulkActionLoading || !canResolve}
              >
                <CheckCircle2 className="size-4 mr-2" />
                Auto-Resolve Eligible
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkDismiss}
                disabled={!hasSelection || isBulkActionLoading || !canResolve}
              >
                <XCircle className="size-4 mr-2" />
                Dismiss Selected
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <Card>
          <CardHeader>
            <CardTitle>Detected Anomalies</CardTitle>
            <CardDescription>
              Showing {startIndex}-{endIndex} of {totalCount} {totalCount === 1 ? 'anomaly' : 'anomalies'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={(checked) => toggleSelectAllOnPage(Boolean(checked))}
                      aria-label="Select all anomalies on this page"
                    />
                  </TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((anomaly) => (
                  <TableRow
                    key={anomaly.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onViewDetails(anomaly)}
                    data-state={selectedIds.includes(anomaly.id) ? 'selected' : undefined}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(anomaly.id)}
                        onCheckedChange={(checked) => toggleSelectOne(anomaly.id, Boolean(checked))}
                        aria-label={`Select anomaly ${anomaly.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(anomaly.severity)}>
                        {anomaly.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getCategoryIcon(anomaly.category)}</span>
                        <span className="text-sm">{formatCategoryName(anomaly.category)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="text-sm truncate">{anomaly.description}</p>
                        {anomaly.occurrence_count > 1 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {anomaly.occurrence_count} occurrences
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {anomaly.entity_identifier || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(anomaly.status)}>
                        {anomaly.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {formatDistanceToNow(new Date(anomaly.detected_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetails(anomaly);
                        }}
                      >
                        <Eye className="size-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Detected Anomalies</CardTitle>
            <CardDescription>
              {totalCount} {totalCount === 1 ? 'anomaly' : 'anomalies'} found
            </CardDescription>
          </CardHeader>
        </Card>

        {anomalies.map((anomaly) => (
          <Card
            key={anomaly.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onViewDetails(anomaly)}
          >
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(anomaly.id)}
                    onCheckedChange={(checked) => toggleSelectOne(anomaly.id, Boolean(checked))}
                    aria-label={`Select anomaly ${anomaly.id}`}
                  />
                </div>

                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={getSeverityColor(anomaly.severity)}>
                      {anomaly.severity}
                    </Badge>
                    <Badge variant="outline" className={getStatusColor(anomaly.status)}>
                      {anomaly.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Category */}
                <div className="flex items-center gap-2 text-sm">
                  <span>{getCategoryIcon(anomaly.category)}</span>
                  <span className="font-medium">{formatCategoryName(anomaly.category)}</span>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {anomaly.description}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                  <div className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatDistanceToNow(new Date(anomaly.detected_at), { addSuffix: true })}
                  </div>
                  {anomaly.entity_identifier && (
                    <span className="font-mono">{anomaly.entity_identifier}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  size={undefined}
                />
              </PaginationItem>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => onPageChange(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                        size={undefined}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                }

                if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                return null;
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  size={undefined}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
