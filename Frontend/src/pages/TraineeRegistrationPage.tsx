import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import {
  User, Lock, MapPin, GraduationCap,
  BookOpen, CheckCircle2, ChevronRight, ChevronLeft,
  ArrowLeft, Calendar, Users, ShieldCheck
} from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import registrationService, { SubmitRegistrationData } from '../services/registrationService';
import programService from '../services/programService';

interface Program {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: string;
  max_trainees?: number;
}

const STEPS = [
  { id: 1, title: 'Account',    icon: Lock,         description: 'Set up your login credentials' },
  { id: 2, title: 'Personal',   icon: User,         description: 'Basic personal information' },
  { id: 3, title: 'Address',    icon: MapPin,       description: 'Your current address' },
  { id: 4, title: 'Background', icon: GraduationCap, description: 'Education & employment' },
  { id: 5, title: 'Program',    icon: BookOpen,     description: 'Choose your program' },
];

type FormData = SubmitRegistrationData & { confirm_password: string; phone: string };

const EMPTY_FORM: FormData = {
  username: '', email: '', password: '', confirm_password: '',
  first_name: '', last_name: '', middle_name: '', phone: '',
  sex: 'Male', birth_date: '', birth_place: '', civil_status: 'Single',
  province: '', municipality: '', barangay: '', street: '',
  educational_attainment: '', course: '', year_graduated: '', classification: '',
  disability: '', employment_status: '', program_id: '',
};

export default function TraineeRegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacyNoticeExpanded, setPrivacyNoticeExpanded] = useState(false);

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      const data = await programService.getPrograms({ status: 'active' });
      setPrograms(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch {
      toast.error('Failed to load programs');
    } finally {
      setLoadingPrograms(false);
    }
  };

  const set = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep = (s: number): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};

    if (s === 1) {
      if (!form.username.trim()) errs.username = 'Username is required';
      else if (form.username.length < 3) errs.username = 'Must be at least 3 characters';
      else if (!/^[a-zA-Z0-9_-]+$/.test(form.username)) errs.username = 'Letters, numbers, - and _ only';
      if (!form.email.trim()) errs.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
      if (!form.password) errs.password = 'Password is required';
      else if (form.password.length < 6) errs.password = 'At least 6 characters';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) errs.password = 'Needs uppercase, lowercase and number';
      if (!form.confirm_password) errs.confirm_password = 'Please confirm your password';
      else if (form.password !== form.confirm_password) errs.confirm_password = 'Passwords do not match';
    }

    if (s === 2) {
      if (!form.first_name.trim()) errs.first_name = 'First name is required';
      if (!form.last_name.trim()) errs.last_name = 'Last name is required';
      if (!form.phone.trim()) errs.phone = 'Phone number is required';
      else if (!/^[0-9+\-\s()]+$/.test(form.phone) || form.phone.trim().length < 10) errs.phone = 'Enter a valid phone number';
      if (!form.sex) errs.sex = 'Sex is required';
      if (!form.birth_date) errs.birth_date = 'Birth date is required';
      if (!form.birth_place.trim()) errs.birth_place = 'Birth place is required';
      if (!form.civil_status) errs.civil_status = 'Civil status is required';
    }

    if (s === 3) {
      if (!form.province.trim()) errs.province = 'Province is required';
      if (!form.municipality.trim()) errs.municipality = 'Municipality is required';
      if (!form.barangay.trim()) errs.barangay = 'Barangay is required';
      if (!form.street.trim()) errs.street = 'Street/sitio is required';
    }

    if (s === 4) {
      if (!form.educational_attainment) errs.educational_attainment = 'Required';
      if (!form.course.trim()) errs.course = 'Course/field of study is required';
      if (!form.year_graduated.trim()) errs.year_graduated = 'Year is required';
      else if (!/^\d{4}$/.test(form.year_graduated)) errs.year_graduated = 'Enter a valid 4-digit year';
      if (!form.classification) errs.classification = 'Classification is required';
      if (!form.employment_status) errs.employment_status = 'Employment status is required';
    }

    if (s === 5) {
      if (!form.program_id) errs.program_id = 'Please select a program';
      if (!privacyConsent) errs.program_id = errs.program_id || 'Please accept the Privacy Notice to continue';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (validateStep(step)) setStep(s => s + 1);
  };

  const back = () => {
    setErrors({});
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    setSubmitting(true);
    try {
      const { confirm_password, ...data } = form;
      await registrationService.submitRegistration({
        ...data,
        disability: data.disability?.trim() || null,
      });
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (field: keyof FormData) =>
    errors[field] ? 'border-destructive focus-visible:ring-destructive' : '';

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 px-8">
            <div className="flex justify-center mb-6">
              <div className="flex size-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="size-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Registration Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Your registration is now pending review by our staff. You will be able to log in once your account is approved.
            </p>
            <div className="rounded-lg bg-muted p-4 text-left text-sm space-y-1 mb-6">
              <p><span className="font-medium">Name:</span> {form.first_name} {form.last_name}</p>
              <p><span className="font-medium">Email:</span> {form.email}</p>
              <p><span className="font-medium">Username:</span> {form.username}</p>
              <p><span className="font-medium">Program:</span> {programs.find(p => p.id === form.program_id)?.name}</p>
            </div>
            <Button className="w-full" onClick={() => navigate('/login')}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col items-center justify-start p-4 pt-8 pb-12">
      {/* Header */}
      <div className="w-full max-w-2xl mb-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>
        <h1 className="text-3xl font-bold">Trainee Registration</h1>
        <p className="text-muted-foreground mt-1">
          Fill in your details to apply for enrollment. Your account will need staff approval before you can log in.
        </p>
      </div>

      {/* Step progress */}
      <div className="w-full max-w-2xl mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`flex size-9 items-center justify-center rounded-full border-2 transition-all ${
                    done ? 'bg-primary border-primary text-primary-foreground'
                    : active ? 'border-primary text-primary bg-primary/10'
                    : 'border-muted-foreground/30 text-muted-foreground/50'
                  }`}>
                    {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  <span className={`mt-1 text-[10px] font-medium hidden sm:block ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-all ${done ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Card */}
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="size-5 text-primary" />; })()}
            {STEPS[step - 1].title}
          </CardTitle>
          <CardDescription>{STEPS[step - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* STEP 1 – Account Credentials */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input id="username" value={form.username} onChange={e => set('username', e.target.value)}
                  placeholder="e.g. juan_dela_cruz" className={fieldClass('username')} />
                {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input id="email" type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="you@email.com" className={fieldClass('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input id="password" type="password" value={form.password} onChange={e => set('password', e.target.value)}
                    placeholder="••••••••" className={fieldClass('password')} />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm Password *</Label>
                  <Input id="confirm_password" type="password" value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)}
                    placeholder="••••••••" className={fieldClass('confirm_password')} />
                  {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password}</p>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters and include uppercase, lowercase, and a number.
              </p>
            </>
          )}

          {/* STEP 2 – Personal Info */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={form.first_name} onChange={e => set('first_name', e.target.value)}
                    placeholder="Juan" className={fieldClass('first_name')} />
                  {errors.first_name && <p className="text-xs text-destructive">{errors.first_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={form.last_name} onChange={e => set('last_name', e.target.value)}
                    placeholder="Dela Cruz" className={fieldClass('last_name')} />
                  {errors.last_name && <p className="text-xs text-destructive">{errors.last_name}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Middle Name</Label>
                <Input value={form.middle_name} onChange={e => set('middle_name', e.target.value)} placeholder="Santos" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="09XX-XXX-XXXX" className={fieldClass('phone')} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sex *</Label>
                  <Select value={form.sex} onValueChange={(v: string) => set('sex', v)}>
                    <SelectTrigger className={fieldClass('sex')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Civil Status *</Label>
                  <Select value={form.civil_status} onValueChange={(v: string) => set('civil_status', v)}>
                    <SelectTrigger className={fieldClass('civil_status')}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Single', 'Married', 'Widowed', 'Separated'].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Birth Date *</Label>
                  <Input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)}
                    className={fieldClass('birth_date')} />
                  {errors.birth_date && <p className="text-xs text-destructive">{errors.birth_date}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Birth Place *</Label>
                  <Input value={form.birth_place} onChange={e => set('birth_place', e.target.value)}
                    placeholder="City/Municipality" className={fieldClass('birth_place')} />
                  {errors.birth_place && <p className="text-xs text-destructive">{errors.birth_place}</p>}
                </div>
              </div>
            </>
          )}

          {/* STEP 3 – Address */}
          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Province *</Label>
                  <Input value={form.province} onChange={e => set('province', e.target.value)}
                    placeholder="e.g. Laguna" className={fieldClass('province')} />
                  {errors.province && <p className="text-xs text-destructive">{errors.province}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Municipality/City *</Label>
                  <Input value={form.municipality} onChange={e => set('municipality', e.target.value)}
                    placeholder="e.g. Calamba" className={fieldClass('municipality')} />
                  {errors.municipality && <p className="text-xs text-destructive">{errors.municipality}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Barangay *</Label>
                  <Input value={form.barangay} onChange={e => set('barangay', e.target.value)}
                    placeholder="e.g. Brgy. Uno" className={fieldClass('barangay')} />
                  {errors.barangay && <p className="text-xs text-destructive">{errors.barangay}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Street / Sitio / Purok *</Label>
                  <Input value={form.street} onChange={e => set('street', e.target.value)}
                    placeholder="House No. / Street Name" className={fieldClass('street')} />
                  {errors.street && <p className="text-xs text-destructive">{errors.street}</p>}
                </div>
              </div>
            </>
          )}

          {/* STEP 4 – Background */}
          {step === 4 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Educational Attainment *</Label>
                  <Select value={form.educational_attainment} onValueChange={(v: string) => set('educational_attainment', v)}>
                    <SelectTrigger className={fieldClass('educational_attainment')}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {['Elementary', 'High School', 'Senior High School', 'Vocational', 'College', 'Post Graduate'].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.educational_attainment && <p className="text-xs text-destructive">{errors.educational_attainment}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Year Graduated *</Label>
                  <Input value={form.year_graduated} onChange={e => set('year_graduated', e.target.value)}
                    placeholder="2024" maxLength={4} className={fieldClass('year_graduated')} />
                  {errors.year_graduated && <p className="text-xs text-destructive">{errors.year_graduated}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Course / Degree / Field of Study *</Label>
                <Input value={form.course} onChange={e => set('course', e.target.value)}
                  placeholder="e.g. BSIT, Senior High School - TVL" className={fieldClass('course')} />
                {errors.course && <p className="text-xs text-destructive">{errors.course}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Classification *</Label>
                  <Select value={form.classification} onValueChange={(v: string) => set('classification', v)}>
                    <SelectTrigger className={fieldClass('classification')}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {['Out-of-School Youth', 'Student', 'Unemployed', 'Underemployed', '4Ps Beneficiary'].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.classification && <p className="text-xs text-destructive">{errors.classification}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Employment Status *</Label>
                  <Select value={form.employment_status} onValueChange={(v: string) => set('employment_status', v)}>
                    <SelectTrigger className={fieldClass('employment_status')}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {['Employed', 'Unemployed', 'Self-employed', 'Student'].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.employment_status && <p className="text-xs text-destructive">{errors.employment_status}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Disability (if any)</Label>
                <Input value={form.disability || ''} onChange={e => set('disability', e.target.value)}
                  placeholder="Leave blank if none" />
              </div>
            </>
          )}

          {/* STEP 5 – Program Selection */}
          {step === 5 && (
            <>
              <p className="text-sm text-muted-foreground">Select the program you wish to enroll in:</p>
              {loadingPrograms ? (
                <div className="space-y-3 py-2">
                  <Skeleton className="h-28 w-full rounded-lg" />
                  <Skeleton className="h-28 w-full rounded-lg" />
                </div>
              ) : programs.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  <BookOpen className="mx-auto mb-2 size-8 opacity-40" />
                  <p>No active programs available at the moment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {programs.map(program => (
                    <button
                      key={program.id}
                      type="button"
                      onClick={() => set('program_id', program.id)}
                      className={`w-full rounded-lg border p-4 text-left transition-all ${
                        form.program_id === program.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold">{program.name}</p>
                          {program.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{program.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {new Date(program.start_date).toLocaleDateString()} – {new Date(program.end_date).toLocaleDateString()}
                            </span>
                            {program.max_trainees && (
                              <span className="flex items-center gap-1">
                                <Users className="size-3" />
                                Max {program.max_trainees} trainees
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          form.program_id === program.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                        }`}>
                          {form.program_id === program.id && <div className="size-2 rounded-full bg-white" />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {errors.program_id && <p className="text-xs text-destructive">{errors.program_id}</p>}

              <Separator />

              {/* Privacy Notice & Consent */}
              <div className="space-y-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
                  <button
                    type="button"
                    onClick={() => setPrivacyNoticeExpanded(prev => !prev)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-blue-800 dark:text-blue-300"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="size-4 shrink-0" />
                      Privacy Notice (RA 10173 — Data Privacy Act of 2012)
                    </span>
                    <span className="text-xs">{privacyNoticeExpanded ? '▲ Hide' : '▼ Read'}</span>
                  </button>
                  {privacyNoticeExpanded && (
                    <div className="border-t border-blue-200 dark:border-blue-800 px-4 py-3 text-xs text-blue-700 dark:text-blue-400 space-y-2">
                      <p>
                        Your personal information will be collected and processed for training program
                        management purposes in compliance with Republic Act No. 10173 (Data Privacy Act of 2012).
                      </p>
                      <p>
                        <strong>Data collected:</strong> Personal details (name, birthdate, address, contact
                        information), educational background, employment status, and training records.
                      </p>
                      <p>
                        <strong>Purpose:</strong> Enrollment management, attendance tracking, certificate
                        issuance, and program reporting.
                      </p>
                      <p>
                        <strong>Retention:</strong> Your data will be retained for 5 years after program
                        completion, after which it will be securely disposed of or anonymized.
                      </p>
                      <p>
                        <strong>Your rights:</strong> You have the right to access, correct, and request
                        deletion of your personal data. Contact the Data Protection Officer for inquiries.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="reg-privacy-consent"
                    checked={privacyConsent}
                    onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="reg-privacy-consent"
                    className="text-sm leading-snug cursor-pointer"
                  >
                    I have read and agree to the Privacy Notice and consent to the collection and
                    processing of my personal data in accordance with RA 10173. *
                  </label>
                </div>
                {!privacyConsent && errors.program_id?.includes('Privacy Notice') && (
                  <p className="text-xs text-destructive">Please accept the Privacy Notice to continue</p>
                )}
              </div>

              {/* Summary preview */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-1 text-sm">
                <p className="font-medium text-muted-foreground mb-2">Registration Summary</p>
                <p><span className="text-muted-foreground">Name:</span> {form.first_name} {form.middle_name ? form.middle_name[0] + '. ' : ''}{form.last_name}</p>
                <p><span className="text-muted-foreground">Email:</span> {form.email}</p>
                <p><span className="text-muted-foreground">Username:</span> {form.username}</p>
                <p><span className="text-muted-foreground">Program:</span> {programs.find(p => p.id === form.program_id)?.name || '–'}</p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                Your registration will be reviewed by staff before your account is activated.
              </div>
            </>
          )}
        </CardContent>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 pb-6 pt-2">
          <div>
            {step > 1 ? (
              <Button variant="outline" onClick={back} disabled={submitting}>
                <ChevronLeft className="mr-1 size-4" /> Back
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <Link to="/login">Already have an account?</Link>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Step {step} of {STEPS.length}</span>
            {step < STEPS.length ? (
              <Button onClick={next}>
                Next <ChevronRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20 bg-white/35" />
                    <span className="sr-only">Submitting...</span>
                  </span>
                ) : (
                  <>Submit Registration <CheckCircle2 className="ml-2 size-4" /></>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
