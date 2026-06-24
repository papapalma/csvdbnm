import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import QRCodeDisplay from './QRCodeDisplay';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

interface Item {
  id: string;
  name: string;
  category: string;
}

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
}

export default function QRCodeModal({ open, onOpenChange, item }: QRCodeModalProps) {
  if (!item) return null;

  const qrData = JSON.stringify({
    id: item.id,
    name: item.name,
    category: item.category,
  });

  const downloadQR = () => {
    const canvas = document.querySelector('.qr-modal-canvas canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${item.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-qr.png`;
      link.href = url;
      link.click();
      toast.success('QR Code downloaded');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Item QR Code</DialogTitle>
          <DialogDescription>
            Scan or download this QR code for item tracking
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="qr-modal-canvas flex justify-center rounded-lg border bg-muted/30 p-8">
            <QRCodeDisplay value={qrData} />
          </div>

          <div className="space-y-2 rounded-lg bg-muted/50 p-4">
            <h4 className="line-clamp-2">{item.name}</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>ID:</span>
                <span>#{item.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="capitalize">{item.category}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              className="flex-1"
              onClick={downloadQR}
            >
              <Download className="mr-2 size-4" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
