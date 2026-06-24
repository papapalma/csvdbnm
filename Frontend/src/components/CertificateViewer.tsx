import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Award, Download, Printer, Trash2, FileText, Calendar, QrCode } from 'lucide-react';
import { getFileUrl } from '../services/api';
import { Certificate } from '../services/certificateService';
import QRCodeDisplay from './QRCodeDisplay';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface CertificateViewerProps {
  certificates: Certificate[];
  canDelete?: boolean;
  onDelete?: (certificateId: string) => void;
}

export default function CertificateViewer({
  certificates,
  canDelete = false,
  onDelete,
}: CertificateViewerProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [certificateToDelete, setCertificateToDelete] = useState<Certificate | null>(null);
  const [qrCertId, setQrCertId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDownload = (certificate: Certificate) => {
    const url = getFileUrl(certificate.file_path);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${certificate.title}.${certificate.file_path.split('.').pop()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = (certificate: Certificate) => {
    const url = getFileUrl(certificate.file_path);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleDeleteClick = (certificate: Certificate) => {
    setCertificateToDelete(certificate);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (certificateToDelete && onDelete) {
      onDelete(certificateToDelete.id);
    }
    setDeleteDialogOpen(false);
    setCertificateToDelete(null);
  };

  const isPDF = (filePath: string) => {
    return filePath.toLowerCase().endsWith('.pdf');
  };

  if (certificates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Award className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No certificates yet</p>
        <p className="text-sm text-muted-foreground">
          Certificates will appear here once uploaded by your administrator
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {certificates.map((certificate) => (
          <Card key={certificate.id} className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Certificate Preview */}
              <div className="md:w-48 bg-muted flex items-center justify-center p-4">
                {isPDF(certificate.file_path) ? (
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileText className="size-16 text-muted-foreground mb-2" />
                    <Badge variant="secondary" className="text-xs">
                      PDF
                    </Badge>
                  </div>
                ) : (
                  <img
                    src={getFileUrl(certificate.file_path)}
                    alt={certificate.title}
                    className="max-h-32 object-contain"
                  />
                )}
              </div>

              {/* Certificate Details */}
              <div className="flex-1">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Award className="size-5 text-primary" />
                        {certificate.title}
                      </CardTitle>
                      {certificate.description && (
                        <CardDescription className="mt-2">
                          {certificate.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="size-4" />
                      <span>Uploaded on {formatDate(certificate.uploaded_at)}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(certificate)}
                      >
                        <Download className="mr-2 size-4" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrint(certificate)}
                      >
                        <Printer className="mr-2 size-4" />
                        Print
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQrCertId(qrCertId === certificate.id ? null : certificate.id)}
                      >
                        <QrCode className="mr-2 size-4" />
                        QR
                      </Button>
                      {canDelete && onDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(certificate)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* QR Code Panel */}
                  {qrCertId === certificate.id && (
                    <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border bg-muted/50 p-4">
                      <p className="text-xs text-muted-foreground mb-2">
                        Scan to verify this certificate
                      </p>
                      <div className="bg-white p-2 rounded-lg border">
                        <QRCodeDisplay
                          value={JSON.stringify({
                            certificateId: certificate.id,
                            title: certificate.title,
                            url: getFileUrl(certificate.file_path),
                          })}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-1">
                        Certificate ID: <span className="font-mono">{certificate.id.slice(0, 8)}...</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Certificate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{certificateToDelete?.title}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
