import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { User, Mail, Phone, GraduationCap, Calendar, MapPin, QrCode, Download, Award, Upload } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';
import CertificateViewer from './CertificateViewer';
import CertificateUploadModal from './CertificateUploadModal';
import certificateService, { Certificate } from '../services/certificateService';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface Training {
  program: string;
  status: string;
  dateEnrolled: string;
  dateCompleted: string | null;
}

interface Trainee {
  id: number;
  name: string;
  photoUrl?: string;
  trainings: Training[];
  status: string;
  email: string;
  contact: string;
  address?: string;
  emergencyContact?: string;
  emergencyContactNumber?: string;
  qr_code?: string;
}

interface TraineeDetailsModalProps {
  trainee: Trainee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (id: number) => void;
  initialTab?: TraineeDetailsTab;
}

export type TraineeDetailsTab = 'info' | 'trainings' | 'certificates' | 'qr';

export default function TraineeDetailsModal({ trainee, open, onOpenChange, onEdit, initialTab = 'info' }: TraineeDetailsModalProps) {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TraineeDetailsTab>(initialTab);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    loadCertificates();
  }, [open, initialTab]);

  const loadCertificates = async () => {
    if (!trainee) return;
    try {
      setLoadingCertificates(true);
      const response = await certificateService.getCertificates(String(trainee.id));
      setCertificates(response.certificates);
    } catch (error: any) {
      console.error('Failed to load certificates:', error);
    } finally {
      setLoadingCertificates(false);
    }
  };

  const handleDeleteCertificate = async (certificateId: string) => {
    if (!trainee) return;
    try {
      await certificateService.deleteCertificate(String(trainee.id), certificateId);
      toast.success('Certificate deleted successfully');
      loadCertificates();
    } catch (error: any) {
      console.error('Failed to delete certificate:', error);
      toast.error(error?.message || 'Failed to delete certificate');
    }
  };

  const qrValue = trainee?.qr_code?.trim();

  if (!trainee) return null;

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-muted';
    switch (status.toLowerCase()) {
      case 'active': return 'bg-secondary text-secondary-foreground';
      case 'completed': return 'bg-primary text-primary-foreground';
      case 'inactive': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted';
    }
  };

  const downloadQR = () => {
    const canvas = document.querySelector('.trainee-qr-canvas canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${trainee.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-qr.png`;
      link.href = url;
      link.click();
      toast.success('QR Code downloaded');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          {/* Header: avatar + name + badges */}
          <div className="flex items-center gap-3">
            <Avatar className="size-12 shrink-0 border-2 border-primary">
              {trainee.photoUrl && <AvatarImage src={trainee.photoUrl} alt={trainee.name} className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {trainee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg leading-tight truncate">{trainee.name}</DialogTitle>
              <DialogDescription className="sr-only">Trainee details for {trainee.name}</DialogDescription>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge className={`text-xs ${getStatusColor(trainee.status)}`}>{trainee.status || 'N/A'}</Badge>
                <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                  #{String(trainee.id).slice(0, 8)}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Photo */}
        {trainee.photoUrl && (
          <div className="flex justify-center">
            <img
              src={trainee.photoUrl}
              alt={trainee.name}
              className="h-48 w-auto rounded-md object-cover shadow"
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TraineeDetailsTab)} className="w-full" orientation="horizontal">
          <TabsList className="w-full flex items-center justify-start gap-1 h-auto p-1">
            <TabsTrigger value="info" className="flex items-center gap-1.5 px-3 py-2 text-sm">
              <User className="size-4" />
              <span>Info</span>
            </TabsTrigger>
            <TabsTrigger value="trainings" className="flex items-center gap-1.5 px-3 py-2 text-sm">
              <GraduationCap className="size-4" />
              <span>Trainings</span>
              {trainee.trainings.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {trainee.trainings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="certificates" className="flex items-center gap-1.5 px-3 py-2 text-sm">
              <Award className="size-4" />
              <span>Certificates</span>
              {certificates.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {certificates.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-1.5 px-3 py-2 text-sm">
              <QrCode className="size-4" />
              <span>QR Code</span>
            </TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="mt-3 space-y-2">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 text-sm">
              <Mail className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium truncate">{trainee.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 text-sm">
              <Phone className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Contact</p>
                <p className="font-medium">{trainee.contact}</p>
              </div>
            </div>
            {trainee.address && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 text-sm">
                <MapPin className="size-4 shrink-0 text-primary mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-medium">{trainee.address}</p>
                </div>
              </div>
            )}
            {(trainee.emergencyContact || trainee.emergencyContactNumber) && (
              <div className="rounded-lg border border-dashed p-2.5 space-y-1.5 text-sm">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Emergency Contact</p>
                {trainee.emergencyContact && (
                  <div className="flex items-center gap-2">
                    <User className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{trainee.emergencyContact}</span>
                  </div>
                )}
                {trainee.emergencyContactNumber && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 text-muted-foreground" />
                    <span>{trainee.emergencyContactNumber}</span>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Trainings Tab */}
          <TabsContent value="trainings" className="mt-3">
            {trainee.trainings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No training programs enrolled.</p>
            ) : (
              <div className="space-y-2">
                {trainee.trainings.map((training, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/40 text-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight">{training.program}</p>
                      <Badge className={`text-xs shrink-0 ${getStatusColor(training.status)}`}>{training.status || 'N/A'}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />Enrolled: {training.dateEnrolled}
                      </span>
                      {training.dateCompleted && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />Completed: {training.dateCompleted}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Certificates Tab */}
          <TabsContent value="certificates" className="mt-3">
            {hasPermission('canManageTrainees') && (
              <div className="mb-3">
                <Button
                  size="sm"
                  onClick={() => setUploadModalOpen(true)}
                  className="w-full"
                >
                  <Upload className="mr-2 size-4" />
                  Upload Certificate
                </Button>
              </div>
            )}
            {loadingCertificates ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <CertificateViewer
                certificates={certificates}
                canDelete={hasPermission('canManageTrainees')}
                onDelete={handleDeleteCertificate}
              />
            )}
          </TabsContent>

          {/* QR Tab */}
          <TabsContent value="qr" className="mt-3">
            {qrValue ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="trainee-qr-canvas p-3 rounded-xl bg-white shadow-sm border">
                  <QRCodeDisplay value={qrValue} />
                </div>
                <p className="text-xs text-muted-foreground font-mono break-all text-center max-w-[260px]">
                  {qrValue}
                </p>
                <Button size="sm" variant="outline" className="gap-2" onClick={downloadQR}>
                  <Download className="size-3.5" />
                  Download PNG
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No QR code is available for this trainee yet.
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer actions */}
        <div className="flex gap-2 pt-2 border-t mt-1">
          {onEdit && (
            <Button size="sm" className="flex-1" onClick={() => { onEdit(trainee.id); onOpenChange(false); }}>
              Edit Trainee
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Certificate Upload Modal */}
      {trainee && (
        <CertificateUploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          traineeId={String(trainee.id)}
          traineeName={trainee.name}
          onSuccess={() => {
            loadCertificates();
            setUploadModalOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}