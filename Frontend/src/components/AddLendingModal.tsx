import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import { PackagePlus, User, UserX } from 'lucide-react';
import lendingService from '../services/lendingService';
import inventoryService, { InventoryItem } from '../services/inventoryService';
import traineeService, { Trainee } from '../services/traineeService';

interface AddLendingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type BorrowerType = 'trainee' | 'external';

export default function AddLendingModal({ open, onOpenChange, onSuccess }: AddLendingModalProps) {
  const [borrowerType, setBorrowerType] = useState<BorrowerType>('trainee');
  const [traineeId, setTraineeId] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerContact, setBorrowerContact] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const selectedItem = items.find(i => i.id === itemId);
  const maxQuantity = selectedItem?.available_quantity ?? 0;

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([
      inventoryService.getInventoryItems(),
      traineeService.getTrainees(),
    ])
      .then(([itemsRes, traineesRes]) => {
        const allItems = (itemsRes.data ?? []).filter(
          (item: InventoryItem) => item.available_quantity > 0
        );
        setItems(allItems);
        setTrainees(traineesRes.data ?? []);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoadingData(false));
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setBorrowerType('trainee');
      setTraineeId('');
      setBorrowerName('');
      setBorrowerContact('');
      setItemId('');
      setQuantity('1');
      setExpectedReturnDate('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemId) {
      toast.error('Please select an item');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (!qty || qty < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    if (qty > maxQuantity) {
      toast.error(`Only ${maxQuantity} available`);
      return;
    }

    if (!expectedReturnDate) {
      toast.error('Please set an expected return date');
      return;
    }

    if (new Date(expectedReturnDate) < new Date(today)) {
      toast.error('Expected return date cannot be in the past');
      return;
    }

    if (borrowerType === 'trainee' && !traineeId) {
      toast.error('Please select a trainee');
      return;
    }

    if (borrowerType === 'external' && !borrowerName.trim()) {
      toast.error('Please enter the borrower name');
      return;
    }

    setLoading(true);
    try {
      await lendingService.createLending({
        ...(borrowerType === 'trainee' ? { trainee_id: traineeId } : {
          borrower_name: borrowerName.trim(),
          borrower_contact: borrowerContact.trim() || undefined,
        }),
        item_id: itemId,
        quantity: qty,
        expected_return_date: expectedReturnDate,
        notes: notes.trim() || undefined,
      });

      toast.success('Lending record created');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Failed to create lending');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="size-5" />
            New Lending
          </DialogTitle>
          <DialogDescription>Record a new item borrowing</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Borrower type toggle */}
          <div className="space-y-1.5">
            <Label>Borrower Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={borrowerType === 'trainee' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setBorrowerType('trainee')}
              >
                <User className="mr-2 size-4" />
                Trainee
              </Button>
              <Button
                type="button"
                variant={borrowerType === 'external' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setBorrowerType('external')}
              >
                <UserX className="mr-2 size-4" />
                External
              </Button>
            </div>
          </div>

          {/* Trainee selector */}
          {borrowerType === 'trainee' && (
            <div className="space-y-1.5">
              <Label htmlFor="trainee">Trainee *</Label>
              {loadingData ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={traineeId} onValueChange={setTraineeId}>
                  <SelectTrigger id="trainee">
                    <SelectValue placeholder="Select trainee" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainees.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* External borrower fields */}
          {borrowerType === 'external' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="borrowerName">Name *</Label>
                <Input
                  id="borrowerName"
                  placeholder="Full name"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="borrowerContact">Contact (optional)</Label>
                <Input
                  id="borrowerContact"
                  placeholder="Phone or email"
                  value={borrowerContact}
                  onChange={(e) => setBorrowerContact(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Item selector */}
          <div className="space-y-1.5">
            <Label htmlFor="item">Item *</Label>
            {loadingData ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={itemId} onValueChange={(v: string) => { setItemId(v); setQuantity('1'); }}>
                <SelectTrigger id="item">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} (available: {item.available_quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={selectedItem ? maxQuantity : undefined}
              value={quantity}
              onChange={(e) => {
                const v = e.target.value;
                // Allow empty string while typing; clamp on submit
                if (v === '' || v === '-') { setQuantity(''); return; }
                const n = parseInt(v, 10);
                if (isNaN(n) || n < 0) return;
                setQuantity(String(n));
              }}
            />
            {selectedItem && (
              <p className="text-xs text-muted-foreground">
                Max available: {maxQuantity}
              </p>
            )}
          </div>

          {/* Expected return date */}
          <div className="space-y-1.5">
            <Label htmlFor="returnDate">Expected Return Date *</Label>
            <Input
              id="returnDate"
              type="date"
              min={today}
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Purpose, condition notes, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Create Lending'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
