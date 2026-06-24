import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import AnomalySummaryCards from '../components/AnomalySummaryCards';
import AnomalyFilters from '../components/AnomalyFilters';
import AnomalyTable from '../components/AnomalyTable';
import AnomalyDetailModal from '../components/AnomalyDetailModal';
import AnomalyResolutionModal from '../components/AnomalyResolutionModal';
import ManualScanButton from '../components/ManualScanButton';
import { Button } from '../components/ui/button';
import { Download, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import logger from '../utils/logger';
import {
  fetchAnomalies,
  getAnomalySummary,
  reopenAnomaly,
  exportAnomaliesToCSV
} from '../utils/anomalyApi';
import { anomalyService } from '../services/anomalyService';
import { Anomaly, AnomalyFilters as Filters, AnomalySummary, AnomalyPagination } from '../types/anomaly';

export default function AnomalyDashboardPage() {
  const { hasPermission } = useAuth();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [summary, setSummary] = useState<AnomalySummary>({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    dismissed: 0
  });
  const [filters, setFilters] = useState<Filters>({});
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [resolutionModalOpen, setResolutionModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedAnomalyIds, setSelectedAnomalyIds] = useState<string[]>([]);
  const [pagination, setPagination] = useState<AnomalyPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Check permissions
  const canViewAnomalies = hasPermission('canViewAnomalies');
  const canResolve = hasPermission('canResolveAnomalies');
  const canExport = hasPermission('canExportAnomalies');
  const canTriggerScan = hasPermission('canTriggerDetection');

  useEffect(() => {
    if (!canViewAnomalies) {
      toast.error('You do not have permission to view anomaly detection');
      return;
    }
    
    loadData();
  }, [canViewAnomalies]);

  const loadData = async () => {
    setIsLoading(true);
    setSelectedAnomalyIds([]);
    try {
      const [anomaliesResult, summaryResult] = await Promise.allSettled([
        fetchAnomalies(filters, 1, pagination.limit),
        getAnomalySummary()
      ]);

      if (anomaliesResult.status === 'fulfilled') {
        setAnomalies(anomaliesResult.value.items);
        setPagination(anomaliesResult.value.pagination);
      } else {
        throw anomaliesResult.reason;
      }

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value);
        setSummaryError(null);
      } else {
        setSummaryError('Unable to load summary statistics right now.');
      }
    } catch (error) {
      logger.error('Error loading anomaly data', { error });
      toast.error('Failed to load anomaly data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnomalies = async (page: number, activeFilters: Filters = filters) => {
    try {
      const data = await fetchAnomalies(activeFilters, page, pagination.limit);
      setAnomalies(data.items);
      setPagination(data.pagination);
      setSelectedAnomalyIds([]);
    } catch (error) {
      logger.error('Error loading anomalies', { error });
      toast.error('Failed to load anomalies');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
    toast.success('Data refreshed successfully');
  };

  const handleViewDetails = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
  };

  const handleResolve = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setResolutionModalOpen(true);
  };

  const handleResolved = async (resolvedAnomaly: Anomaly) => {
    setResolutionModalOpen(false);
    // Update the anomaly in the list
    setAnomalies(prev => 
      prev.map(a => a.id === resolvedAnomaly.id ? resolvedAnomaly : a)
    );
    
    // Update selected anomaly if it's the same
    if (selectedAnomaly?.id === resolvedAnomaly.id) {
      setSelectedAnomaly(resolvedAnomaly);
    }

    // Reload summary
    try {
      const newSummary = await getAnomalySummary();
      setSummary(newSummary);
      setSummaryError(null);
    } catch {
      setSummaryError('Unable to refresh summary statistics.');
    }

    loadAnomalies(pagination.page);
  };

  const handleReopen = async (anomaly: Anomaly) => {
    try {
      const reopened = await reopenAnomaly(anomaly.id);
      setAnomalies(prev =>
        prev.map(a => a.id === reopened.id ? reopened : a)
      );
      if (selectedAnomaly?.id === reopened.id) {
        setSelectedAnomaly(reopened);
      }
      toast.success('Anomaly reopened successfully');
      
      // Reload summary
      try {
        const newSummary = await getAnomalySummary();
        setSummary(newSummary);
        setSummaryError(null);
      } catch {
        setSummaryError('Unable to refresh summary statistics.');
      }
    } catch (error) {
      logger.error('Error reopening anomaly', { error });
      toast.error('Failed to reopen anomaly');
    }
  };

  const handleExport = () => {
    try {
      const csv = exportAnomaliesToCSV(anomalies);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `anomalies-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Anomalies exported to CSV successfully');
    } catch (error) {
      logger.error('Error exporting anomalies', { error });
      toast.error('Failed to export anomalies');
    }
  };

  const handleResetFilters = () => {
    const resetFilters = {};
    setFilters(resetFilters);
    loadAnomalies(1, resetFilters);
  };

  const handleScanComplete = () => {
    loadData();
  };

  const handleFiltersChange = (newFilters: Filters) => {
    setFilters(newFilters);
    loadAnomalies(1, newFilters);
  };

  const handlePageChange = (page: number) => {
    if (page === pagination.page) return;
    loadAnomalies(page);
  };

  const handleBulkDismiss = async () => {
    if (!selectedAnomalyIds.length) {
      toast.error('Select at least one anomaly to dismiss');
      return;
    }

    const reason = window.prompt('Enter reason for dismissing selected anomalies:')?.trim();
    if (!reason) {
      toast.error('Dismiss reason is required');
      return;
    }

    try {
      setIsBulkActionLoading(true);
      await anomalyService.dismissAnomalies(selectedAnomalyIds, reason);
      toast.success(`Dismissed ${selectedAnomalyIds.length} anomalies`);
      await loadData();
    } catch (error) {
      logger.error('Error dismissing anomalies', { error });
      toast.error('Failed to dismiss selected anomalies');
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkAutoResolve = async () => {
    try {
      setIsBulkActionLoading(true);
      const category = filters.category?.length === 1 ? filters.category[0] : undefined;
      const result = await anomalyService.autoResolveAnomalies(category);
      toast.success(`Auto-resolved ${result.resolved} anomalies`);
      await loadData();
    } catch (error) {
      logger.error('Error auto-resolving anomalies', { error });
      toast.error('Failed to auto-resolve anomalies');
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  if (!canViewAnomalies) {
    return <Navigate to="/" state={{ openLogin: true }} replace />;
  }

  return (
    <DashboardLayout title="Data Quality">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <div>
            <h2>Data Quality Dashboard</h2>
            <p className="text-muted-foreground">
              Monitor and resolve data quality issues across all modules
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RotateCcw className={`size-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canExport && anomalies.length > 0 && (
              <Button
                variant="outline"
                onClick={handleExport}
              >
                <Download className="size-4 mr-2" />
                Export CSV
              </Button>
            )}
            {canTriggerScan && (
              <ManualScanButton onScanComplete={handleScanComplete} />
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <AnomalySummaryCards summary={summary} isLoading={isLoading} error={summaryError} />

        {/* Filters */}
        <AnomalyFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onReset={handleResetFilters}
        />

        {/* Anomaly Table */}
        <AnomalyTable
          anomalies={anomalies}
          isLoading={isLoading}
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.total}
          pageSize={pagination.limit}
          selectedIds={selectedAnomalyIds}
          isBulkActionLoading={isBulkActionLoading}
          canResolve={canResolve}
          onPageChange={handlePageChange}
          onSelectedIdsChange={setSelectedAnomalyIds}
          onBulkDismiss={handleBulkDismiss}
          onBulkAutoResolve={handleBulkAutoResolve}
          onViewDetails={handleViewDetails}
        />
      </div>

      {/* Detail Modal */}
      <AnomalyDetailModal
        anomaly={selectedAnomaly}
        open={!!selectedAnomaly}
        onClose={() => setSelectedAnomaly(null)}
        onResolve={handleResolve}
        onReopen={handleReopen}
        canResolve={canResolve}
      />

      {/* Resolution Modal */}
      <AnomalyResolutionModal
        anomaly={selectedAnomaly}
        open={resolutionModalOpen}
        onClose={() => setResolutionModalOpen(false)}
        onResolved={handleResolved}
      />
    </DashboardLayout>
  );
}