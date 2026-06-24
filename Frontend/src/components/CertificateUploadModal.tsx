import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import certificateService from '../services/certificateService';
import { uploadFile } from '../utils/fileUpload';

interface CertificateUploadModalProps {
  open: boolean;
  onClose: () => void;
  traineeId: string;
  traineeName: string;
  onSuccess: () => void;
}

export default function CertificateUploadModal({
  open,
  onClose,
  traineeId,
  traineeName,
  onSuccess,
}: CertificateUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (PDF, images)
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a PDF or image file (JPG, PNG)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a certificate title');
      return;
    }

    try {
      setUploading(true);

      // Upload file to backend using the uploadFile utility
      const uploadResponse = await uploadFile({
        file: selectedFile,
        category: 'documents/certificates',
        prefix: `certificate_${traineeId}`,
      });

      if (!uploadResponse.success || !uploadResponse.filePath) {
        throw new Error(uploadResponse.error || 'Failed to upload file');
      }

      // Save certificate metadata
      await certificateService.uploadCertificate(traineeId, {
        file_path: uploadResponse.filePath,
        title: title.trim(),
        description: description.trim() || undefined,
      });

      toast.success('Certificate uploaded successfully');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error?.message || 'Failed to upload certificate');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setPreviewUrl(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Certificate</DialogTitle>
          <DialogDescription>
            Upload a certificate for {traineeName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Certificate Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Web Development Completion Certificate"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add any additional details about this certificate"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              rows={3}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Certificate File *</Label>
            {!selectedFile ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="mx-auto size-12 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to upload certificate</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, JPG, or PNG (max 10MB)
                  </p>
                </label>
              </div>
            ) : (
              <div className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="size-16 object-cover rounded border"
                    />
                  ) : (
                    <div className="size-16 flex items-center justify-center bg-muted rounded border">
                      <FileText className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    disabled={uploading}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !selectedFile || !title.trim()}>
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 size-4" />
                Upload Certificate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
