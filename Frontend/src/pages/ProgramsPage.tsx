import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import ProgramDetailsModal from '../components/ProgramDetailsModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import logger from '../utils/logger';
import { 
  GraduationCap, 
  Plus, 
  Pencil, 
  Trash2,
  Laptop,
  Wrench,
  ChefHat,
  Users,
  Briefcase,
  Heart,
  Scissors,
  Paintbrush,
  Camera,
  Music,
  Code,
  Car,
  LayoutGrid,
  TableIcon,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import programService from '../services/programService';
import { getThumbnailUrl } from '../services/api';
import { TableSkeleton, CardGridSkeleton } from '../components/LoadingSkeletons';

export interface Program {
  id: string;
  name: string;
  description: string;
  duration: string;
  level: string;
  icon: string;
  status: 'active' | 'inactive';
  startDate: string;
  endDate: string;
  photoUrl: string;
  createdAt: string;
  updatedAt: string;
  instructor?: string;
}

// Helper function to check if program should be inactive based on end date
export const isProgramExpired = (endDate: string): boolean => {
  if (!endDate) return false;
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to compare only dates
  return end < today;
};

// Helper function to get actual program status
export const getProgramStatus = (program: Program): 'active' | 'inactive' => {
  if (isProgramExpired(program.endDate)) {
    return 'inactive';
  }
  return program.status;
};

// Icon options for programs
const iconOptions = [
  { value: 'Laptop', label: 'Computer/Laptop', icon: Laptop },
  { value: 'Wrench', label: 'Technical/Tools', icon: Wrench },
  { value: 'ChefHat', label: 'Culinary/Chef', icon: ChefHat },
  { value: 'Users', label: 'People/Community', icon: Users },
  { value: 'Briefcase', label: 'Business', icon: Briefcase },
  { value: 'Heart', label: 'Healthcare', icon: Heart },
  { value: 'Scissors', label: 'Beauty/Salon', icon: Scissors },
  { value: 'Paintbrush', label: 'Arts/Crafts', icon: Paintbrush },
  { value: 'Camera', label: 'Photography', icon: Camera },
  { value: 'Music', label: 'Music', icon: Music },
  { value: 'Code', label: 'Programming', icon: Code },
  { value: 'Car', label: 'Automotive', icon: Car },
];

const getIconComponent = (iconName: string) => {
  const iconOption = iconOptions.find(opt => opt.value === iconName);
  return iconOption ? iconOption.icon : GraduationCap;
};

export default function ProgramsPage() {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();  const [programs, setPrograms] = useState<Program[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [tablePage, setTablePage] = useState(1);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const tableRowsPerPage = 10;

  // Fetch programs from backend
  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const response = await programService.getPrograms({
        search: searchTerm || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined
      });
      // Handle API response structure
      const programsArray = response?.data || response || [];
      const mappedPrograms: Program[] = programsArray.map((serviceProgram: any) => ({
        id: serviceProgram.id,
        name: serviceProgram.name,
        description: serviceProgram.description || '',
        duration: serviceProgram.duration_weeks ? serviceProgram.duration_weeks.toString() : '',
        level: (serviceProgram as any).level || '',
        icon: 'GraduationCap',
        status: serviceProgram.status === 'active' ? 'active' : 'inactive',
        startDate: serviceProgram.start_date || '',
        endDate: serviceProgram.end_date || '',
        photoUrl: getThumbnailUrl(serviceProgram.thumbnail_path || serviceProgram.image_path),
        createdAt: serviceProgram.created_at || '',
        updatedAt: serviceProgram.updated_at || ''
      }));
      setPrograms(mappedPrograms);
    } catch (error) {
      logger.error('Failed to fetch programs', { error });
      toast.error('Failed to load programs');
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchPrograms();
    }
  }, [searchTerm, filterStatus]);

  const handleEdit = (program: Program) => {
    navigate(`/programs/${program.id}/edit`);
  };

  const handleDelete = async () => {
    if (!selectedProgram) return;

    try {
      await programService.deleteProgram(selectedProgram.id);
      await fetchPrograms(); // Refresh the list
      setDeleteDialogOpen(false);
      setSelectedProgram(null);
      toast.success('Program deleted successfully');
    } catch (error) {
      logger.error('Failed to delete program', { error });
      toast.error('Failed to delete program');
    }
  };

  const openDeleteDialog = (program: Program) => {
    setSelectedProgram(program);
    setDeleteDialogOpen(true);
  };

  // Filter programs
  const filteredPrograms = programs.filter(program => {
    const matchesSearch = program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          program.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || program.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const tableTotalPages = Math.ceil(filteredPrograms.length / tableRowsPerPage);
  const tableStartIndex = (tablePage - 1) * tableRowsPerPage;
  const paginatedTablePrograms = filteredPrograms.slice(tableStartIndex, tableStartIndex + tableRowsPerPage);

  useEffect(() => {
    setTablePage(1);
  }, [searchTerm, filterStatus, viewMode]);

  const canManage = hasPermission('canManagePrograms');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2">
              <GraduationCap className="size-8" />
              Programs Management
              {user?.tenantName && (
                <Badge variant="outline" className="ml-2 text-xs font-normal">
                  <Building2 className="mr-1 size-3" />
                  {user.tenantName}
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">
              Manage training programs offered by {user?.tenantName || 'your organization'}
            </p>
          </div>

          {canManage && (
            <Button onClick={() => navigate('/programs/new')}>
              <Plus className="mr-2 size-4" />
              Add Program
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Input
              placeholder="Search programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden sm:flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="size-8"
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('table')}
              className="size-8"
            >
              <TableIcon className="size-4" />
            </Button>
          </div>
        </div>

        {loading && (
          <>
            {viewMode === 'table' ? (
              <div className="hidden sm:block">
                <TableSkeleton rows={tableRowsPerPage} />
              </div>
            ) : (
              <CardGridSkeleton count={6} />
            )}
          </>
        )}

        {/* Table View */}
        {!loading && viewMode === 'table' && filteredPrograms.length > 0 && (
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTablePrograms.map((program) => {
                    const IconComponent = getIconComponent(program.icon);
                    return (
                      <TableRow
                        key={program.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedProgram(program);
                          setDetailsModalOpen(true);
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {program.photoUrl ? (
                              <div className="size-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shrink-0">
                                <img src={program.photoUrl} alt={program.name} className="size-full object-cover" />
                              </div>
                            ) : (
                              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                <IconComponent className="size-5 text-primary" />
                              </div>
                            )}
                            <div>
                              <p>{program.name}</p>
                              <p className="text-sm text-muted-foreground truncate max-w-md">
                                {program.description}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{program.duration}</TableCell>
                        <TableCell className="text-muted-foreground">{program.level}</TableCell>
                        <TableCell>
                          <Badge variant={program.status === 'active' ? 'default' : 'secondary'}>
                            {program.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <div className="flex gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  handleEdit(program);
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  openDeleteDialog(program);
                                }}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!loading && viewMode === 'table' && tableTotalPages > 1 && (
          <div className="hidden sm:flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setTablePage(prev => Math.max(1, prev - 1))}
                    className={tablePage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    size={undefined}
                  />
                </PaginationItem>

                {Array.from({ length: tableTotalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === tableTotalPages ||
                    (page >= tablePage - 1 && page <= tablePage + 1)
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setTablePage(page)}
                          isActive={tablePage === page}
                          className="cursor-pointer"
                          size={undefined}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }

                  if (page === tablePage - 2 || page === tablePage + 2) {
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
                    onClick={() => setTablePage(prev => Math.min(tableTotalPages, prev + 1))}
                    className={tablePage === tableTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    size={undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* Programs Grid */}
        {!loading && (filteredPrograms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GraduationCap className="size-12 text-muted-foreground mb-4" />
              <h3 className="mb-2">No Programs Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm || filterStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first program'}
              </p>
            </CardContent>
          </Card>
        ) : (viewMode === 'grid' && filteredPrograms.length > 0) && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPrograms.map((program) => {
              const IconComponent = getIconComponent(program.icon);
              return (
                <Card key={program.id} className="group hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedProgram(program);
                    setDetailsModalOpen(true);
                  }}
                >
                  {program.photoUrl && (
                    <div className="w-full h-48 rounded-t-xl overflow-hidden border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                      <img src={program.photoUrl} alt={program.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <IconComponent className="size-6 text-primary" />
                      </div>
                      {canManage && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleEdit(program);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              openDeleteDialog(program);
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <CardTitle>{program.name}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={program.status === 'active' ? 'default' : 'secondary'}>
                        {program.status}
                      </Badge>
                      <Badge variant="outline">{program.duration}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4">{program.description}</CardDescription>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Level:</span>
                      <span className="font-medium">{program.level}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Program?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedProgram?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Program Details Modal */}
        <ProgramDetailsModal
          program={selectedProgram}
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          onEdit={handleEdit}
          canManage={canManage}
        />
      </div>
    </DashboardLayout>
  );
}