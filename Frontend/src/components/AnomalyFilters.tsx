import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Search, X, Filter, SlidersHorizontal } from 'lucide-react';
import { AnomalyFilters as Filters, AnomalyCategory, AnomalySeverity, AnomalyStatus } from '../types/anomaly';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface AnomalyFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onReset: () => void;
}

const categoryOptions: { value: AnomalyCategory; label: string; emoji: string }[] = [
  { value: 'trainee', label: 'Trainee Data', emoji: '👤' },
  { value: 'inventory', label: 'Inventory', emoji: '📦' },
  { value: 'lending', label: 'Lending', emoji: '📋' },
  { value: 'program', label: 'Programs', emoji: '🎓' },
  { value: 'activity_log', label: 'Activity Logs', emoji: '📊' },
  { value: 'system', label: 'System', emoji: '⚙️' },
];

const severityOptions: { value: AnomalySeverity; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

const statusOptions: { value: AnomalyStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

export default function AnomalyFilters({ filters, onFiltersChange, onReset }: AnomalyFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.searchQuery || '');

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    onFiltersChange({ ...filters, searchQuery: value });
  };

  const toggleCategory = (category: AnomalyCategory) => {
    const current = filters.category || [];
    const updated = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category];
    onFiltersChange({ ...filters, category: updated.length > 0 ? updated : undefined });
  };

  const toggleSeverity = (severity: AnomalySeverity) => {
    const current = filters.severity || [];
    const updated = current.includes(severity)
      ? current.filter(s => s !== severity)
      : [...current, severity];
    onFiltersChange({ ...filters, severity: updated.length > 0 ? updated : undefined });
  };

  const toggleStatus = (status: AnomalyStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    onFiltersChange({ ...filters, status: updated.length > 0 ? updated : undefined });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.category && filters.category.length > 0) count += filters.category.length;
    if (filters.severity && filters.severity.length > 0) count += filters.severity.length;
    if (filters.status && filters.status.length > 0) count += filters.status.length;
    if (filters.searchQuery) count += 1;
    return count;
  };

  const activeCount = getActiveFilterCount();

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          {/* Search and Filter Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search anomalies by description, type, or entity..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchInput && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap gap-2">
              {/* Category Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="default" className="gap-2">
                    <Filter className="size-4" />
                    <span className="hidden sm:inline">Category</span>
                    {filters.category && filters.category.length > 0 && (
                      <Badge variant="secondary" className="ml-1 px-1.5 h-5 text-xs">
                        {filters.category.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {categoryOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={filters.category?.includes(option.value) || false}
                      onCheckedChange={() => toggleCategory(option.value)}
                    >
                      <span className="mr-2">{option.emoji}</span>
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Severity Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="default" className="gap-2">
                    <SlidersHorizontal className="size-4" />
                    <span className="hidden sm:inline">Severity</span>
                    {filters.severity && filters.severity.length > 0 && (
                      <Badge variant="secondary" className="ml-1 px-1.5 h-5 text-xs">
                        {filters.severity.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filter by Severity</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {severityOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={filters.severity?.includes(option.value) || false}
                      onCheckedChange={() => toggleSeverity(option.value)}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Status Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="default" className="gap-2">
                    <SlidersHorizontal className="size-4" />
                    <span className="hidden sm:inline">Status</span>
                    {filters.status && filters.status.length > 0 && (
                      <Badge variant="secondary" className="ml-1 px-1.5 h-5 text-xs">
                        {filters.status.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {statusOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={filters.status?.includes(option.value) || false}
                      onCheckedChange={() => toggleStatus(option.value)}
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Reset Filters */}
              {activeCount > 0 && (
                <Button variant="ghost" size="default" onClick={onReset} className="gap-2">
                  <X className="size-4" />
                  <span className="hidden sm:inline">Clear</span>
                  <span className="sm:hidden">({activeCount})</span>
                </Button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {activeCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.category?.map((cat) => {
                const option = categoryOptions.find(o => o.value === cat);
                return (
                  <Badge key={cat} variant="secondary" className="gap-2 pl-2 pr-1">
                    <span>{option?.emoji} {option?.label}</span>
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="ml-1 hover:text-foreground rounded-full hover:bg-secondary-foreground/10 p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
              {filters.severity?.map((sev) => (
                <Badge key={sev} variant="outline" className="gap-2 pl-2 pr-1">
                  <span className="capitalize">{sev}</span>
                  <button
                    onClick={() => toggleSeverity(sev)}
                    className="ml-1 hover:text-foreground rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              {filters.status?.map((stat) => (
                <Badge key={stat} variant="outline" className="gap-2 pl-2 pr-1">
                  <span className="capitalize">{stat.replace('_', ' ')}</span>
                  <button
                    onClick={() => toggleStatus(stat)}
                    className="ml-1 hover:text-foreground rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
