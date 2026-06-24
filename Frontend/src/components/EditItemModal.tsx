import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import QRCodeDisplay from './QRCodeDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { Save, Download } from 'lucide-react';
import ImageUpload from './ImageUpload';
import { api } from '../services';
import inventoryService from '../services/inventoryService';

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
  image_path?: string;
}

interface EditItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  onSuccess?: () => void;
}

export default function EditItemModal({ open, onOpenChange, item, onSuccess }: EditItemModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantity: '',
    location: '',
    purchaseDate: '',
    condition: '',
    photoUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Load item data when modal opens or item changes
  useEffect(() => {
    if (item && open) {
      setImageFile(null);
      setFormData({
        name: item.name || '',
        description: item.description || '',
        category: item.category || '',
        quantity: item.quantity.toString() || '',
        location: item.location || '',
        purchaseDate: item.purchaseDate || '',
        condition: item.condition || '',
        photoUrl: item.image_path || item.photoUrl || '',
      });
    }
  }, [item, open]);

  // Generate QR code data
  const qrData = JSON.stringify({
    id: item?.id || 'new',
    name: formData.name || item?.name || 'Item',
    category: formData.category,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (value: string | File) => {
    if (typeof value === 'string') {
      setFormData(prev => ({ ...prev, photoUrl: value }));
      setImageFile(null);
    } else if (value instanceof File) {
      setImageFile(value);
      setFormData(prev => ({ ...prev, photoUrl: URL.createObjectURL(value) }));
    }
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadImageIfNeeded = async (): Promise<string | undefined> => {
    if (imageFile) {
      try {
        const base64 = await toBase64(imageFile);
        const response = await api.post<{ filePath: string; url: string }>('/upload/tenant', {
          file: base64,
          category: 'images/items',
          filename: imageFile.name,
          prefix: `item_${item?.id || 'edit'}`,
        });

        if (response.success && response.data?.filePath) {
          return response.data.filePath;
        }
        toast.error('Image upload failed');
        return undefined;
      } catch {
        toast.error('Image upload error');
        return undefined;
      }
    }
    // No new file - keep existing
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setLoading(true);
    try {
      const imagePath = await uploadImageIfNeeded();
      const updatePayload: any = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        quantity: Number(formData.quantity),
        unit: 'piece(s)',
        location: formData.location,
        purchase_date: formData.purchaseDate || null,
        condition: formData.condition || null,
      };
      if (imagePath !== undefined) {
        updatePayload.image_path = imagePath;
      }
      await inventoryService.updateInventoryItem(String(item.id), updatePayload);
      toast.success('Item updated successfully!');
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error('Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const canvas = document.querySelector('.edit-qr-code-canvas canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${formData.name || 'item'}-qr.png`;
      link.href = url;
      link.click();
    }
    toast.success('QR Code downloaded');
  };

  return (
    <Dialog open={open && !!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>
            Update the item details and download QR code
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6">
            <div className="grid gap-6 lg:grid-cols-3 pb-6">
              {/* Form Fields - Desktop: 2 columns, Mobile: 1 column */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit-name">Item Name *</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="e.g., Laptop - HP ProBook 450"
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Brief description of the item"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-category">Category *</Label>
                    <Select value={formData.category} onValueChange={(value: string) => handleInputChange('category', value)}>
                      <SelectTrigger id="edit-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="electronics">Electronics</SelectItem>
                        <SelectItem value="furniture">Furniture</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="supplies">Supplies</SelectItem>
                        <SelectItem value="tools">Tools</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-quantity">Quantity *</Label>
                    <Input
                      id="edit-quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => handleInputChange('quantity', e.target.value)}
                      placeholder="0"
                      min="1"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-location">Location *</Label>
                    <Input
                      id="edit-location"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="e.g., Computer Lab"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-purchaseDate">Purchase Date</Label>
                    <Input
                      id="edit-purchaseDate"
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-condition">Condition</Label>
                    <Select value={formData.condition} onValueChange={(value: string) => handleInputChange('condition', value)}>
                      <SelectTrigger id="edit-condition">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="needs-repair">Needs Repair</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <ImageUpload
                      value={formData.photoUrl}
                      onChange={handleImageChange}
                      label="Item Photo"
                      description="Upload a clear photo of the item for easy identification"
                    />
                  </div>
                </div>
              </div>

              {/* QR Code Preview - Desktop: Right panel, Mobile: Below form */}
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-0">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">QR Code</CardTitle>
                      <CardDescription className="text-xs">Item tracking code</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="edit-qr-code-canvas flex justify-center rounded-lg border bg-muted/30 p-4">
                        <QRCodeDisplay value={qrData} />
                      </div>
                      
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ID:</span>
                          <span>#{item?.id || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category:</span>
                          <span className="capitalize">{formData.category || '-'}</span>
                        </div>

                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={downloadQR}
                      >
                        <Download className="mr-2 size-4" />
                        Download QR
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </span>
              ) : (
                <><Save className="mr-2 size-4" />Update Item</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}