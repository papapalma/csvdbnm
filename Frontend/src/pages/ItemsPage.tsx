import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import QRCodeModal from '../components/QRCodeModal';
import ItemDetailsModal from '../components/ItemDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
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
import { Search, PackagePlus, QrCode, Edit, Package, LayoutGrid, TableIcon, Download, Eye, Building2, AlertTriangle } from 'lucide-react';
import { generateItemsPDF } from '../utils/pdfGenerator';
import { Alert, AlertDescription } from '../components/ui/alert';
import { toast } from 'sonner';
import inventoryService from '../services/inventoryService';
import { getThumbnailUrl } from '../services/api';
import { CardGridSkeleton } from '../components/LoadingSkeletons';
import { Skeleton } from '../components/ui/skeleton';
import logger from '../utils/logger';

interface Item {
  id: string;
  name: string;
  category: string;
  quantity: number;
  available: number;
  location: string;
  description?: string;
  purchaseDate?: string;
  condition?: string;
  photoUrl?: string;
}

type ViewMode = 'card' | 'table';

export default function ItemsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { hasPermission, user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [lowStockDismissed, setLowStockDismissed] = useState(false);

  // Fetch items from backend
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await inventoryService.getInventoryItems({
        search: searchQuery || undefined,
        category: filterCategory !== 'all' ? filterCategory : undefined
      });
      
      // Map backend data to Item interface
      const mappedItems = (response.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        available: item.available_quantity,
        location: item.location,
        description: item.description,
        photoUrl: getThumbnailUrl(item.thumbnail_path || item.image_path),
        condition: item.condition,
        purchaseDate: item.purchase_date
      }));
      
      setItems(mappedItems);
      
      // Extract unique categories
      const uniqueCategories = ['all', ...new Set(mappedItems.map((item: Item) => item.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      logger.error('Failed to fetch items', { error });
      toast.error('Failed to load items');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('itemsViewMode') as ViewMode;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('itemsViewMode', mode);
    setCurrentPage(1); // Reset to first page when changing view
  };

  const handleViewDetails = (item: Item) => {
    setSelectedItem(item);
    setDetailsModalOpen(true);
  };

  const handleEditItem = (item: Item) => {
    navigate(`/items/${item.id}/edit`);
  };

  const handleViewQR = (item: Item) => {
    setSelectedItem(item);
    setQrModalOpen(true);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
    fetchItems();
  }, [searchQuery, filterCategory]);

  // Show loading state
  if (loading) {
    return (
      <DashboardLayout title="Item Management">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Skeleton className="h-10 w-full sm:w-32" />
              <Skeleton className="h-10 w-full sm:w-28" />
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-full sm:w-[180px]" />
              </div>
            </CardContent>
          </Card>

          <CardGridSkeleton count={6} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Item Management">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2">
              Items
              {user?.tenantName && (
                <Badge variant="outline" className="text-xs font-normal">
                  <Building2 className="mr-1 size-3" />
                  {user.tenantName}
                </Badge>
              )}
            </h2>
            <p className="text-muted-foreground">
              Manage inventory and equipment for {user?.tenantName || 'your organization'}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none" 
              onClick={() => {
                if (filteredItems.length === 0) {
                  toast.error('No items to download');
                  return;
                }
                generateItemsPDF(filteredItems);
                toast.success('PDF downloaded successfully');
              }}
            >
              <Download className="mr-2 size-4" />
              Download PDF
            </Button>
            {hasPermission('canManageItems') && (
              <Button className="flex-1 sm:flex-none" onClick={() => navigate('/items/new')}>
                <PackagePlus className="mr-2 size-4" />
                Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Low Stock Alert */}
        {!lowStockDismissed && items.some(item => item.available === 0 || item.available < 5) && (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="flex items-start justify-between gap-2">
              <div>
                <span className="font-medium text-amber-800 dark:text-amber-300">Low stock alert: </span>
                <span className="text-amber-700 dark:text-amber-400">
                  {items
                    .filter(item => item.available === 0 || item.available < 5)
                    .map(item => item.name)
                    .join(', ')}
                </span>
              </div>
              <button
                onClick={() => setLowStockDismissed(true)}
                className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 text-xs underline"
              >
                Dismiss
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="hidden sm:flex gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => handleViewModeChange('card')}
                  className="size-8"
                >
                  <LayoutGrid className="size-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => handleViewModeChange('table')}
                  className="size-8"
                >
                  <TableIcon className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Card View */}
        {viewMode === 'card' && (
          <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedItems.map((item) => (
              <Card key={item.id} className="group transition-all hover:shadow-lg overflow-hidden cursor-pointer" onClick={() => handleViewDetails(item)}>
                {item.photoUrl && (
                  <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <img
                      src={item.photoUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                      <Package className="size-6 text-primary" />
                    </div>
                    <Badge variant="secondary">{item.category}</Badge>
                  </div>
                  
                  <h3 className="mb-2 line-clamp-2">{item.name}</h3>
                  
                  <div className="mb-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span>{item.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Available:</span>
                      <span className={item.available === 0 ? 'text-destructive' : 'text-secondary'}>
                        {item.available}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="truncate ml-2">{item.location}</span>
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
                          handleViewQR(item);
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
                          handleViewDetails(item);
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

        {/* Desktop Table View */}
        {viewMode === 'table' && (
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.photoUrl ? (
                            <div className="size-10 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800">
                              <img src={item.photoUrl} alt={item.name} className="size-full object-cover" />
                            </div>
                          ) : (
                            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                              <Package className="size-5 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate">{item.name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.category}</Badge>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <span className={item.available === 0 ? 'text-destructive' : 'text-secondary'}>
                          {item.available}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.location}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {hasPermission('canManageItems') && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit className="size-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleViewQR(item)}
                          >
                            <QrCode className="size-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleViewDetails(item)}
                          >
                            <Package className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Items List - Mobile */}
        <div className="sm:hidden space-y-3">
          {paginatedItems.map((item) => (
            <Card key={item.id} className="cursor-pointer" onClick={() => handleViewDetails(item)}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="size-6 text-primary" />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h4 className="line-clamp-2 flex-1">{item.name}</h4>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {item.category}
                      </Badge>
                    </div>
                    
                    <div className="mb-3 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Available:</span>
                        <span className={item.available === 0 ? 'text-destructive' : 'text-secondary'}>
                          {item.available} / {item.quantity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.location}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleViewQR(item);
                        }}
                      >
                        <QrCode className="mr-1 size-4" />
                        QR
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleViewDetails(item);
                        }}
                      >
                        <Eye className="mr-1 size-4" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="py-12 text-center">
            <Package className="mx-auto mb-4 size-12 text-muted-foreground" />
            <p className="text-muted-foreground">No items found</p>
          </div>
        )}

        {/* Pagination */}
        {filteredItems.length > 0 && totalPages > 1 && (
          <div className="flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    size={undefined}
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
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                          size={undefined}
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
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    size={undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <QRCodeModal open={qrModalOpen} onOpenChange={setQrModalOpen} item={selectedItem} />
      <ItemDetailsModal 
        open={detailsModalOpen} 
        onOpenChange={setDetailsModalOpen} 
        item={selectedItem}
        onEdit={handleEditItem}
        onViewQR={handleViewQR}
        canEdit={hasPermission('canManageItems')}
      />
    </DashboardLayout>
  );
}