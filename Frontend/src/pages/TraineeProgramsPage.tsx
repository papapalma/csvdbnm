import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  GraduationCap,
  Calendar,
  Clock,
  Users,
  Search,
  BookOpen,
  CheckCircle2,
  User,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import programService from '../services/programService';
import registrationService from '../services/registrationService';
import api from '../services/api';
import logger from '../utils/logger';

interface Program {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  instructor?: string | null;
  duration_weeks?: number;
  max_trainees?: number;
}

export default function TraineeProgramsPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const response = await programService.getPrograms({ status: 'active' });
      setPrograms(response.data || []);
    } catch (error) {
      logger.error('Failed to fetch programs', { error });
      toast.error('Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedProgram) return;
    setApplying(true);
    try {
      // Fetch the trainee's own profile to get their existing details
      const profileRes = await api.get('/trainees/me');
      const trainee = profileRes.data as any;

      if (!trainee) {
        toast.error('Could not load your trainee profile. Please contact staff.');
        return;
      }

      // Submit a pending registration (application) to the chosen program
      // using the trainee's existing profile data
      await registrationService.submitRegistration({
        username:               trainee.qr_code || `trainee_${trainee.id.slice(0, 8)}`,
        email:                  trainee.email,
        password:               '',          // empty — trainee already has an account
        first_name:             trainee.first_name,
        last_name:              trainee.last_name,
        middle_name:            trainee.middle_name || '',
        phone:                  trainee.phone,
        sex:                    trainee.sex,
        birth_date:             trainee.birth_date,
        birth_place:            trainee.birth_place,
        civil_status:           trainee.civil_status,
        province:               trainee.province,
        municipality:           trainee.municipality,
        barangay:               trainee.barangay,
        street:                 trainee.street,
        educational_attainment: trainee.educational_attainment,
        course:                 trainee.course || '',
        year_graduated:         trainee.year_graduated || '',
        classification:         trainee.classification || '',
        disability:             trainee.disability || null,
        employment_status:      trainee.employment_status,
        program_id:             selectedProgram.id,
      });

      toast.success('Application submitted!', {
        description: `Your application for "${selectedProgram.name}" has been submitted for staff review.`,
      });
      setApplyDialogOpen(false);
      setSelectedProgram(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit application');
    } finally {
      setApplying(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredPrograms = programs.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout title="Available Programs">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="flex items-center gap-2">
            <GraduationCap className="size-6" />
            Available Programs
            {user?.tenantName && (
              <Badge variant="outline" className="text-xs font-normal">
                <Building2 className="mr-1 size-3" />
                {user.tenantName}
              </Badge>
            )}
          </h2>
          <p className="text-muted-foreground">
            Browse and apply for training programs offered by {user?.tenantName || 'your organization'}
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Programs Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-9 w-full mt-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPrograms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="mb-4 size-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No programs match your search' : 'No active programs available'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPrograms.map((program) => (
              <Card key={program.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <GraduationCap className="size-5 text-primary" />
                    </div>
                    <Badge variant={program.status === 'active' ? 'default' : 'secondary'}>
                      {program.status}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2 text-base leading-snug">{program.name}</CardTitle>
                  {program.description && (
                    <CardDescription className="line-clamp-2">{program.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col flex-1 gap-3">
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 shrink-0" />
                      <span>{formatDate(program.start_date)} – {formatDate(program.end_date)}</span>
                    </div>
                    {program.duration_weeks && (
                      <div className="flex items-center gap-2">
                        <Clock className="size-3.5 shrink-0" />
                        <span>{program.duration_weeks} week{program.duration_weeks !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {program.instructor && (
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 shrink-0" />
                        <span>{program.instructor}</span>
                      </div>
                    )}
                    {program.max_trainees && (
                      <div className="flex items-center gap-2">
                        <Users className="size-3.5 shrink-0" />
                        <span>Max {program.max_trainees} trainees</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-auto pt-2">
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => {
                        setSelectedProgram(program);
                        setApplyDialogOpen(true);
                      }}
                    >
                      Apply Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Application Confirmation Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="size-5" />
              Apply for Program
            </DialogTitle>
            <DialogDescription>
              You are applying for the following program. Your application will be reviewed by staff.
            </DialogDescription>
          </DialogHeader>
          {selectedProgram && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
              <p className="font-semibold text-base">{selectedProgram.name}</p>
              {selectedProgram.description && (
                <p className="text-muted-foreground">{selectedProgram.description}</p>
              )}
              <div className="flex items-center gap-2 text-muted-foreground pt-1">
                <Calendar className="size-3.5" />
                <span>{formatDate(selectedProgram.start_date)} – {formatDate(selectedProgram.end_date)}</span>
              </div>
              {selectedProgram.instructor && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="size-3.5" />
                  <span>Instructor: {selectedProgram.instructor}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            <span>Your application will be reviewed by staff before enrollment is confirmed.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)} disabled={applying}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? 'Submitting...' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
