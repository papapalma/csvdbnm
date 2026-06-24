/**
 * PrintableReport Component
 * 
 * This component renders a print-optimized layout of admin report data.
 * It is conditionally rendered when the user clicks the Print button on the ReportsPage.
 * The component transforms chart data into tabular formats suitable for printing.
 * 
 * Requirements: 2.1, 7.1, 7.2, 7.3
 */

import {
  formatPrintDate,
  formatPrintTimestamp,
  calculatePercentage,
  formatReportType,
  formatPrintValue,
} from '../utils/printFormatters';

/**
 * Props interface for the PrintableReport component
 */
export interface PrintableReportProps {
  // Report metadata
  reportTitle: string;
  dateFrom: string;
  dateTo: string;
  reportType: string;
  generatedAt: string;
  
  // Summary statistics
  summaryStats: {
    totalLendings: number;
    itemsReturned: number;
    activeLoans: number;
    newTrainees: number;
  };
  
  // Chart data (already in table-friendly format)
  activityData: Array<{ date: string; borrowed: number; returned: number }>;
  categoryData: Array<{ name: string; value: number }>;
  programData: Array<{ program: string; trainees: number }>;
}

/**
 * PrintHeader Sub-component
 * Displays the report title and organization logo (if available)
 * 
 * Requirement: 7.1
 */
interface PrintHeaderProps {
  reportTitle: string;
}

function PrintHeader({ reportTitle }: PrintHeaderProps) {
  return (
    <div className="print-header">
      <h1>{reportTitle}</h1>
      {/* TODO: Add organization logo if available */}
    </div>
  );
}

/**
 * PrintMetadata Sub-component
 * Displays date range, report type, and generation timestamp
 * 
 * Requirement: 7.2, 7.7
 */
interface PrintMetadataProps {
  dateFrom: string;
  dateTo: string;
  reportType: string;
  generatedAt: string;
}

function PrintMetadata({ dateFrom, dateTo, reportType, generatedAt }: PrintMetadataProps) {
  return (
    <div className="print-metadata">
      <p><strong>Date Range:</strong> {formatPrintDate(dateFrom)} - {formatPrintDate(dateTo)}</p>
      <p><strong>Report Type:</strong> {formatReportType(reportType)}</p>
      <p><strong>Generated:</strong> {formatPrintTimestamp(new Date(generatedAt))}</p>
    </div>
  );
}

/**
 * SummaryStatsTable Sub-component
 * Displays summary statistics in a 2x2 table layout
 * 
 * Requirement: 7.3, 3.4
 */
interface SummaryStatsTableProps {
  stats: {
    totalLendings: number;
    itemsReturned: number;
    activeLoans: number;
    newTrainees: number;
  };
}

function SummaryStatsTable({ stats }: SummaryStatsTableProps) {
  return (
    <div className="summary-stats-table">
      <h2>Summary Statistics</h2>
      <table>
        <tbody>
          <tr>
            <th>Total Lendings</th>
            <td>{formatPrintValue(stats.totalLendings)}</td>
            <th>Items Returned</th>
            <td>{formatPrintValue(stats.itemsReturned)}</td>
          </tr>
          <tr>
            <th>Active Loans</th>
            <td>{formatPrintValue(stats.activeLoans)}</td>
            <th>New Trainees</th>
            <td>{formatPrintValue(stats.newTrainees)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * ActivityTrendTable Sub-component
 * Displays lending activity trend data in tabular format
 * 
 * Requirement: 7.4, 3.5
 */
interface ActivityTrendTableProps {
  data: Array<{ date: string; borrowed: number; returned: number }>;
}

function ActivityTrendTable({ data }: ActivityTrendTableProps) {
  return (
    <div className="activity-trend-table">
      <h2>Lending Activity Trend</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Borrowed</th>
            <th>Returned</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={3} className="text-center">No data available for selected period</td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={index}>
                <td>{row.date}</td>
                <td>{formatPrintValue(row.borrowed)}</td>
                <td>{formatPrintValue(row.returned)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * CategoryDistributionTable Sub-component
 * Displays item category distribution with percentages
 * 
 * Requirement: 7.5, 3.6
 */
interface CategoryDistributionTableProps {
  data: Array<{ name: string; value: number }>;
}

function CategoryDistributionTable({ data }: CategoryDistributionTableProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <div className="category-distribution-table">
      <h2>Items by Category</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={3} className="text-center">No data available for selected period</td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={index}>
                <td>{row.name}</td>
                <td>{formatPrintValue(row.value)}</td>
                <td>{calculatePercentage(row.value, total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ProgramEnrollmentTable Sub-component
 * Displays trainee enrollment by program
 * 
 * Requirement: 7.6, 3.7
 */
interface ProgramEnrollmentTableProps {
  data: Array<{ program: string; trainees: number }>;
}

function ProgramEnrollmentTable({ data }: ProgramEnrollmentTableProps) {
  return (
    <div className="program-enrollment-table">
      <h2>Trainees by Program</h2>
      <table>
        <thead>
          <tr>
            <th>Program</th>
            <th>Trainees</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={2} className="text-center">No data available for selected period</td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={index}>
                <td>{row.program}</td>
                <td>{formatPrintValue(row.trainees)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * PrintFooter Sub-component
 * Displays page numbers and generation timestamp
 * 
 * Requirement: 2.5
 */
interface PrintFooterProps {
  generatedAt: string;
}

function PrintFooter({ generatedAt }: PrintFooterProps) {
  return (
    <div className="print-footer">
      <p>Generated: {formatPrintTimestamp(new Date(generatedAt))}</p>
      {/* Page numbers will be handled by CSS @page rules */}
    </div>
  );
}

/**
 * Main PrintableReport Component
 * Orchestrates all sub-components to create a complete print layout
 * 
 * Requirements: 2.1, 7.1, 7.2, 7.3
 */
export default function PrintableReport(props: PrintableReportProps) {
  const {
    reportTitle,
    dateFrom,
    dateTo,
    reportType,
    generatedAt,
    summaryStats,
    activityData,
    categoryData,
    programData,
  } = props;

  return (
    <div className="print-container">
      <PrintHeader reportTitle={reportTitle} />
      
      <PrintMetadata
        dateFrom={dateFrom}
        dateTo={dateTo}
        reportType={reportType}
        generatedAt={generatedAt}
      />
      
      <SummaryStatsTable stats={summaryStats} />
      
      <ActivityTrendTable data={activityData} />
      
      <CategoryDistributionTable data={categoryData} />
      
      <ProgramEnrollmentTable data={programData} />
      
      <PrintFooter generatedAt={generatedAt} />
    </div>
  );
}
