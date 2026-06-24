import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  GraduationCap,
  Edit2,
  Save,
  X,
  QrCode,
  Award,
  BookOpen,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { getFileUrl } from '../services/api';
import { toast } from 'sonner';
import traineeService from '../services/traineeService';
import certificateService, { Certificate } from '../services/certificateService';
import QRCodeDisplay from '../components/QRCodeDisplay';
import CertificateViewer from '../components/CertificateViewer';
import { CardGridSkeleton, ListSkeleton } from '../components/LoadingSkeletons';
import { Skeleton } from '../components/ui/skeleton';
import logger from '../utils/logger';

interface TraineeProfile {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  phone: string;
  address: string;
  birth_date: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  photo_path?: string;
  qr_code?: string;
  program_id?: string;
  status: string;
  enrollment_date: string;
  program?: {
    id: string;
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
    instructor?: string | null;
    duration_weeks?: number;
    max_trainees?: number;
  };
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  date_earned: string;
  type: 'certificate' | 'badge' | 'completion';
}

export default function TraineeProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [traineeProfile, setTraineeProfile] = useState<TraineeProfile | null>(null);
  const [editForm, setEditForm] = useState<Partial<TraineeProfile>>({});
  const [achievements] = useState<Achievement[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);

  useEffect(() => {
    loadProfileData();
    loadCertificates();
  }, [user]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      // Get trainee profile from API
      const profile = await traineeService.getMyProfile();
      
      // Transform to match component interface
      const address = `${profile.street}, ${profile.barangay}, ${profile.municipality}, ${profile.province}`;
      
      const profileData: TraineeProfile = {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        middle_name: profile.middle_name,
        email: profile.email,
        phone: profile.phone,
        address: address,
        birth_date: profile.birth_date,
        emergency_contact_name: profile.emergency_contact_name ?? '',
        emergency_contact_phone: profile.emergency_contact_phone ?? '',
        photo_path: profile.photo_path || '',
        qr_code: profile.qr_code,
        program_id: profile.program_id,
        status: profile.status,
        enrollment_date: profile.enrollment_date,
        program: (profile as any).program || undefined
      };
      
      setTraineeProfile(profileData);
      setEditForm(profileData);

    } catch (error: any) {
      logger.error('Failed to load profile data', { error });
      toast.error(error?.message || 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const loadCertificates = async () => {
    try {
      setLoadingCertificates(true);
      const certs = await certificateService.getMyCertificates();
      setCertificates(certs);
    } catch (error: any) {
      logger.error('Failed to load certificates', { error });
      // Don't show error toast for certificates as it's not critical
    } finally {
      setLoadingCertificates(false);
    }
  };

  const handleEditToggle = () => {
    if (editing) {
      // Cancel editing, reset form
      setEditForm(traineeProfile || {});
    }
    setEditing(!editing);
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      
      // Extract address components if address was changed
      let updateData: any = {};
      
      // Only send fields that trainees are allowed to update
      if (editForm.phone !== traineeProfile?.phone) {
        updateData.phone = editForm.phone;
      }
      
      if (editForm.address !== traineeProfile?.address && editForm.address) {
        // Parse address - simplified parsing
        const parts = editForm.address.split(',').map(p => p.trim());
        if (parts.length >= 4) {
          updateData.street = parts[0];
          updateData.barangay = parts[1];
          updateData.municipality = parts[2];
          updateData.province = parts[3];
        }
      }
      
      if (editForm.photo_path !== traineeProfile?.photo_path) {
        updateData.photo_path = editForm.photo_path;
      }

      if (editForm.emergency_contact_name !== traineeProfile?.emergency_contact_name) {
        updateData.emergency_contact_name = editForm.emergency_contact_name ?? null;
      }

      if (editForm.emergency_contact_phone !== traineeProfile?.emergency_contact_phone) {
        updateData.emergency_contact_phone = editForm.emergency_contact_phone ?? null;
      }
      
      if (Object.keys(updateData).length === 0) {
        toast.info('No changes to save');
        setEditing(false);
        return;
      }
      
      // Call API to update profile
      await traineeService.updateMyProfile(updateData);
      
      // Reload profile data
      await loadProfileData();
      
      setEditing(false);
      toast.success('Profile updated successfully');
      
    } catch (error: any) {
      logger.error('Failed to save profile', { error });
      toast.error(error?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case 'certificate':
        return <Award className="size-5 text-yellow-500" />;
      case 'badge':
        return <CheckCircle2 className="size-5 text-green-500" />;
      case 'completion':
        return <BookOpen className="size-5 text-blue-500" />;
      default:
        return <Award className="size-5 text-gray-500" />;
    }
  };

  const getAchievementBadge = (type: string) => {
    switch (type) {
      case 'certificate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'badge':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completion':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="My Profile">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Skeleton className="size-20 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-7 w-64" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </CardHeader>
          </Card>
          <CardGridSkeleton count={3} />
          <ListSkeleton rows={4} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Profile">
      <div className="space-y-6">
        {/* Profile Header Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-20 border-2 border-primary">
                  <AvatarImage src={traineeProfile?.photo_path ? getFileUrl(traineeProfile.photo_path) : ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {traineeProfile?.first_name?.[0]}{traineeProfile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">
                    {traineeProfile?.first_name} {traineeProfile?.middle_name?.[0]}. {traineeProfile?.last_name}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {traineeProfile?.program?.name || 'No program enrolled'}
                  </CardDescription>
                  <div className="flex gap-2 mt-2">
                    <Badge variant={traineeProfile?.status === 'active' ? 'default' : 'secondary'}>
                      {traineeProfile?.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <Button variant="outline" onClick={handleEditToggle} disabled={saving}>
                      <X className="mr-2 size-4" />
                      Cancel
                    </Button>
                    <Button onClick={handleSaveProfile} disabled={saving}>
                      {saving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Save className="mr-2 size-4" />
                      )}
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleEditToggle}>
                    <Edit2 className="mr-2 size-4" />
                    Edit Profile
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="personal" className="w-full">
              <TabsList>
                <TabsTrigger value="personal">Personal Info</TabsTrigger>
                <TabsTrigger value="contact">Contact & Emergency</TabsTrigger>
                <TabsTrigger value="certificates">
                  Certificates
                  {certificates.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {certificates.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="achievements">Achievements</TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="size-5" />
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name</Label>
                        {editing ? (
                          <Input
                            id="first_name"
                            value={editForm.first_name || ''}
                            onChange={(e) => handleInputChange('first_name', e.target.value)}
                          />
                        ) : (
                          <p className="py-2 px-3 bg-muted rounded-md">{traineeProfile?.first_name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="middle_name">Middle Name</Label>
                        {editing ? (
                          <Input
                            id="middle_name"
                            value={editForm.middle_name || ''}
                            onChange={(e) => handleInputChange('middle_name', e.target.value)}
                          />
                        ) : (
                          <p className="py-2 px-3 bg-muted rounded-md">{traineeProfile?.middle_name || '-'}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name</Label>
                        {editing ? (
                          <Input
                            id="last_name"
                            value={editForm.last_name || ''}
                            onChange={(e) => handleInputChange('last_name', e.target.value)}
                          />
                        ) : (
                          <p className="py-2 px-3 bg-muted rounded-md">{traineeProfile?.last_name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="birth_date">Birth Date</Label>
                        {editing ? (
                          <Input
                            id="birth_date"
                            type="date"
                            value={editForm.birth_date || ''}
                            onChange={(e) => handleInputChange('birth_date', e.target.value)}
                          />
                        ) : (
                          <p className="py-2 px-3 bg-muted rounded-md flex items-center gap-2">
                            <Calendar className="size-4 text-muted-foreground" />
                            {traineeProfile?.birth_date ? formatDate(traineeProfile.birth_date) : '-'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      {editing ? (
                        <Input
                          id="address"
                          value={editForm.address || ''}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                        />
                      ) : (
                        <p className="py-2 px-3 bg-muted rounded-md">{traineeProfile?.address || '-'}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contact" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Phone className="size-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <p className="py-2 px-3 bg-muted rounded-md flex items-center gap-2">
                          <Mail className="size-4 text-muted-foreground" />
                          {traineeProfile?.email}
                        </p>
                        <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        {editing ? (
                          <Input
                            id="phone"
                            value={editForm.phone || ''}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                          />
                        ) : (
                          <p className="py-2 px-3 bg-muted rounded-md flex items-center gap-2">
                            <Phone className="size-4 text-muted-foreground" />
                            {traineeProfile?.phone || '-'}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <h4 className="font-semibold text-destructive">Emergency Contact</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="emergency_contact_name">Contact Name</Label>
                        {editing ? (
                          <Input
                            id="emergency_contact_name"
                            value={editForm.emergency_contact_name || ''}
                            onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                          />
                        ) : (
                          <p className="py-2 px-3 bg-muted rounded-md">
                            {traineeProfile?.emergency_contact_name || '-'}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                        {editing ? (
                          <Input
                            id="emergency_contact_phone"
                            value={editForm.emergency_contact_phone || ''}
                            onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                          />
                        ) : (
                          <p className="py-2 px-3 bg-muted rounded-md">
                            {traineeProfile?.emergency_contact_phone || '-'}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="certificates" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="size-5" />
                      My Certificates
                    </CardTitle>
                    <CardDescription>
                      Certificates uploaded by your administrator
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingCertificates ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                      </div>
                    ) : (
                      <CertificateViewer certificates={certificates} />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="achievements" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="size-5" />
                      Achievements & Badges
                    </CardTitle>
                    <CardDescription>
                      Your earned badges and program completions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {achievements.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Award className="size-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No achievements yet</p>
                        <p className="text-sm text-muted-foreground">
                          Complete modules and attend sessions to earn achievements
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {achievements.map((achievement) => (
                          <div 
                            key={achievement.id} 
                            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                              {getAchievementIcon(achievement.type)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold">{achievement.title}</h4>
                                <Badge className={getAchievementBadge(achievement.type)}>
                                  {achievement.type}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {achievement.description}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <Clock className="size-3" />
                                Earned on {formatDate(achievement.date_earned)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - QR Code & Program Info */}
          <div className="space-y-6">
            {/* QR Code Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <QrCode className="size-5" />
                  My QR Code
                </CardTitle>
                <CardDescription>
                  Show this QR code for attendance scanning
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="bg-white p-3 rounded-lg border border-border flex items-center justify-center">
                  {traineeProfile?.qr_code ? (
                    <QRCodeDisplay value={traineeProfile.qr_code} />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center">
                      <QrCode className="size-24 text-gray-300" />
                    </div>
                  )}
                </div>
                {traineeProfile?.qr_code && (
                  <p className="text-xs text-muted-foreground font-mono mt-2 text-center break-all">
                    {traineeProfile.qr_code}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Present this code to your facilitator during session check-in
                </p>
              </CardContent>
            </Card>

            {/* Program Card */}
            {traineeProfile?.program && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="size-5" />
                    Current Program
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold">{traineeProfile.program.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {traineeProfile.program.description}
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Start Date</span>
                      <span>{formatDate(traineeProfile.program.start_date)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">End Date</span>
                      <span>{formatDate(traineeProfile.program.end_date)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={traineeProfile.program.status === 'active' ? 'default' : 'secondary'}>
                        {traineeProfile.program.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Enrolled</span>
                      <span>{formatDate(traineeProfile.enrollment_date)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
