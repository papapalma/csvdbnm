import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { CheckCircle2, Clock, AlertTriangle, QrCode, Download, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { generateLendingsPDF } from '../utils/pdfGenerator';
import lendingService from '../services/lendingService';
import AddLendingModal from '../components/AddLendingModal';
import { StatCardsSkeleton, TableSkeleton, CardGridSkeleton, ListSkeleton } from '../components/LoadingSkeletons';
import logger from '../utils/logger';

type ViewMode = 'table' | 'card';

export default function LendingsPage() {
  const [activeTab, setActiveTab] = useState('borrowed');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPages, setCurrentPages] = useState({
    borrowed: 1,
    returned: 1,
    overdue: 1,
  });
  const itemsPerPage = 10;
  const [lendings, setLendings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lendingModalOpen, setLendingModalOpen] = useState(false);

  // Fetch lendings from backend
  useEffect(() => {
    fetchLendings();
  }, []);

  const fetchLendings = async () => {
    try {
      setLoading(true);
      const response = await lendingService.getLendingRecords();
      
      // Map backend data to frontend format
      const mappedLendings = (response.data || []).map((lending: any) => ({
        id: lending.id,
        trainee: lending.trainee
          ? `${lending.trainee.first_name} ${lending.trainee.last_name}`
          : (lending.borrower_name ?? lending.trainee_id ?? 'Unknown'),
        traineeId: lending.trainee_id,
        borrowerName: lending.borrower_name,
        borrowerContact: lending.borrower_contact,
        item: lending.item?.name ?? 'Unknown item',
        itemId: lending.item_id,
        quantity: lending.quantity,
        borrowedDate: lending.lent_date,
        dueDate: lending.expected_return_date,
        returnedDate: lending.actual_return_date,
        status: lending.status,
        notes: lending.notes,
        createdAt: lending.created_at,
        updatedAt: lending.updated_at
      }));
      
      setLendings(mappedLendings);
    } catch (error) {
      logger.error('Failed to fetch lendings', { error });
      toast.error('Failed to load lending records');
      setLendings([]);
    } finally {
      setLoading(false);
    }
  };

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('lendingsViewMode') as ViewMode;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  const setCurrentPage = (tab: 'borrowed' | 'returned' | 'overdue', page: number) => {
    setCurrentPages(prev => ({ ...prev, [tab]: page }));
  };

  const borrowed = lendings.filter(l => l.status === 'active');
  const returned = lendings.filter(l => l.status === 'returned');
  const overdue = lendings.filter(l => l.status === 'overdue');

  // Pagination for borrowed
  const borrowedTotalPages = Math.ceil(borrowed.length / itemsPerPage);
  const borrowedStartIndex = (currentPages.borrowed - 1) * itemsPerPage;
  const paginatedBorrowed = borrowed.slice(borrowedStartIndex, borrowedStartIndex + itemsPerPage);

  // Pagination for returned
  const returnedTotalPages = Math.ceil(returned.length / itemsPerPage);
  const returnedStartIndex = (currentPages.returned - 1) * itemsPerPage;
  const paginatedReturned = returned.slice(returnedStartIndex, returnedStartIndex + itemsPerPage);

  // Pagination for overdue
  const overdueTotalPages = Math.ceil(overdue.length / itemsPerPage);
  const overdueStartIndex = (currentPages.overdue - 1) * itemsPerPage;
  const paginatedOverdue = overdue.slice(overdueStartIndex, overdueStartIndex + itemsPerPage);

  const handleReturn = async (id: number, itemName: string) => {
    try {
      await lendingService.returnItem(id.toString(), {});
      await fetchLendings();
      toast.success(`${itemName} marked as returned`);
    } catch (error) {
      logger.error('Failed to return item', { error });
      toast.error('Failed to mark item as returned');
    }
  };

  const LendingCard = ({ lending }: { lending: typeof lendings[0] }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar>
            <AvatarFallback className="bg-primary/10 text-primary">
              {lending.trainee.split(' ').map((n: string) => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="flex-1">
                <p>{lending.trainee}</p>
                <p className="text-sm text-muted-foreground">{lending.item}</p>
              </div>
              <Badge
                variant={
                  lending.status === 'returned' ? 'secondary' :
                  lending.status === 'overdue' ? 'destructive' :
                  'default'
                }
                className="shrink-0"
              >
                {lending.status}
              </Badge>
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Borrowed: {new Date(lending.borrowedDate).toLocaleDateString()}</p>
              <p>Due: {new Date(lending.dueDate).toLocaleDateString()}</p>
              {lending.returnedDate && (
                <p>Returned: {new Date(lending.returnedDate).toLocaleDateString()}</p>
              )}
            </div>
            {!lending.returnedDate && (
              <Button
                size="sm"
                className="mt-3 w-full"
                variant={lending.status === 'overdue' ? 'destructive' : 'default'}
                onClick={() => handleReturn(lending.id, lending.item)}
              >
                <CheckCircle2 className="mr-2 size-4" />
                Mark as Returned
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout title="Lending Management">
      <AddLendingModal
        open={lendingModalOpen}
        onOpenChange={setLendingModalOpen}
        onSuccess={fetchLendings}
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2>Lendings</h2>
            <p className="text-muted-foreground">Track borrowing and returning of items</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none" 
              onClick={() => {
                const currentLendings = activeTab === 'borrowed' ? borrowed :
                                       activeTab === 'returned' ? returned :
                                       overdue;
                
                if (currentLendings.length === 0) {
                  toast.error('No lendings to download');
                  return;
                }
                
                const title = activeTab === 'borrowed' ? 'Borrowed Items Report' :
                             activeTab === 'returned' ? 'Returned Items Report' :
                             'Overdue Items Report';
                
                generateLendingsPDF(currentLendings, title);
                toast.success('PDF downloaded successfully');
              }}
            >
              <Download className="mr-2 size-4" />
              Download PDF
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              onClick={() => setLendingModalOpen(true)}
            >
              <PackagePlus className="mr-2 size-4" />
              New Lending
            </Button>
            <Link to="/scan" className="flex-1 sm:flex-none">
              <Button variant="outline" className="w-full">
                <QrCode className="mr-2 size-4" />
                Scan QR Code
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <StatCardsSkeleton count={3} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Borrowed</p>
                    <h2 className="mt-1">{borrowed.length}</h2>
                  </div>
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                    <Clock className="size-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Returned</p>
                    <h2 className="mt-1">{returned.length}</h2>
                  </div>
                  <div className="flex size-12 items-center justify-center rounded-lg bg-secondary/10">
                    <CheckCircle2 className="size-6 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                    <h2 className="mt-1">{overdue.length}</h2>
                  </div>
                  <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10">
                    <AlertTriangle className="size-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="borrowed">Borrowed ({borrowed.length})</TabsTrigger>
            <TabsTrigger value="returned">Returned ({returned.length})</TabsTrigger>
            <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
          </TabsList>

          {loading && (
            <>
              <TabsContent value="borrowed" className="space-y-4 mt-4">
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
              </TabsContent>

              <TabsContent value="returned" className="space-y-4 mt-4">
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
              </TabsContent>

              <TabsContent value="overdue" className="space-y-4 mt-4">
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
              </TabsContent>
            </>
          )}

          {/* Desktop Table Views */}
          {!loading && viewMode === 'table' && (
            <>
              <TabsContent value="borrowed" className="hidden sm:block space-y-4">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Trainee</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Borrowed</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedBorrowed.map((lending) => (
                          <TableRow key={lending.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="size-8">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {lending.trainee.split(' ').map((n: string) => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                {lending.trainee}
                              </div>
                            </TableCell>
                            <TableCell>{lending.item}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(lending.borrowedDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(lending.dueDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="default">Active</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => handleReturn(lending.id, lending.item)}
                              >
                                Return
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                {borrowed.length > 0 && borrowedTotalPages > 1 && (
                  <PaginationComponent
                    currentPage={currentPages.borrowed}
                    totalPages={borrowedTotalPages}
                    onPageChange={(page) => setCurrentPage('borrowed', page)}
                  />
                )}
              </TabsContent>
            </>
          )}

          {!loading && viewMode === 'table' && (
            <TabsContent value="returned" className="hidden sm:block space-y-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainee</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Borrowed</TableHead>
                        <TableHead>Returned</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReturned.map((lending) => (
                        <TableRow key={lending.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {lending.trainee.split(' ').map((n: string) => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              {lending.trainee}
                            </div>
                          </TableCell>
                          <TableCell>{lending.item}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(lending.borrowedDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {lending.returnedDate && new Date(lending.returnedDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">Returned</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              {returned.length > 0 && returnedTotalPages > 1 && (
                <PaginationComponent
                  currentPage={currentPages.returned}
                  totalPages={returnedTotalPages}
                  onPageChange={(page) => setCurrentPage('returned', page)}
                />
              )}
            </TabsContent>
          )}

          {!loading && viewMode === 'table' && (
            <TabsContent value="overdue" className="hidden sm:block space-y-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainee</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Days Overdue</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOverdue.map((lending) => {
                        const daysOverdue = Math.floor(
                          (new Date().getTime() - new Date(lending.dueDate).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return (
                          <TableRow key={lending.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="size-8">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {lending.trainee.split(' ').map((n: string) => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                {lending.trainee}
                              </div>
                            </TableCell>
                            <TableCell>{lending.item}</TableCell>
                            <TableCell className="text-destructive">
                              {new Date(lending.dueDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-destructive">
                              {daysOverdue} days
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive">Overdue</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReturn(lending.id, lending.item)}
                              >
                                Return
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              {overdue.length > 0 && overdueTotalPages > 1 && (
                <PaginationComponent
                  currentPage={currentPages.overdue}
                  totalPages={overdueTotalPages}
                  onPageChange={(page) => setCurrentPage('overdue', page)}
                />
              )}
            </TabsContent>
          )}

          {/* Desktop Card Views */}
          {!loading && viewMode === 'card' && (
            <>
              <TabsContent value="borrowed" className="hidden sm:block space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedBorrowed.map((lending) => (
                    <LendingCard key={lending.id} lending={lending} />
                  ))}
                </div>
                {borrowed.length > 0 && borrowedTotalPages > 1 && (
                  <PaginationComponent
                    currentPage={currentPages.borrowed}
                    totalPages={borrowedTotalPages}
                    onPageChange={(page) => setCurrentPage('borrowed', page)}
                  />
                )}
              </TabsContent>

              <TabsContent value="returned" className="hidden sm:block space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedReturned.map((lending) => (
                    <LendingCard key={lending.id} lending={lending} />
                  ))}
                </div>
                {returned.length > 0 && returnedTotalPages > 1 && (
                  <PaginationComponent
                    currentPage={currentPages.returned}
                    totalPages={returnedTotalPages}
                    onPageChange={(page) => setCurrentPage('returned', page)}
                  />
                )}
              </TabsContent>

              <TabsContent value="overdue" className="hidden sm:block space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedOverdue.map((lending) => (
                    <LendingCard key={lending.id} lending={lending} />
                  ))}
                </div>
                {overdue.length > 0 && overdueTotalPages > 1 && (
                  <PaginationComponent
                    currentPage={currentPages.overdue}
                    totalPages={overdueTotalPages}
                    onPageChange={(page) => setCurrentPage('overdue', page)}
                  />
                )}
              </TabsContent>
            </>
          )}

          {/* Mobile Card Views */}
          {!loading && (
            <TabsContent value="borrowed" className="sm:hidden space-y-3 mt-4">
              {paginatedBorrowed.map((lending) => (
                <LendingCard key={lending.id} lending={lending} />
              ))}
              {borrowed.length > 0 && borrowedTotalPages > 1 && (
                <PaginationComponent
                  currentPage={currentPages.borrowed}
                  totalPages={borrowedTotalPages}
                  onPageChange={(page) => setCurrentPage('borrowed', page)}
                />
              )}
            </TabsContent>
          )}

          {!loading && (
            <TabsContent value="returned" className="sm:hidden space-y-3 mt-4">
              {paginatedReturned.map((lending) => (
                <LendingCard key={lending.id} lending={lending} />
              ))}
              {returned.length > 0 && returnedTotalPages > 1 && (
                <PaginationComponent
                  currentPage={currentPages.returned}
                  totalPages={returnedTotalPages}
                  onPageChange={(page) => setCurrentPage('returned', page)}
                />
              )}
            </TabsContent>
          )}

          {!loading && (
            <TabsContent value="overdue" className="sm:hidden space-y-3 mt-4">
              {paginatedOverdue.map((lending) => (
                <LendingCard key={lending.id} lending={lending} />
              ))}
              {overdue.length > 0 && overdueTotalPages > 1 && (
                <PaginationComponent
                  currentPage={currentPages.overdue}
                  totalPages={overdueTotalPages}
                  onPageChange={(page) => setCurrentPage('overdue', page)}
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Pagination Component
function PaginationComponent({ 
  currentPage, 
  totalPages, 
  onPageChange 
}: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex justify-center">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              size="default"
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
                    onClick={() => onPageChange(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                    size="default"
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
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              size="default"
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
