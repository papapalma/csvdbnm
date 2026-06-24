import { useState } from 'react';
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

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AddItemModal({ open, onOpenChange, onSuccess }: AddItemModalProps) {
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

  // Generate QR code data
  const qrData = JSON.stringify({
    id: 'new',
    name: formData.name || 'New Item',
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

  const uploadImageIfNeeded = async (): Promise<string> => {
    if (imageFile) {
      try {
        const base64 = await toBase64(imageFile);
        const response = await api.post<{ filePath: string; url: string }>('/upload/tenant', {
          file: base64,
          category: 'images/items',
          filename: imageFile.name,
          prefix: 'item_new',
        });

        if (response.success && response.data?.filePath) {
          return response.data.filePath;
        }
        toast.error('Image upload failed');
        return '';
      } catch {
        toast.error('Image upload error');
        return '';
      }
    }
    return '';
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      quantity: '',
      location: '',
      purchaseDate: '',
      condition: '',
      photoUrl: '',
    });
    setImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const imagePath = await uploadImageIfNeeded();
      await inventoryService.createInventoryItem({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        quantity: Number(formData.quantity),
        unit: 'piece(s)',
        location: formData.location,
        purchase_date: formData.purchaseDate || null,
        condition: formData.condition || null,
        image_path: imagePath || null,
      } as any);
      toast.success('Item added successfully!');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error('Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const canvas = document.querySelector('.qr-code-canvas canvas') as HTMLCanvasElement;
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Add New Item</DialogTitle>
          <DialogDescription>
            Enter the details of the item and generate a QR code
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6">
            <div className="grid gap-6 lg:grid-cols-3 pb-6">
              {/* Form Fields - Desktop: 2 columns, Mobile: 1 column */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">Item Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="e.g., Laptop - HP ProBook 450"
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Brief description of the item"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: string) => handleInputChange('category', value)}
                      required
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Electronics">Electronics</SelectItem>
                        <SelectItem value="Furniture">Furniture</SelectItem>
                        <SelectItem value="Equipment">Equipment</SelectItem>
                        <SelectItem value="Supplies">Supplies</SelectItem>
                        <SelectItem value="Tools">Tools</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => handleInputChange('quantity', e.target.value)}
                      placeholder="0"
                      min="0"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="e.g., Computer Lab"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchase Date</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="condition">Condition</Label>
                    <Select
                      value={formData.condition}
                      onValueChange={(value: string) => handleInputChange('condition', value)}
                    >
                      <SelectTrigger id="condition">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Excellent">Excellent</SelectItem>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Fair">Fair</SelectItem>
                        <SelectItem value="Poor">Poor</SelectItem>
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

              {/* QR Code Preview - Desktop: Right column, Mobile: Below form */}
              <div className="lg:col-span-1">
                <Card className="sticky top-0">
                  <CardHeader>
                    <CardTitle>QR Code Preview</CardTitle>
                    <CardDescription>Auto-generated QR code for this item</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="qr-code-canvas flex justify-center">
                      <QRCodeDisplay value={qrData} />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={downloadQR}
                      disabled={!formData.name}
                    >
                      <Download className="mr-2 size-4" />
                      Download QR
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 border-t px-6 py-4 bg-muted/30">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name || !formData.category || !formData.quantity || !formData.location}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </span>
              ) : (
                <><Save className="mr-2 size-4" />Add Item</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
