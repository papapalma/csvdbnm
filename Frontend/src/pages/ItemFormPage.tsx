import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import ImageUpload from '../components/ImageUpload';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import QRCodeDisplay from '../components/QRCodeDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Save, 
  Download, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Package, 
  FileText, 
  MapPin, 
  Settings,
  Building2,
} from 'lucide-react';
import { api } from '../services';
import inventoryService from '../services/inventoryService';
import { getFileUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function ItemFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantity: '',
    unit: 'piece(s)',
    location: '',
    purchaseDate: '',
    condition: '',
    photoUrl: '',
  });

  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  // Raw relative path stored in DB (e.g. /uploads/images/items/photo.jpg)
  // Kept separate from formData.photoUrl which holds the full display URL
  const [existingImagePath, setExistingImagePath] = useState<string>('');

  // Define steps
  const steps = [
    { 
      id: 1, 
      title: 'Basic Information', 
      description: 'Item name and description',
      icon: FileText 
    },
    { 
      id: 2, 
      title: 'Category & Quantity', 
      description: 'Classification and stock info',
      icon: Package 
    },
    { 
      id: 3, 
      title: 'Location & Details', 
      description: 'Location, purchase date, and condition',
      icon: MapPin 
    },
    { 
      id: 4, 
      title: 'QR Code & Review', 
      description: 'Generate QR code and review',
      icon: Settings 
    },
  ];

  // Load existing item data if editing
  useEffect(() => {
    if (id) {
      setLoading(true);
      inventoryService.getInventoryItemById(id)
        .then((item: any) => {
          setFormData({
            name:         item.name           ?? '',
            description:  item.description    ?? '',
            category:     item.category       ?? '',
            quantity:     String(item.quantity ?? ''),
            unit:         item.unit           ?? 'piece(s)',
            location:     item.location       ?? '',
            purchaseDate: item.purchase_date  ?? '',
            condition:    item.condition      ?? '',
            photoUrl:     getFileUrl(item.image_path) ?? '',
          });
          // Keep the original relative path for re-saving without re-upload
          setExistingImagePath(item.image_path ?? '');
        })
        .catch(() => {
          toast.error('Failed to load item from server');
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Generate QR code data
  const qrData = JSON.stringify({
    id: id || 'new',
    name: formData.name || 'New Item',
    category: formData.category,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          toast.error('Please enter an item name');
          return false;
        }
        return true;
      case 2:
        if (!formData.unit) { toast.error('Please select a unit'); return false; }
        if (!formData.category) { toast.error('Please select a category'); return false; }
        if (!formData.quantity || Number(formData.quantity) < 1) { toast.error('Please enter a valid quantity (minimum 1)'); return false; }
        return true;
      case 3:
        if (!formData.location.trim()) {
          toast.error('Please enter a location');
          return false;
        }
        if (!formData.purchaseDate) {
          toast.error('Please select a purchase date');
          return false;
        }
        if (!formData.condition) {
          toast.error('Please select item condition');
          return false;
        }
        return true;
      case 4:
        // Optionally require photo
        // if (!formData.photoUrl) {
        //   toast.error('Please upload an item photo');
        //   return false;
        // }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Generate QR as PNG and upload to backend, return the saved file path
  const generateAndUploadQR = async (itemId: string | number, name: string, category: string): Promise<string> => {
    try {
      const qrValue = JSON.stringify({ id: itemId, name, category });
      const dataUrl: string = await QRCode.toDataURL(qrValue, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      // Strip the data URL prefix to get raw base64
      const base64 = dataUrl.split(',')[1];
      const response = await api.post('/upload/tenant', {
        file: base64,
        category: 'qrcodes/items',
        filename: `item-${itemId}-qr.png`,
        prefix: `qr_${itemId}`,
      });
      if (response.success && response.data?.filePath) {
        return response.data.filePath;
      }
      return '';
    } catch {
      return '';
    }
  };

  const handleSubmit = async () => {
    // Validate all steps
    for (let i = 1; i <= steps.length; i++) {
      if (!validateStep(i)) {
        setCurrentStep(i);
        return;
      }
    }
    setLoading(true);
    try {
      // Upload image if needed
      const imagePath = await uploadImageIfNeeded();
      const payload: any = {
        name:           formData.name,
        description:    formData.description,
        category:       formData.category,
        quantity:       Number(formData.quantity),
        unit:           formData.unit || 'piece(s)',
        location:       formData.location,
        purchase_date:  formData.purchaseDate || null,
        condition:      formData.condition || null,
        image_path:     imagePath || null,
      };

      let savedItem: any;
      if (id) {
        savedItem = await inventoryService.updateInventoryItem(id, payload);
      } else {
        savedItem = await inventoryService.createInventoryItem(payload);
      }

      // Generate QR, upload it, then patch the item with qr_code_path
      const savedId = savedItem?.id ?? id;
      if (savedId) {
        const qrPath = await generateAndUploadQR(savedId, formData.name, formData.category);
        if (qrPath) {
          await inventoryService.updateInventoryItem(String(savedId), { qr_code_path: qrPath } as any);
        }
      }

      toast.success(id ? 'Item updated successfully!' : 'Item added successfully!');
      navigate('/items');
    } catch (err) {
      toast.error('Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${formData.name || 'item'}-qr.png`;
      link.href = url;
      link.click();
      toast.success('QR Code downloaded');
    }
  };

  // Convert File to base64 string
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Upload a new image file to the backend; otherwise keep existing URL
  const uploadImageIfNeeded = async (): Promise<string> => {
    if (!imageFile) {
      // No new file selected — return the original relative path from DB (safe to re-store)
      return existingImagePath;
    }
    try {
      const base64 = await toBase64(imageFile);
      const response = await api.post('/upload/tenant', {
        file: base64,
        category: 'images/items',
        filename: imageFile.name,
        prefix: `item_${id || 'new'}`,
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
  };

  return (
    <DashboardLayout>
      {/* Loading overlay during API calls */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
            <span className="sr-only">{id ? 'Saving changes...' : 'Creating item...'}</span>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2">
            <Package className="size-8" />
            {id ? 'Edit Item' : 'New Item'}
          </h1>
          <p className="text-muted-foreground">
            {id ? 'Update item information' : 'Add a new item to inventory'}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {steps.map((step) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <Card 
                key={step.id}
                className={`cursor-pointer transition-all ${
                  isActive 
                    ? 'border-primary shadow-md' 
                    : isCompleted 
                    ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                    : 'opacity-50'
                }`}
                onClick={() => {
                  // Allow navigation to completed or current step
                  if (step.id <= currentStep) {
                    setCurrentStep(step.id);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={`flex size-10 items-center justify-center rounded-full ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-muted'
                    }`}>
                      {isCompleted ? (
                        <span className="text-lg">✓</span>
                      ) : (
                        <StepIcon className="size-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${isActive ? 'font-semibold' : ''}`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate hidden md:block">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const StepIcon = steps[currentStep - 1].icon;
                return <StepIcon className="size-5" />;
              })()}
              {steps[currentStep - 1].title}
            </CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Organization context (read-only) */}
                {user?.tenantName && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                    <Building2 className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Organization:</span>
                    <span className="font-medium">{user.tenantName}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Laptop - HP ProBook 450"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a clear and descriptive name for the item
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Provide additional details about the item, its specifications, or any special features..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Add detailed information to help identify this item
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Category & Quantity */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value: string) => handleInputChange('category', value)}>
                    <SelectTrigger>
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
                  <p className="text-xs text-muted-foreground">
                    Choose the category that best describes this item
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Total Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    placeholder="0"
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    How many units of this item do you have in stock?
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Note:</strong> The quantity you enter will be used to track available items. When items are lent out, the available count will decrease automatically.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Location & Details */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Storage Location *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="e.g., Computer Lab, Storage Room A, Building 2 - Floor 3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Where is this item stored or located?
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchase Date *</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      When was this item purchased?
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="condition">Condition *</Label>
                    <Select value={formData.condition || undefined} onValueChange={(value: string) => handleInputChange('condition', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Fair">Fair</SelectItem>
                        <SelectItem value="Poor">Poor</SelectItem>
                        <SelectItem value="Damaged">Damaged</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Current condition of the item
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: QR Code & Review */}
            {currentStep === 4 && (
              <div className="space-y-6">
                {/* Item Summary */}
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="size-5" />
                    Item Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{formData.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-medium capitalize">{formData.category || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantity:</span>
                      <span className="font-medium">{formData.quantity || '0'} {formData.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium">{formData.location || '-'}</span>
                    </div>
                    {formData.condition && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Condition:</span>
                        <span className="font-medium">{formData.condition}</span>
                      </div>
                    )}
                    {formData.photoUrl && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Photo:</span>
                        <img src={formData.photoUrl} alt="Item" className="h-12 w-12 object-contain rounded" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Upload */}
                <div className="border rounded-lg p-6">
                  <h4 className="font-semibold mb-3">Item Photo</h4>
                  <ImageUpload
                    value={formData.photoUrl}
                    onChange={(url) => {
                      setFormData(prev => ({ ...prev, photoUrl: url }));
                      // If the image was removed, clear the stored DB path too
                      if (!url) setExistingImagePath('');
                    }}
                    onFileChange={(file) => setImageFile(file)}
                    label="Upload Item Photo"
                    description="Upload a clear photo of the item for easy identification"
                  />
                </div>

                {/* QR Code */}
                <div className="border rounded-lg p-6">
                  <h4 className="font-semibold mb-3">Auto-Generated QR Code</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    This QR code will be used for item tracking and quick identification
                  </p>
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex justify-center rounded-lg border bg-muted/30 p-6">
                      <QRCodeDisplay value={qrData} />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Item ID:</span>
                          <span className="font-mono">{id || 'Auto-generated'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">QR Category:</span>
                          <span className="capitalize">{formData.category || '-'}</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={downloadQR}
                        disabled={!formData.name}
                      >
                        <Download className="mr-2 size-4" />
                        Download QR Code
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/items')}
            >
              <X className="mr-2 size-4" />
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="mr-2 size-4" />
              Previous
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Step {currentStep} of {steps.length}
          </div>

          {currentStep < steps.length ? (
            <Button onClick={nextStep}>
              Next
              <ChevronRight className="ml-2 size-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </span>
              ) : (
                <><Save className="mr-2 size-4" />{id ? 'Update Item' : 'Save Item'}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}