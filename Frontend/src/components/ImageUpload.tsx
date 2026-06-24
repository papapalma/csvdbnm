import { useState, useRef, DragEvent, MouseEvent } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

interface ImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  /** Optional: receive the raw File object when a new file is selected */
  onFileChange?: (file: File | null) => void;
  label?: string;
  description?: string;
}

export default function ImageUpload({ value, onChange, onFileChange, label, description }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setIsLoading(true);

    // Convert to base64 for preview only
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      onChange(result);       // base64 preview string
      onFileChange?.(file);   // raw File for actual upload
      setIsLoading(false);
    };
    reader.onerror = () => {
      alert('Error reading file');
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange('');
    onFileChange?.(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative cursor-pointer rounded-lg border-2 border-dashed transition-all
          ${isDragging 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
          }
          p-3
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-32 w-full max-w-xs" />
            <p className="sr-only">Uploading image...</p>
          </div>
        ) : value ? (
          <div className="flex justify-center">
            <div className="group relative inline-block">
              <img
                src={value}
                alt="Upload preview"
                className="h-48 w-auto rounded-md object-cover shadow"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    handleClick();
                  }}
                >
                  <Upload className="size-4 mr-2" />
                  Change
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                >
                  <X className="size-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className={`
              flex size-16 items-center justify-center rounded-full transition-all
              ${isDragging ? 'bg-primary/20 scale-110' : 'bg-muted'}
            `}>
              <ImageIcon className={`size-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-medium">
                {isDragging ? 'Drop image here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                PNG, JPG, GIF up to 5MB
              </p>
            </div>
          </div>
        )}
      </div>

      {description && !value && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
