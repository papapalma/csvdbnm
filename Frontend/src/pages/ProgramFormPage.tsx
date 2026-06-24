import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { api, getFileUrl } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import programService from '../services/programService';
import sessionService, { CreateSessionData, ProgramSession } from '../services/sessionService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import ImageUpload from '../components/ImageUpload';
import { toast } from 'sonner';
import { 
  Save, 
  X, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Laptop, 
  Wrench, 
  ChefHat, 
  Users, 
  Briefcase, 
  Heart, 
  Scissors, 
  Paintbrush, 
  Camera, 
  Music, 
  Code, 
  Car, 
  GraduationCap,
  FileText,
  Clock,
  Settings,
  Plus,
  Loader2,
  CalendarDays,
  Sparkles,
  Calendar,
  Trash2,
  Building2,
} from 'lucide-react';
// Icon options for programs
const iconOptions = [
  { value: 'Laptop', label: 'Computer/Laptop', icon: Laptop },
  { value: 'Wrench', label: 'Technical/Tools', icon: Wrench },
  { value: 'ChefHat', label: 'Culinary/Chef', icon: ChefHat },
  { value: 'Users', label: 'People/Community', icon: Users },
  { value: 'Briefcase', label: 'Business', icon: Briefcase },
  { value: 'Heart', label: 'Healthcare', icon: Heart },
  { value: 'Scissors', label: 'Beauty/Salon', icon: Scissors },
  { value: 'Paintbrush', label: 'Arts/Crafts', icon: Paintbrush },
  { value: 'Camera', label: 'Photography', icon: Camera },
  { value: 'Music', label: 'Music', icon: Music },
  { value: 'Code', label: 'Programming', icon: Code },
  { value: 'Car', label: 'Automotive', icon: Car },
];

const getIconComponent = (iconName: string) => {
  const iconOption = iconOptions.find(opt => opt.value === iconName);
  return iconOption ? iconOption.icon : GraduationCap;
};

export default function ProgramFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    durationWeeks: '',
    level: '',
    icon: 'GraduationCap',
    status: 'active' as 'active' | 'inactive',
    startDate: '',
    endDate: '',
    photoUrl: '',
    instructor: '',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(!!id);

  // Inline field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearFieldError = (field: string) =>
    setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  const handleInputChangeValidated = (field: string, value: any) => {
    handleInputChange(field, value);
    if (value !== '' && value !== null && value !== undefined) clearFieldError(field);
  };

  // Generate Sessions dialog state
  const [genOpen, setGenOpen] = useState(false);
  const [genStartDate, setGenStartDate] = useState('');
  const [genEndDate, setGenEndDate]     = useState('');
  const [genTitle, setGenTitle]         = useState('Session');
  const [genStartTime, setGenStartTime] = useState('08:00');
  const [genEndTime, setGenEndTime]     = useState('17:00');
  const [genDays, setGenDays]           = useState<number[]>([1, 2, 3, 4, 5]);
  const [genExcluded, setGenExcluded]   = useState<Set<string>>(new Set());
  const [genLoading, setGenLoading]     = useState(false);

  // Sessions management state
  const [sessions, setSessions]                     = useState<ProgramSession[]>([]);
  const [sessionsLoading, setSessionsLoading]       = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen]   = useState(false);
  const [editingSession, setEditingSession]         = useState<ProgramSession | null>(null);
  const [sessionForm, setSessionForm]               = useState({ title: 'Session', session_date: '', start_time: '08:00', end_time: '17:00' });
  const [sessionFormLoading, setSessionFormLoading] = useState(false);
  const [sessionToDelete, setSessionToDelete]       = useState<ProgramSession | null>(null);
  const [deleteSessionLoading, setDeleteSessionLoading] = useState(false);
  const [clearAllOpen, setClearAllOpen]             = useState(false);
  const [clearAllLoading, setClearAllLoading]       = useState(false);
  const [sessionsModalOpen, setSessionsModalOpen]   = useState(false);
  const [collapsedMonths, setCollapsedMonths]       = useState<Set<string>>(new Set());

  // Define steps
  const steps = [
    { 
      id: 1, 
      title: 'Basic Information', 
      description: 'Program name and description',
      icon: FileText 
    },
    { 
      id: 2, 
      title: 'Program Details', 
      description: 'Duration, level, and schedule',
      icon: Clock 
    },
    { 
      id: 3, 
      title: 'Appearance & Settings', 
      description: 'Icon, status, and photo',
      icon: Settings 
    },
  ];

  // Load existing program data if editing
  useEffect(() => {
    if (id) {
      setPageLoading(true);
      programService.getProgramById(id)
        .then(program => {
          const programData = program as any;
          setFormData({
            name: program.name,
            description: program.description || '',
            durationWeeks: program.duration_weeks ? program.duration_weeks.toString() : '',
            level: (programData.level as string) || '',
            icon: 'GraduationCap',
            status: program.status === 'active' ? 'active' : 'inactive',
            startDate: program.start_date ? program.start_date.split('T')[0] : '',
            endDate: program.end_date ? program.end_date.split('T')[0] : '',
            photoUrl: getFileUrl(program.image_path),
            instructor: programData.instructor || '',
          });
          setExistingImagePath(program.image_path || null);
        })
        .catch(() => toast.error('Failed to load program'))
        .finally(() => setPageLoading(false));
    } else {
      setPageLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      setSessionsLoading(true);
      sessionService.getSessionsByProgram(id)
        .then(res => setSessions(
          (res.data ?? []).sort((a, b) =>
            a.session_date.localeCompare(b.session_date) || a.start_time.localeCompare(b.start_time)
          )
        ))
        .catch(() => {})
        .finally(() => setSessionsLoading(false));
    } else {
      setSessions([]);
    }
  }, [id]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};
    switch (step) {
      case 1:
        if (!formData.name.trim())        errors.name        = 'Program name is required';
        if (!formData.description.trim()) errors.description = 'Description is required';
        break;
      case 2:
        if (!formData.durationWeeks.trim() || isNaN(parseInt(formData.durationWeeks)) || parseInt(formData.durationWeeks) < 1)
          errors.durationWeeks = 'Enter a valid duration (at least 1 week)';
        if (!formData.level) errors.level = 'Please select a level';
        if (!formData.startDate) errors.startDate = 'Start date is required';
        if (!formData.endDate)   errors.endDate   = 'End date is required';
        if (formData.startDate && formData.endDate && formData.startDate > formData.endDate)
          errors.endDate = 'End date must be after start date';
        break;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(prev => ({ ...prev, ...errors }));
      toast.error('Please fill in all required fields');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  // Upload image if a new file was chosen; otherwise return existing path
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadImageIfNeeded = async (): Promise<string | null | undefined> => {
    if (!imageFile) return existingImagePath ?? undefined;
    try {
      const base64 = await toBase64(imageFile);
      const response = await api.post<{ filePath: string; url: string }>('/upload/tenant', {
        file: base64,
        category: 'images/programs',
        filename: imageFile.name,
        prefix: `program_${id || 'new'}`,
      });
      if (response.success && response.data?.filePath) {
        return response.data.filePath;
      }
      toast.error('Image upload failed');
      return null;
    } catch {
      toast.error('Image upload error');
      return null;
    }
  };

  const deleteUploadedFile = (filePath: string) => {
    api.delete('/upload/tenant', { data: { filePath } }).catch(() => {/* fire-and-forget */});
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
      const imagePath = await uploadImageIfNeeded();

      // If the image changed, delete the old file
      if (existingImagePath && imagePath !== existingImagePath) {
        deleteUploadedFile(existingImagePath);
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        duration_weeks: parseInt(formData.durationWeeks),
        start_date: formData.startDate || undefined,
        end_date: formData.endDate || undefined,
        image_path: imagePath ?? null,
        instructor: formData.instructor.trim() || undefined,
        level: (formData.level || undefined) as 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels' | undefined,
      };

      if (id) {
        await programService.updateProgram(id, payload);
        toast.success('Program updated successfully!');
      } else {
        await programService.createProgram(payload as any);
        toast.success('Program added successfully!');
      }

      navigate('/programs');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save program');
    } finally {
      setLoading(false);
    }
  };

  const sortSessions = (arr: ProgramSession[]) =>
    [...arr].sort((a, b) => a.session_date.localeCompare(b.session_date) || a.start_time.localeCompare(b.start_time));

  const openAddSession = () => {
    setEditingSession(null);
    setSessionForm({ title: 'Session', session_date: formData.startDate || '', start_time: '08:00', end_time: '17:00' });
    setSessionDialogOpen(true);
  };

  const openEditSession = (s: ProgramSession) => {
    setEditingSession(s);
    setSessionForm({ title: s.title, session_date: s.session_date, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5) });
    setSessionDialogOpen(true);
  };

  const handleSaveSession = async () => {
    if (!sessionForm.session_date || !sessionForm.title.trim()) { toast.error('Title and date are required'); return; }
    setSessionFormLoading(true);
    try {
      if (editingSession) {
        const res = await sessionService.updateSession(editingSession.id, {
          title: sessionForm.title,
          session_date: sessionForm.session_date,
          start_time: sessionForm.start_time,
          end_time: sessionForm.end_time,
        });
        setSessions(prev => sortSessions(prev.map(s => s.id === editingSession.id ? (res.data ?? s) : s)));
        toast.success('Session updated');
      } else {
        const res = await sessionService.createSession({
          ...sessionForm,
          program_id: id!,
          session_type: 'lecture',
        });
        setSessions(prev => sortSessions([...prev, res.data!]));
        toast.success('Session added');
      }
      setSessionDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? 'Failed to save session');
    } finally {
      setSessionFormLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    setDeleteSessionLoading(true);
    try {
      await sessionService.deleteSession(sessionToDelete.id);
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
      toast.success('Session deleted');
      setSessionToDelete(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? 'Failed to delete session');
    } finally {
      setDeleteSessionLoading(false);
    }
  };

  const handleClearAllSessions = async () => {
    setClearAllLoading(true);
    try {
      await Promise.all(sessions.map(s => sessionService.deleteSession(s.id)));
      setSessions([]);
      toast.success('All sessions cleared');
      setClearAllOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? 'Failed to clear sessions');
    } finally {
      setClearAllLoading(false);
    }
  };

  const SelectedIcon = getIconComponent(formData.icon);

  const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate sessions helpers
  const genPreviewDates = (() => {
    if (!genStartDate || !genEndDate) return [];
    const result: string[] = [];
    const start = new Date(genStartDate + 'T00:00:00');
    const end   = new Date(genEndDate   + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
    const cur = new Date(start);
    while (cur <= end) {
      if (genDays.includes(cur.getDay())) result.push(toLocalDateString(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  })();
  const genActiveDates = genPreviewDates.filter(d => !genExcluded.has(d));

  const openGenDialog = () => {
    setGenStartDate(formData.startDate || '');
    setGenEndDate(formData.endDate || '');
    setGenTitle('Session');
    setGenStartTime('08:00');
    setGenEndTime('17:00');
    setGenDays([1, 2, 3, 4, 5]);
    setGenExcluded(new Set());
    setGenOpen(true);
  };

  const handleGenerate = async () => {
    if (!id || genActiveDates.length === 0) { toast.error('No dates selected'); return; }
    setGenLoading(true);
    try {
      const sessionPayloads: CreateSessionData[] = genActiveDates.map(date => ({
        program_id: id,
        title: genTitle.trim() || 'Session',
        session_date: date,
        start_time: genStartTime,
        end_time: genEndTime,
        session_type: 'lecture' as const,
      }));
      const res = await sessionService.createBulkSessions(sessionPayloads);
      const created = (res.data ?? []).length;
      const skipped = genActiveDates.length - created;
      if (created === 0) {
        toast.info('All selected dates already have sessions — nothing was created.');
      } else if (skipped > 0) {
        toast.success(`Created ${created} session${created !== 1 ? 's' : ''}. ${skipped} date${skipped !== 1 ? 's' : ''} skipped (already exist).`);
      } else {
        toast.success(`Created ${created} session${created !== 1 ? 's' : ''}`);
      }
      if (created > 0) {
        setSessions(prev => sortSessions([...prev, ...(res.data ?? [])]));
      }
      setGenOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to generate sessions';
      toast.error(msg);
    } finally {
      setGenLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-28 w-full" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2">
            <GraduationCap className="size-8" />
            {id ? 'Edit Program' : 'New Program'}
          </h1>
          <p className="text-muted-foreground">
            {id ? 'Update program information' : `Add a new training program to ${user?.tenantName || 'your organization'}`}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="grid grid-cols-3 gap-4">
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
                  <div className="flex items-center gap-3">
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
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isActive ? 'font-semibold' : ''}`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
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
                  <Label htmlFor="name" className={fieldErrors.name ? 'text-destructive' : ''}>Program Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChangeValidated('name', e.target.value)}
                    placeholder="e.g., Computer Literacy"
                    className={fieldErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {fieldErrors.name
                    ? <p className="text-xs text-destructive">{fieldErrors.name}</p>
                    : <p className="text-xs text-muted-foreground">Enter a clear and descriptive name for the training program</p>
                  }
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className={fieldErrors.description ? 'text-destructive' : ''}>Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChangeValidated('description', e.target.value)}
                    placeholder="Describe what trainees will learn, program objectives, and key outcomes..."
                    rows={6}
                    className={fieldErrors.description ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {fieldErrors.description
                    ? <p className="text-xs text-destructive">{fieldErrors.description}</p>
                    : <p className="text-xs text-muted-foreground">Provide a detailed description to help trainees understand what this program offers</p>
                  }
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructor">Instructor Name (Optional)</Label>
                  <Input
                    id="instructor"
                    value={formData.instructor}
                    onChange={(e) => handleInputChange('instructor', e.target.value)}
                    placeholder="e.g., John Doe"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the name of the instructor for this program
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Program Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="durationWeeks" className={fieldErrors.durationWeeks ? 'text-destructive' : ''}>Duration (weeks) *</Label>
                    <Input
                      id="durationWeeks"
                      type="number"
                      min={1}
                      value={formData.durationWeeks}
                      onChange={(e) => handleInputChangeValidated('durationWeeks', e.target.value)}
                      placeholder="e.g., 12"
                      className={fieldErrors.durationWeeks ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {fieldErrors.durationWeeks
                      ? <p className="text-xs text-destructive">{fieldErrors.durationWeeks}</p>
                      : <p className="text-xs text-muted-foreground">How many weeks will this program take to complete?</p>
                    }
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="level" className={fieldErrors.level ? 'text-destructive' : ''}>Level *</Label>
                    <Select value={formData.level} onValueChange={(value: string) => handleInputChangeValidated('level', value)}>
                      <SelectTrigger className={fieldErrors.level ? 'border-destructive focus:ring-destructive' : ''}>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Beginner">Beginner</SelectItem>
                        <SelectItem value="Intermediate">Intermediate</SelectItem>
                        <SelectItem value="Advanced">Advanced</SelectItem>
                        <SelectItem value="All Levels">All Levels</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.level
                      ? <p className="text-xs text-destructive">{fieldErrors.level}</p>
                      : <p className="text-xs text-muted-foreground">What skill level is required for this program?</p>
                    }
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className={fieldErrors.startDate ? 'text-destructive' : ''}>Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChangeValidated('startDate', e.target.value)}
                      className={fieldErrors.startDate ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {fieldErrors.startDate
                      ? <p className="text-xs text-destructive">{fieldErrors.startDate}</p>
                      : <p className="text-xs text-muted-foreground">When does this program begin?</p>
                    }
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate" className={fieldErrors.endDate ? 'text-destructive' : ''}>End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleInputChangeValidated('endDate', e.target.value)}
                      className={fieldErrors.endDate ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {fieldErrors.endDate
                      ? <p className="text-xs text-destructive">{fieldErrors.endDate}</p>
                      : <p className="text-xs text-muted-foreground">When does this program end? (Program will auto-deactivate after this date)</p>
                    }
                  </div>
                </div>

                {/* Sessions — only visible when editing an existing program */}
                {id && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Sessions</p>
                        <p className="text-xs text-muted-foreground">
                          {sessionsLoading ? 'Loading…' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} scheduled`}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setSessionsModalOpen(true)} className="gap-1.5">
                        <CalendarDays className="size-3.5" /> Manage Sessions
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Appearance & Settings */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="icon">Program Icon</Label>
                  <Select value={formData.icon} onValueChange={(value: string) => handleInputChange('icon', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="size-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-3 flex items-center gap-3 p-4 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Icon Preview:</span>
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                      <SelectedIcon className="size-6 text-primary" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Program Status</Label>
                  <Select value={formData.status} onValueChange={(value: string) => handleInputChange('status', value as 'active' | 'inactive')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-green-500" />
                          Active - Program is open for enrollment
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-gray-500" />
                          Inactive - Program is closed
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Active programs are visible on the landing page and open for enrollment
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Program Photo (Optional)</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload an image to make your program more engaging on the landing page
                  </p>
                  <ImageUpload
                    value={formData.photoUrl}
                    onChange={(value) => {
                      handleInputChange('photoUrl', value);
                      if (!value) setExistingImagePath(null);
                    }}
                    onFileChange={(file) => setImageFile(file)}
                    label="Upload Program Photo"
                  />
                </div>

                {/* Summary Preview */}
                <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <GraduationCap className="size-5" />
                    Program Summary
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{formData.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Instructor:</span>
                      <span className="font-medium">{formData.instructor || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{formData.durationWeeks ? `${formData.durationWeeks} weeks` : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Level:</span>
                      <span className="font-medium">{formData.level || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={`font-medium ${formData.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                        {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
                      </span>
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
              onClick={() => navigate('/programs')}
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
              <Save className="mr-2 size-4" />
              {loading ? 'Saving…' : id ? 'Update Program' : 'Save Program'}
            </Button>
          )}
        </div>
      </div>
      {/* ── Generate Sessions Dialog ── */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-start gap-4 px-6 pt-6 pb-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">Generate Sessions</DialogTitle>
              <DialogDescription className="mt-0.5">
                Auto-fill attendance sessions from a date range. Choose which days to include and uncheck any dates to skip.
              </DialogDescription>
            </div>
          </div>

          <Separator />

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Section 1 — Date Range */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Calendar className="size-4 text-primary" />
                Date Range
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Start Date</Label>
                  <Input
                    type="date"
                    value={genStartDate}
                    onChange={e => { setGenStartDate(e.target.value); setGenExcluded(new Set()); }}
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">End Date</Label>
                  <Input
                    type="date"
                    value={genEndDate}
                    onChange={e => { setGenEndDate(e.target.value); setGenExcluded(new Set()); }}
                    className="bg-muted/30"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 2 — Session Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock className="size-4 text-primary" />
                Session Details
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Session Title</Label>
                  <Input
                    value={genTitle}
                    onChange={e => setGenTitle(e.target.value)}
                    placeholder="Session"
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Start Time</Label>
                  <Input
                    type="time"
                    value={genStartTime}
                    onChange={e => setGenStartTime(e.target.value)}
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">End Time</Label>
                  <Input
                    type="time"
                    value={genEndTime}
                    onChange={e => setGenEndTime(e.target.value)}
                    className="bg-muted/30"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 3 — Days of Week */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarDays className="size-4 text-primary" />
                  Repeat on Days
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const weekdays = [1, 2, 3, 4, 5];
                    const allWeekdays = weekdays.every(d => genDays.includes(d)) && genDays.length === 5;
                    setGenDays(allWeekdays ? [0, 1, 2, 3, 4, 5, 6] : weekdays);
                    setGenExcluded(new Set());
                  }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {genDays.length === 7 ? 'Weekdays only' : genDays.length === 5 && !genDays.includes(0) && !genDays.includes(6) ? 'All days' : 'Weekdays only'}
                </button>
              </div>
              <div className="flex gap-1.5">
                {([{ label: 'S', full: 'Sunday',    dow: 0 },
                   { label: 'M', full: 'Monday',    dow: 1 },
                   { label: 'T', full: 'Tuesday',   dow: 2 },
                   { label: 'W', full: 'Wednesday', dow: 3 },
                   { label: 'T', full: 'Thursday',  dow: 4 },
                   { label: 'F', full: 'Friday',    dow: 5 },
                   { label: 'S', full: 'Saturday',  dow: 6 }] as const).map(({ label, full, dow }) => {
                  const active = genDays.includes(dow);
                  return (
                    <button
                      key={dow}
                      type="button"
                      title={full}
                      onClick={() => {
                        setGenDays(prev => active ? prev.filter(d => d !== dow) : [...prev, dow].sort((a, b) => a - b));
                        setGenExcluded(new Set());
                      }}
                      className={`flex size-9 items-center justify-center rounded-full text-xs font-semibold transition-all select-none ${
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 4 — Date Preview (grouped by month) */}
            {genPreviewDates.length > 0 && (() => {
              // Group dates by "YYYY-MM"
              const months: Record<string, string[]> = {};
              for (const date of genPreviewDates) {
                const key = date.slice(0, 7);
                (months[key] ??= []).push(date);
              }
              return (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <CalendarDays className="size-4 text-primary" />
                        Date Preview
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {genActiveDates.length} selected
                        </span>
                        {genExcluded.size > 0 && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {genExcluded.size} skipped
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Click a date chip to skip it. Click the month label to toggle the whole month.</p>
                    <div className="space-y-3">
                      {Object.entries(months).map(([monthKey, dates]) => {
                        const monthLabel = new Date(monthKey + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        const allExcluded = dates.every(d => genExcluded.has(d));
                        const someExcluded = dates.some(d => genExcluded.has(d));
                        return (
                          <div key={monthKey} className="rounded-lg border bg-muted/20 overflow-hidden">
                            {/* Month header */}
                            <button
                              type="button"
                              onClick={() => {
                                setGenExcluded(prev => {
                                  const next = new Set(prev);
                                  if (allExcluded) {
                                    dates.forEach(d => next.delete(d));
                                  } else {
                                    dates.forEach(d => next.add(d));
                                  }
                                  return next;
                                });
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                            >
                              <span>{monthLabel}</span>
                              <span className={`text-xs font-normal ${allExcluded ? 'text-muted-foreground' : someExcluded ? 'text-amber-500' : 'text-primary'}`}>
                                {allExcluded ? 'all skipped' : someExcluded ? `${dates.filter(d => !genExcluded.has(d)).length}/${dates.length}` : `${dates.length} days`}
                              </span>
                            </button>
                            {/* Date chips */}
                            <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
                              {dates.map(date => {
                                const d = new Date(date + 'T00:00:00');
                                const excluded = genExcluded.has(date);
                                const day = d.getDate();
                                const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
                                return (
                                  <button
                                    key={date}
                                    type="button"
                                    title={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                    onClick={() => {
                                      setGenExcluded(prev => {
                                        const next = new Set(prev);
                                        excluded ? next.delete(date) : next.add(date);
                                        return next;
                                      });
                                    }}
                                    className={`flex flex-col items-center rounded-md border px-2 py-1 text-center transition-all select-none w-11 ${
                                      excluded
                                        ? 'border-border bg-muted/30 opacity-40 line-through'
                                        : 'border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary'
                                    }`}
                                  >
                                    <span className="text-[10px] leading-none opacity-70">{wd}</span>
                                    <span className="text-sm font-semibold leading-tight">{day}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}

            {genStartDate && genEndDate && genPreviewDates.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-muted-foreground">
                <CalendarDays className="size-8 opacity-30" />
                <p className="text-sm">No dates match the selected days in this range.</p>
              </div>
            )}

            {/* Section 5 — Summary / Verification */}
            {genActiveDates.length > 0 && (() => {
              const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
              const fmt = (t: string) => {
                const [h, m] = t.split(':');
                const hour = parseInt(h);
                return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
              };
              const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              return (
                <>
                  <Separator />
                  <div className="rounded-xl overflow-hidden border border-primary/25 bg-gradient-to-br from-primary/5 to-primary/10">
                    {/* Card header */}
                    <div className="flex items-center gap-2.5 border-b border-primary/15 bg-primary/10 px-4 py-3">
                      <div className="flex size-7 items-center justify-center rounded-full bg-primary/20">
                        <Sparkles className="size-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Ready to Generate</span>
                      <span className="ml-auto inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                        {genActiveDates.length} session{genActiveDates.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 divide-x divide-primary/15 border-b border-primary/15">
                      {[
                        { label: 'From',     value: fmtDate(genStartDate) },
                        { label: 'To',       value: fmtDate(genEndDate)   },
                        { label: 'Duration', value: `${fmt(genStartTime)} – ${fmt(genEndTime)}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col items-center py-3 px-2 text-center">
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
                          <span className="mt-0.5 text-xs font-semibold text-foreground leading-snug">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Bottom row — title + days + skipped */}
                    <div className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Title</span>
                        <span className="font-semibold text-foreground">{genTitle.trim() || 'Session'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Days</span>
                        <div className="flex gap-0.5">
                          {[0,1,2,3,4,5,6].map(d => (
                            <span
                              key={d}
                              className={`inline-flex size-5 items-center justify-center rounded-full text-[9px] font-bold ${
                                genDays.includes(d)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted/60 text-muted-foreground opacity-50'
                              }`}
                            >
                              {DAY_NAMES[d][0]}
                            </span>
                          ))}
                        </div>
                      </div>
                      {genExcluded.size > 0 && (
                        <div className="ml-auto flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <span className="font-semibold">{genExcluded.size}</span>
                          <span>date{genExcluded.size !== 1 ? 's' : ''} skipped</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          <Separator />

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="text-sm text-muted-foreground">
              {genActiveDates.length > 0
                ? <><span className="font-semibold text-foreground">{genActiveDates.length}</span> session{genActiveDates.length !== 1 ? 's' : ''} will be created</>
                : 'No sessions selected'
              }
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setGenOpen(false)} disabled={genLoading}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={genLoading || genActiveDates.length === 0} className="gap-1.5">
                {genLoading
                  ? <><Loader2 className="size-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="size-4" /> Generate Sessions</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ── Sessions Manager Modal ── */}
      <Dialog open={sessionsModalOpen} onOpenChange={setSessionsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">

          {/* Header */}
          <div className="flex items-start gap-4 px-6 pt-6 pb-4 border-b">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg leading-tight">Manage Sessions</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {sessionsLoading
                  ? 'Loading sessions…'
                  : sessions.length === 0
                  ? 'No sessions scheduled yet.'
                  : `${sessions.length} session${sessions.length !== 1 ? 's' : ''} · ${sessions.filter(s => s.status === 'completed').length} completed · ${sessions.filter(s => s.status === 'scheduled').length} upcoming`
                }
              </DialogDescription>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button type="button" size="sm" onClick={openAddSession} className="gap-1.5">
                <Plus className="size-3.5" /> Add Session
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setSessionsModalOpen(false); openGenDialog(); }} className="gap-1.5">
                <Sparkles className="size-3.5" /> Add Attendance
              </Button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {sessionsLoading ? (
              <div className="space-y-3">
                {[0, 1].map(g => (
                  <div key={g} className="rounded-xl border bg-card overflow-hidden animate-pulse">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <div className="h-4 w-28 rounded bg-muted" />
                      <div className="h-3 w-16 rounded bg-muted" />
                    </div>
                    <div className="flex flex-wrap gap-2 px-4 py-3">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="h-[52px] w-11 rounded-lg bg-muted" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-3">
                  <CalendarDays className="size-7 opacity-40" />
                </div>
                <p className="text-sm font-semibold">No sessions yet</p>
                <p className="text-xs mt-1 text-center max-w-xs">
                  Click <strong>Add Session</strong> to create one manually, or <strong>Add Attendance</strong> to bulk-generate from the program's date range.
                </p>
              </div>
            ) : (() => {
                const grouped: Record<string, ProgramSession[]> = {};
                for (const s of sessions) {
                  const key = s.session_date.slice(0, 7);
                  (grouped[key] ??= []).push(s);
                }
                const fmtTime = (t: string) => {
                  const [h, m] = t.split(':').map(Number);
                  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                };
                return Object.entries(grouped)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([monthKey, monthSessions]) => {
                    const [yr, mo] = monthKey.split('-');
                    const monthLabel = new Date(Number(yr), Number(mo) - 1, 1)
                      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    const isCollapsed = collapsedMonths.has(monthKey);
                    const activeCount = monthSessions.filter(s => s.status !== 'cancelled').length;
                    const total = monthSessions.length;
                    const countLabel = activeCount === 0
                      ? 'all cancelled'
                      : activeCount < total
                      ? `${activeCount}/${total} active`
                      : `${total} session${total !== 1 ? 's' : ''}`;
                    const countColor = activeCount === 0
                      ? 'text-red-400'
                      : activeCount < total
                      ? 'text-amber-500 dark:text-amber-400'
                      : 'text-muted-foreground';
                    return (
                      <div key={monthKey} className="rounded-xl border bg-card overflow-hidden">
                        {/* Month header — click to collapse/expand */}
                        <button
                          type="button"
                          onClick={() => setCollapsedMonths(prev => {
                            const next = new Set(prev);
                            isCollapsed ? next.delete(monthKey) : next.add(monthKey);
                            return next;
                          })}
                          className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{monthLabel}</span>
                            <span className={`text-xs ${countColor}`}>· {countLabel}</span>
                          </div>
                          <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                        </button>
                        {/* Chip grid */}
                        {!isCollapsed && (
                          <div className="flex flex-wrap gap-2 px-4 pb-4 pt-3 border-t bg-muted/20">
                            {monthSessions.map(s => {
                              const d = new Date(s.session_date + 'T00:00:00');
                              const dayNum = d.getDate();
                              const dow = d.toLocaleDateString('en-US', { weekday: 'short' });
                              const fullDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                              const isCompleted = s.status === 'completed';
                              const isCancelled = s.status === 'cancelled';
                              const chipCls = isCompleted
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60'
                                : isCancelled
                                ? 'border-border/40 bg-muted/20 text-muted-foreground/50'
                                : 'border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 hover:border-primary/40';
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  title={`${fullDate} · ${s.title} · ${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}`}
                                  onClick={() => openEditSession(s)}
                                  className={`flex flex-col items-center justify-center rounded-lg border w-11 h-[52px] transition-all select-none ${
                                    isCancelled ? 'cursor-default [text-decoration:line-through] opacity-50' : 'cursor-pointer'
                                  } ${chipCls}`}
                                >
                                  <span className="text-[7px] font-bold uppercase leading-none tracking-wide opacity-60">{dow}</span>
                                  <span className="text-[15px] font-bold leading-tight mt-0.5">{dayNum}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
              })()
            }
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-muted/30">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-400 inline-block" /> Scheduled</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500 inline-block" /> Completed</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-400 inline-block" /> Cancelled</span>
            </div>
            <div className="flex gap-2">
              {sessions.length > 0 && (
                <Button type="button" variant="outline" size="sm"
                  className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setClearAllOpen(true)}
                >
                  <Trash2 className="size-3.5" /> Clear All
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setSessionsModalOpen(false)}>Close</Button>
            </div>
          </div>

        </DialogContent>
      </Dialog>



      {/*  Add / Edit Session Dialog  */}
      <Dialog open={sessionDialogOpen} onOpenChange={v => { if (!v) setSessionDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingSession ? 'Edit Session' : 'Add Session'}</DialogTitle>
          <DialogDescription className="text-xs">Fill in the session details below.</DialogDescription>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sess-title">Title</Label>
              <Input id="sess-title" value={sessionForm.title}
                onChange={e => setSessionForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Session 1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sess-date">Date</Label>
              <Input id="sess-date" type="date" value={sessionForm.session_date}
                onChange={e => setSessionForm(p => ({ ...p, session_date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sess-start">Start Time</Label>
                <Input id="sess-start" type="time" value={sessionForm.start_time}
                  onChange={e => setSessionForm(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sess-end">End Time</Label>
                <Input id="sess-end" type="time" value={sessionForm.end_time}
                  onChange={e => setSessionForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {editingSession && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                  disabled={sessionFormLoading}
                  onClick={() => { setSessionDialogOpen(false); setSessionToDelete(editingSession); }}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSessionDialogOpen(false)} disabled={sessionFormLoading}>Cancel</Button>
              <Button size="sm" onClick={handleSaveSession} disabled={sessionFormLoading}>
                {sessionFormLoading ? 'Saving…' : editingSession ? 'Save Changes' : 'Add Session'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/*  Delete Session Confirmation  */}
      <Dialog open={!!sessionToDelete} onOpenChange={v => { if (!v) setSessionToDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Session?</DialogTitle>
          <DialogDescription className="text-xs">
            <strong>{sessionToDelete?.title}</strong> on {sessionToDelete?.session_date} will be permanently deleted.
            All attendance records for this session will also be removed.
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSessionToDelete(null)} disabled={deleteSessionLoading}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteSession} disabled={deleteSessionLoading}>
              {deleteSessionLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/*  Clear All Sessions Confirmation  */}
      <Dialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Clear All Sessions?</DialogTitle>
          <DialogDescription className="text-xs">
            This will permanently delete all {sessions.length} session{sessions.length !== 1 ? 's' : ''} and their attendance records. This action cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setClearAllOpen(false)} disabled={clearAllLoading}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleClearAllSessions} disabled={clearAllLoading}>
              {clearAllLoading ? 'Clearing...' : 'Clear All'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}