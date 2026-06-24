import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Package, MapPin, Calendar, CheckCircle2, Edit, QrCode } from 'lucide-react';

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

interface ItemDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  onEdit?: (item: Item) => void;
  onViewQR?: (item: Item) => void;
  canEdit?: boolean;
}

export default function ItemDetailsModal({ 
  open, 
  onOpenChange, 
  item,
  onEdit,
  onViewQR,
  canEdit = false 
}: ItemDetailsModalProps) {
  if (!item) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Item Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Photo */}
          {item.photoUrl && (
            <div className="flex justify-center">
              <img
                src={item.photoUrl}
                alt={item.name}
                className="h-48 w-auto rounded-md object-cover shadow"
              />
            </div>
          )}

          {/* Header Info */}
          <div className="flex items-start gap-4">
            {!item.photoUrl && (
              <div className="flex size-16 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Package className="size-8 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="mb-2">{item.name}</h3>
              <Badge variant="secondary">{item.category}</Badge>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Description</h4>
              <p className="text-muted-foreground">{item.description}</p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Quantity */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Quantity</p>
                <p className="font-semibold">{item.quantity}</p>
              </div>
            </div>

            {/* Available */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex size-10 items-center justify-center rounded-lg bg-secondary/10">
                <CheckCircle2 className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className={`font-semibold ${item.available === 0 ? 'text-destructive' : 'text-secondary'}`}>
                  {item.available}
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10">
                <MapPin className="size-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-semibold">{item.location}</p>
              </div>
            </div>



            {/* Purchase Date */}
            {item.purchaseDate && (
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex size-10 items-center justify-center rounded-lg bg-secondary/10">
                  <Calendar className="size-5 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Date</p>
                  <p className="font-semibold">{formatDate(item.purchaseDate)}</p>
                </div>
              </div>
            )}

            {/* Condition */}
            {item.condition && (
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10">
                  <CheckCircle2 className="size-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Condition</p>
                  <p className="font-semibold capitalize">{item.condition}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 border-t pt-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                if (onViewQR) onViewQR(item);
              }}
            >
              <QrCode className="mr-2 size-4" />
              View QR Code
            </Button>
            {canEdit && (
              <Button 
                variant="default" 
                className="flex-1"
                onClick={() => {
                  if (onEdit) onEdit(item);
                  onOpenChange(false);
                }}
              >
                <Edit className="mr-2 size-4" />
                Edit Item
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
