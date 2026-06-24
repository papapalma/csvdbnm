import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import TraineeDetailsModal, { type TraineeDetailsTab } from '../components/TraineeDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { Search, UserPlus, Edit, MoreVertical, RefreshCw, Download, LayoutGrid, TableIcon, QrCode, Eye, Building2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { generateTraineePDF } from '../utils/pdfGenerator';
import { traineeLogger } from '../utils/activityLogger';
import traineeService from '../services/traineeService';
import programService from '../services/programService';
import { TableSkeleton, CardGridSkeleton, ListSkeleton } from '../components/LoadingSkeletons';
import { toast } from 'sonner';
import logger from '../utils/logger';
import { getThumbnailUrl } from '../services/api';

type ViewMode = 'table' | 'card';

export default function TraineesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTrainee, setSelectedTrainee] = useState<any | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsInitialTab, setDetailsInitialTab] = useState<TraineeDetailsTab>('info');
  const itemsPerPage = 10;
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const [trainees, setTrainees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [programMap, setProgramMap] = useState<Record<string, string>>({});

  // Fetch programs then trainees on mount
  useEffect(() => {
    const init = async () => {
      try {
        const progRes = await programService.getPrograms();
        const map: Record<string, string> = {};
        (progRes.data || []).forEach((p: any) => { map[p.id] = p.name; });
        setProgramMap(map);
        await fetchTrainees(map);
      } catch {
        await fetchTrainees({});
      }
    };
    init();
  }, []);

  const fetchTrainees = async (pMap: Record<string, string> = programMap) => {
    try {
      setLoading(true);
      const response = await traineeService.getTrainees({
        search: searchQuery || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined
      });
      
      // Map backend data to frontend format
      const mappedTrainees = (response.data || []).map((trainee: any) => ({
        id: trainee.id,
        traineeId: trainee.qr_code,
        qr_code: trainee.qr_code,
        name: `${trainee.first_name} ${trainee.last_name}`,
        firstName: trainee.first_name,
        lastName: trainee.last_name,
        email: trainee.email,
        phone: trainee.phone,
        contact: trainee.phone,
        photoUrl: getThumbnailUrl(trainee.thumbnail_path || trainee.photo_path) || undefined,
        status: trainee.status.charAt(0).toUpperCase() + trainee.status.slice(1),
        enrollmentDate: trainee.enrollment_date,
        programId: trainee.program_id,
        programName: trainee.program_id ? (pMap[trainee.program_id] || null) : null,
        trainings: trainee.program_id ? [{
          program: pMap[trainee.program_id] || trainee.program_id,
          status: trainee.status.charAt(0).toUpperCase() + trainee.status.slice(1),
          dateEnrolled: trainee.enrollment_date ? new Date(trainee.enrollment_date).toLocaleDateString() : '',
          dateCompleted: null,
        }] : [],
        createdAt: trainee.created_at,
        updatedAt: trainee.updated_at
      }));
      
      setTrainees(mappedTrainees);
    } catch (error) {
      logger.error('Failed to fetch trainees', { error });
      toast.error('Failed to load trainees');
      setTrainees([]);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchTrainees(programMap);
    }
  }, [searchQuery, filterStatus]);

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('traineesViewMode') as ViewMode;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('traineesViewMode', mode);
    setCurrentPage(1); // Reset to first page when changing view
  };

  const openTraineeDetails = (trainee: any, initialTab: TraineeDetailsTab = 'info') => {
    setSelectedTrainee(trainee);
    setDetailsInitialTab(initialTab);
    setDetailsModalOpen(true);
    
    // Log trainee view
    traineeLogger.viewed(trainee.name, trainee.id.toString());
  };

  const handleTraineeClick = (trainee: any) => {
    openTraineeDetails(trainee, 'info');
  };

  const handleEditFromModal = (id: number) => {
    navigate(`/trainees/${id}/edit`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTrainees(programMap);
    setRefreshing(false);
  };

  const handleBulkDownload = () => {
    filteredTrainees.forEach((trainee, index) => {
      // Add a small delay between downloads to prevent browser blocking
      setTimeout(() => {
        generateTraineePDF(trainee);
      }, index * 500);
    });
    
    // Log bulk export
    traineeLogger.exported('PDF', filteredTrainees.length);
  };

  const filteredTrainees = trainees.filter(trainee => {
    const matchesSearch = trainee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         trainee.trainings.some((training: {program: string}) => training.program.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || trainee.status.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTrainees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTrainees = filteredTrainees.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);
  
  // Log search when query changes
  useEffect(() => {
    if (searchQuery) {
      traineeLogger.searched(searchQuery, filteredTrainees.length);
    }
  }, [searchQuery, filteredTrainees.length]);
  
  // Log filter when status changes
  useEffect(() => {
    if (filterStatus !== 'all') {
      traineeLogger.filtered({ status: filterStatus }, filteredTrainees.length);
    }
  }, [filterStatus, filteredTrainees.length]);

  return (
    <DashboardLayout title="Trainee Management">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2">
              Trainees
              {user?.tenantName && (
                <Badge variant="outline" className="text-xs font-normal">
                  <Building2 className="mr-1 size-3" />
                  {user.tenantName}
                </Badge>
              )}
            </h2>
            <p className="text-muted-foreground">
              Manage trainee profiles and registrations for {user?.tenantName || 'your organization'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none"
              onClick={handleBulkDownload}
              disabled={filteredTrainees.length === 0}
            >
              <Download className="mr-2 size-4" />
              Download All ({filteredTrainees.length})
            </Button>
            {hasPermission('canManageTrainees') && (
              <Button className="flex-1 sm:flex-none" onClick={() => navigate('/trainees/new')}>
                <UserPlus className="mr-2 size-4" />
                Add Trainee
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search trainees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  className={refreshing ? 'animate-spin' : ''}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <div className="hidden sm:flex gap-1 border rounded-md p-1">
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => handleViewModeChange('table')}
                    className="size-8"
                  >
                    <TableIcon className="size-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => handleViewModeChange('card')}
                    className="size-8"
                  >
                    <LayoutGrid className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <>
            {viewMode === 'table' ? (
              <>
                <div className="hidden sm:block">
                  <TableSkeleton rows={itemsPerPage} />
                </div>
                <div className="sm:hidden">
                  <ListSkeleton rows={5} />
                </div>
              </>
            ) : (
              <>
                <div className="hidden sm:block">
                  <CardGridSkeleton count={6} />
                </div>
                <div className="sm:hidden">
                  <ListSkeleton rows={5} />
                </div>
              </>
            )}
          </>
        )}

        {/* Desktop Table View */}
        {!loading && viewMode === 'table' && (
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainee</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTrainees.map((trainee) => (
                    <TableRow 
                      key={trainee.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleTraineeClick(trainee)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            {trainee.photoUrl ? (
                              <img src={trainee.photoUrl} alt={trainee.name} className="size-full object-cover" />
                            ) : (
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {trainee.name.split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <p>{trainee.name}</p>
                            <p className="text-sm text-muted-foreground">{trainee.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{trainee.trainings.map((training: {program: string}) => training.program).join(', ')}</TableCell>
                      <TableCell className="text-muted-foreground">{trainee.contact}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            trainee.status === 'Active' ? 'default' :
                            trainee.status === 'Completed' ? 'secondary' :
                            'outline'
                          }
                        >
                          {trainee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              navigate(`/trainees/${trainee.id}/edit`);
                            }}>
                              <Edit className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              generateTraineePDF(trainee);
                            }}>
                              <Download className="mr-2 size-4" />
                              Download PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Desktop Card View */}
        {!loading && viewMode === 'card' && (
          <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedTrainees.map((trainee) => (
              <Card 
                key={trainee.id} 
                className="group transition-all hover:shadow-lg cursor-pointer"
                onClick={() => handleTraineeClick(trainee)}
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex items-start gap-3">
                    <Avatar className="size-12">
                      {trainee.photoUrl ? (
                        <img src={trainee.photoUrl} alt={trainee.name} className="size-full object-cover" />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {trainee.name.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate">{trainee.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{trainee.trainings.map((training: {program: string}) => training.program).join(', ')}</p>
                    </div>
                    <Badge
                      variant={
                        trainee.status === 'Active' ? 'default' :
                        trainee.status === 'Completed' ? 'secondary' :
                        'outline'
                      }
                      className="shrink-0"
                    >
                      {trainee.status}
                    </Badge>
                  </div>
                  
                  <div className="mb-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="truncate">{trainee.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Contact:</span>
                      <span>{trainee.contact}</span>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden">
                    <div className="flex gap-2 invisible opacity-0 translate-y-3 max-h-0 transition-all duration-300 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-hover:max-h-16 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:max-h-16">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          openTraineeDetails(trainee, 'qr');
                        }}
                      >
                        <QrCode className="mr-2 size-4" />
                        QR Code
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          openTraineeDetails(trainee, 'info');
                        }}
                      >
                        <Eye className="mr-2 size-4" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Mobile Card View */}
        {!loading && <div className="sm:hidden space-y-3">
          {paginatedTrainees.map((trainee) => (
            <Card 
              key={trainee.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleTraineeClick(trainee)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-12">
                    {trainee.photoUrl ? (
                      <img src={trainee.photoUrl} alt={trainee.name} className="size-full object-cover" />
                    ) : (
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {trainee.name.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{trainee.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{trainee.trainings.map((training: {program: string}) => training.program).join(', ')}</p>
                      </div>
                      <Badge
                        variant={
                          trainee.status === 'Active' ? 'default' :
                          trainee.status === 'Completed' ? 'secondary' :
                          'outline'
                        }
                        className="shrink-0"
                      >
                        {trainee.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground truncate">{trainee.contact}</p>
                      <div className="flex gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            openTraineeDetails(trainee, 'qr');
                          }}
                        >
                          <QrCode className="size-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            openTraineeDetails(trainee, 'info');
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>}

        {!loading && filteredTrainees.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No trainees found</p>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredTrainees.length > 0 && totalPages > 1 && (
          <div className="flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    size="default"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Show first page, last page, current page, and pages around current
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          size="default"
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
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
                    size="default"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <TraineeDetailsModal 
        open={detailsModalOpen} 
        onOpenChange={setDetailsModalOpen} 
        trainee={selectedTrainee} 
        initialTab={detailsInitialTab}
        onEdit={handleEditFromModal}
      />
    </DashboardLayout>
  );
}