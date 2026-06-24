import { useState, useEffect, useRef, DragEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Checkbox } from '../components/ui/checkbox';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Save, X, Plus, Trash2, AlertCircle, Upload, Image as ImageIcon, Award, Building2, ShieldCheck } from 'lucide-react';
import traineeService from '../services/traineeService';
import programService from '../services/programService';
import api, { API_BASE_URL, getFileUrl } from '../services/api';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';
import CertificateUploadModal from '../components/CertificateUploadModal';
import CertificateViewer from '../components/CertificateViewer';
import certificateService, { Certificate } from '../services/certificateService';

const steps = [
  { id: 1, name: 'Personal Info', description: 'Basic information' },
  { id: 2, name: 'Address', description: 'Contact details' },
  { id: 3, name: 'Education', description: 'Educational background' },
  { id: 4, name: 'Classification', description: 'Program & status' },
  { id: 5, name: 'Trainings', description: 'Training programs' },
  { id: 6, name: 'Photo', description: 'Upload photo' },
];

interface Training {
  program: string;
  status: string;
  dateEnrolled: string;
  dateCompleted: string;
}

export default function TraineeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Admins can edit email on existing trainees; staff can only set it on creation
  const canEditEmail = !id || user?.role === 'super_admin' || user?.role === 'local_admin';
  const [currentStep, setCurrentStep] = useState(1);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<{
    lastName: string;
    firstName: string;
    middleName: string;
    sex: string;
    birthdate: string;
    birthplace: string;
    civilStatus: string;
    province: string;
    municipality: string;
    barangay: string;
    street: string;
    contactNumber: string;
    email: string;
    educationalAttainment: string;
    course: string;
    yearGraduated: string;
    classification: string;
    disability: string;
    employmentStatus: string;
    photo: File | null;
  }>({
    // Personal Info
    lastName: '',
    firstName: '',
    middleName: '',
    sex: '',
    birthdate: '',
    birthplace: '',
    civilStatus: '',
    
    // Address
    province: 'Oriental Mindoro',
    municipality: '',
    barangay: '',
    street: '',
    contactNumber: '',
    email: '',
    
    // Education
    educationalAttainment: '',
    course: '',
    yearGraduated: '',
    
    // Classification
    classification: '',
    disability: '',
    employmentStatus: '',
    
    // Photo
    photo: null,
  });

  const [trainings, setTrainings] = useState<Training[]>([
    { program: '', status: 'active', dateEnrolled: '', dateCompleted: '' }
  ]);

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [uploadCertModalOpen, setUploadCertModalOpen] = useState(false);

  // Privacy consent (required for new trainees only)
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacyNoticeExpanded, setPrivacyNoticeExpanded] = useState(false);

  const traineeName = formData.firstName && formData.lastName
    ? `${formData.firstName} ${formData.lastName}`
    : 'Trainee';

  // Helper function to get full photo URL — routes tenant-scoped paths through /api/files/
  const getPhotoUrl = (photoPath: string | null | undefined): string | undefined => {
    if (!photoPath) return undefined;
    return getFileUrl(photoPath) || undefined;
  };

  // Migration function to convert old lowercase values to new capitalized ones
  const migrateFormValues = (data: any) => {
    const educationalMap: { [key: string]: string } = {
      'elementary': 'Elementary',
      'high school': 'High School',
      'highschool': 'High School',
      'senior high school': 'Senior High School',
      'senior-high': 'Senior High School',
      'vocational': 'Vocational',
      'college': 'College',
      'post graduate': 'Post Graduate',
      'post-graduate': 'Post Graduate'
    };
    
    const classificationMap: { [key: string]: string } = {
      'osy': 'Out-of-School Youth',
      'student': 'Student', 
      'unemployed': 'Unemployed',
      'underemployed': 'Underemployed',
      '4ps': '4Ps Beneficiary'
    };
    
    const employmentMap: { [key: string]: string } = {
      'employed': 'Employed',
      'unemployed': 'Unemployed',
      'self-employed': 'Self-employed',
      'student': 'Student'
    };
    
    // Migrate educational attainment
    if (data.educationalAttainment && educationalMap[data.educationalAttainment.toLowerCase()]) {
      data.educationalAttainment = educationalMap[data.educationalAttainment.toLowerCase()];
    }
    
    // Migrate classification  
    if (data.classification && classificationMap[data.classification.toLowerCase()]) {
      data.classification = classificationMap[data.classification.toLowerCase()];
    }
    
    // Migrate employment status
    if (data.employmentStatus && employmentMap[data.employmentStatus.toLowerCase()]) {
      data.employmentStatus = employmentMap[data.employmentStatus.toLowerCase()];
    }
    
    return data;
  };

  // Fetch programs on mount
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const response = await programService.getPrograms();
        setPrograms(response.data || []);
      } catch (error) {
        logger.error('Failed to fetch programs', { error });
        toast.error('Failed to load programs');
      }
    };
    fetchPrograms();
  }, []);

  // Load certificates when editing an existing trainee
  useEffect(() => {
    if (id) loadCertificates();
  }, [id]);

  const loadCertificates = async () => {
    if (!id) return;
    try {
      setLoadingCertificates(true);
      const response = await certificateService.getCertificates(id);
      setCertificates(response.certificates);
    } catch (error) {
      logger.error('Failed to load certificates', { error });
    } finally {
      setLoadingCertificates(false);
    }
  };

  const handleDeleteCertificate = async (certificateId: string) => {
    if (!id) return;
    try {
      await certificateService.deleteCertificate(id, certificateId);
      toast.success('Certificate deleted');
      loadCertificates();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete certificate');
    }
  };

  // Helper function to get program name by ID
  const getProgramNameById = (programId: string) => {
    const program = programs.find(p => p.id === programId);
    return program ? program.name : programId;
  };

  // Migrate form data on mount to fix old lowercase values
  useEffect(() => {
    setFormData(prev => migrateFormValues({ ...prev }));
  }, []);

  // Load trainee data when editing
  useEffect(() => {
    if (id) {
      const loadTrainee = async () => {
        try {
          setLoading(true);
          const response = await traineeService.getTraineeById(id);
          
          // The response might be wrapped in a data property or direct
          const trainee = response;
          
          // Populate form with trainee data
          const rawFormData = {
            firstName: trainee.first_name || '',
            lastName: trainee.last_name || '',
            middleName: trainee.middle_name || '',
            sex: trainee.sex || '',
            birthdate: trainee.birth_date || '',
            birthplace: trainee.birth_place || '',
            civilStatus: trainee.civil_status || '',
            province: trainee.province || 'Oriental Mindoro',
            municipality: trainee.municipality || '',
            barangay: trainee.barangay || '',
            street: trainee.street || '',
            contactNumber: trainee.phone || '',
            email: trainee.email || '',
            educationalAttainment: trainee.educational_attainment || '',
            course: trainee.course || '',
            yearGraduated: trainee.year_graduated ? trainee.year_graduated.toString() : '',
            classification: trainee.classification || '',
            disability: trainee.disability || '',
            employmentStatus: trainee.employment_status || '',
            photo: null,
          };
          
          // Migrate old values to new ones
          setFormData(migrateFormValues(rawFormData));

          // Set photo preview if exists
          if (trainee.photo_path) {
            setPhotoPreview(getPhotoUrl(trainee.photo_path) || trainee.photo_path);
          }

          // Set trainings if program exists
          if (trainee.program_id) {
            setTrainings([{
              program: trainee.program_id,
              status: trainee.status || 'active',
              dateEnrolled: trainee.enrollment_date ? new Date(trainee.enrollment_date).toISOString().split('T')[0] : '',
              dateCompleted: ''
            }]);
          }

          toast.success('Trainee data loaded successfully');
        } catch (error: any) {
          logger.error('Failed to load trainee', { traineeId: id, error });
          toast.error(error.message || 'Failed to load trainee data');
          navigate('/trainees');
        } finally {
          setLoading(false);
        }
      };
      loadTrainee();
    }
  }, [id, navigate]);

  const handleInputChange = (field: string, value: string) => {
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Special handling for contact number - strip non-digits and convert +63 to 09
    if (field === 'contactNumber') {
      // Remove all non-digit characters
      let cleaned = value.replace(/\D/g, '');
      
      // If starts with 63, replace with 09
      if (cleaned.startsWith('63')) {
        cleaned = '09' + cleaned.slice(2);
      }
      
      // Limit to 11 digits
      cleaned = cleaned.slice(0, 11);
      
      setFormData(prev => ({ ...prev, [field]: cleaned }));
      return;
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Validation function for each step
  const getStepErrors = (step: number): Record<string, string> => {
    const errors: Record<string, string> = {};

    switch (step) {
      case 1: // Personal Info
        if (!formData.firstName.trim()) {
          errors.firstName = 'First name is required';
        } else if (formData.firstName.length < 2 || formData.firstName.length > 100) {
          errors.firstName = 'First name must be 2-100 characters';
        } else if (!/^[a-zA-Z\s.\-']+$/.test(formData.firstName)) {
          errors.firstName = 'First name can only contain letters, spaces, and basic punctuation';
        }

        if (!formData.lastName.trim()) {
          errors.lastName = 'Last name is required';
        } else if (formData.lastName.length < 2 || formData.lastName.length > 100) {
          errors.lastName = 'Last name must be 2-100 characters';
        } else if (!/^[a-zA-Z\s.\-']+$/.test(formData.lastName)) {
          errors.lastName = 'Last name can only contain letters, spaces, and basic punctuation';
        }

        if (!formData.middleName.trim()) {
          errors.middleName = 'Middle name is required';
        } else if (formData.middleName.length > 100) {
          errors.middleName = 'Middle name must not exceed 100 characters';
        }

        if (!formData.sex) {
          errors.sex = 'Sex is required';
        }

        if (!formData.birthdate) {
          errors.birthdate = 'Birthdate is required';
        } else {
          const birthDate = new Date(formData.birthdate);
          const age = Math.floor((new Date().getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (age < 15 || age > 70) {
            errors.birthdate = 'Age must be between 15 and 70 years';
          }
        }

        if (!formData.birthplace.trim()) {
          errors.birthplace = 'Birthplace is required';
        }

        if (!formData.civilStatus) {
          errors.civilStatus = 'Civil status is required';
        }

        // Privacy consent required for new trainees
        if (!id && !privacyConsent) {
          errors.privacyConsent = 'You must read and accept the Privacy Notice to continue';
        }
        break;

      case 2: // Address
        if (!formData.province.trim()) {
          errors.province = 'Province is required';
        }

        if (!formData.municipality.trim()) {
          errors.municipality = 'Municipality is required';
        }

        if (!formData.barangay.trim()) {
          errors.barangay = 'Barangay is required';
        }

        if (!formData.street.trim()) {
          errors.street = 'Street is required';
        }

        if (!formData.contactNumber.trim()) {
          errors.contactNumber = 'Contact number is required';
        } else if (!/^09\d{9}$/.test(formData.contactNumber.replace(/[\s\-]/g, ''))) {
          errors.contactNumber = 'Contact number must be in format 09XXXXXXXXX (11 digits)';
        }

        if (!formData.email.trim()) {
          errors.email = 'Email is required';
        } else if (formData.email.length > 255) {
          errors.email = 'Email must not exceed 255 characters';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          errors.email = 'Invalid email address';
        }
        break;

      case 3: // Education
        const validEducationalLevels = ['Elementary', 'High School', 'Senior High School', 'Vocational', 'College', 'Post Graduate'];
        if (!formData.educationalAttainment || formData.educationalAttainment === '' || !validEducationalLevels.includes(formData.educationalAttainment)) {
          errors.educationalAttainment = 'Educational attainment is required';
        }

        if (!formData.course || !formData.course.trim()) {
          errors.course = 'Course is required';
        } else if (formData.course.length > 255) {
          errors.course = 'Course must not exceed 255 characters';
        }

        if (!formData.yearGraduated || formData.yearGraduated === '') {
          errors.yearGraduated = 'Year graduated is required';
        } else if (!/^\d{4}$/.test(formData.yearGraduated)) {
          errors.yearGraduated = 'Year must be 4 digits';
        } else {
          const year = parseInt(formData.yearGraduated);
          const currentYear = new Date().getFullYear();
          if (year < 1950 || year > currentYear) {
            errors.yearGraduated = `Year must be between 1950 and ${currentYear}`;
          }
        }
        
        break;

      case 4: // Classification
        const validClassifications = ['Out-of-School Youth', 'Student', 'Unemployed', 'Underemployed', '4Ps Beneficiary'];
        if (!formData.classification || formData.classification === '' || !validClassifications.includes(formData.classification)) {
          errors.classification = 'Client classification is required';
        }

        const validEmploymentStatuses = ['Employed', 'Unemployed', 'Self-employed', 'Student'];
        if (!formData.employmentStatus || formData.employmentStatus === '' || !validEmploymentStatuses.includes(formData.employmentStatus)) {
          errors.employmentStatus = 'Employment status is required';
        }
        break;

      case 5: // Trainings
        if (!trainings[0].program || trainings[0].program === '') {
          errors.program = 'At least one training program is required';
        }
        if (!trainings[0].dateEnrolled || trainings[0].dateEnrolled === '') {
          errors.dateEnrolled = 'Enrollment date is required';
        }
        break;

      case 6: // Photo
        // Photo is optional, but we can add a warning if not uploaded
        // Uncomment if you want to make photo mandatory:
        // if (!formData.photo && !photoPreview) {
        //   errors.photo = 'Please upload a trainee photo';
        // }
        break;
    }

    return errors;
  };

  const handleTrainingChange = (index: number, field: keyof Training, value: string) => {
    const newTrainings = [...trainings];
    newTrainings[index] = { ...newTrainings[index], [field]: value };
    setTrainings(newTrainings);
  };

  const addTraining = () => {
    setTrainings([...trainings, { program: '', status: 'active', dateEnrolled: '', dateCompleted: '' }]);
  };

  const removeTraining = () => {
    if (trainings.length > 1) {
      setTrainings(trainings.filter((_, i) => i !== trainings.length - 1));
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPhotoFile(file);
  };

  const handlePhotoDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingPhoto(true);
  };
  const handlePhotoDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingPhoto(false);
  };
  const handlePhotoDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
  };
  const handlePhotoDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingPhoto(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processPhotoFile(file);
  };

  const processPhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    setFormData(prev => ({ ...prev, photo: file }));
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Helper function to upload photo
  const uploadPhoto = async (photoFile: File): Promise<string | null> => {
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(photoFile);
      });

      const base64File = await base64Promise;

      // Upload to tenant-scoped endpoint
      const response: any = await api.post('/upload/tenant', {
        file: base64File,
        category: 'images/trainees',
        filename: photoFile.name,
        prefix: `trainee_${formData.firstName}_${formData.lastName}`
      });

      if (response.success && response.data?.filePath) {
        return response.data.filePath;
      }

      throw new Error('Upload failed: No file path returned');
    } catch (error: any) {
      logger.error('Photo upload failed', { error });
      toast.error('Failed to upload photo', {
        description: error.message || 'Please try again'
      });
      return null;
    }
  };

  const handleSubmit = async () => {
    // Validate all steps before submitting
    const allErrors: Record<string, string> = {};
    for (let step = 1; step <= steps.length; step++) {
      const stepErrors = getStepErrors(step);
      Object.assign(allErrors, stepErrors);
    }
    
    if (Object.keys(allErrors).length > 0) {
      logger.warn('Trainee form validation failed', {
        errorCount: Object.keys(allErrors).length,
        fields: Object.keys(allErrors),
      });
      setValidationErrors(allErrors);
      
      // Find first step with errors
      for (let step = 1; step <= steps.length; step++) {
        if (Object.keys(getStepErrors(step)).length > 0) {
          setCurrentStep(step);
          break;
        }
      }
      
      toast.error('Validation Failed', {
        description: 'Please fill in all required fields correctly.'
      });
      setLoading(false);
      return;
    }

    // Validate privacy consent for new trainees
    if (!id && !privacyConsent) {
      toast.error('Please read and accept the Privacy Notice to continue');
      setCurrentStep(1);
      return;
    }
    
    setLoading(true);
    try {
      // Upload photo first if there's a new photo
      let photoPath: string | null = null;
      if (formData.photo) {
        photoPath = await uploadPhoto(formData.photo);
        if (!photoPath) {
          // Photo upload failed, but continue without photo
          logger.warn('Continuing without photo after upload failure');
        }
      }

      // Prepare data for backend (match the backend schema)
      const traineeData: any = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        middle_name: formData.middleName.trim(),
        phone: formData.contactNumber.trim(),
        sex: formData.sex,
        birth_date: formData.birthdate,
        birth_place: formData.birthplace.trim(),
        civil_status: formData.civilStatus,
        province: formData.province.trim(),
        municipality: formData.municipality.trim(),
        barangay: formData.barangay.trim(),
        street: formData.street.trim(),
        educational_attainment: formData.educationalAttainment,
        course: formData.course.trim(),
        year_graduated: formData.yearGraduated,
        classification: formData.classification,
        disability: formData.disability && formData.disability.trim() ? formData.disability : null,
        employment_status: formData.employmentStatus,
        program_id: trainings[0].program,
        enrollment_date: trainings[0].dateEnrolled ? new Date(trainings[0].dateEnrolled).toISOString() : new Date().toISOString(),
        // Only include photo_path when a new photo was actually uploaded.
        // Omitting the key entirely on updates prevents overwriting the existing
        // path with null (Supabase treats an explicit null as an intentional write).
        ...(photoPath !== null ? { photo_path: photoPath } : {}),
      };

      if (canEditEmail) {
        traineeData.email = formData.email.trim().toLowerCase();
      }
      logger.debug('Submitting trainee form', { isEdit: !!id, hasPhoto: !!photoPath });

      let savedTrainee;
      if (id) {
        // Update existing trainee
        savedTrainee = await traineeService.updateTrainee(id, traineeData);
        toast.success('✅ Trainee updated successfully!');
      } else {
        // Create new trainee
        savedTrainee = await traineeService.createTrainee(traineeData);
        toast.success('✅ Trainee registered successfully!');
      }
      
      if (!savedTrainee || !savedTrainee.id) {
        throw new Error('Failed to get trainee ID from server response');
      }
      
      // Verify the trainee was saved to database
      setIsVerifying(true);
      try {
        const verifiedTrainee = await traineeService.getTraineeById(savedTrainee.id);
        
        if (verifiedTrainee && verifiedTrainee.id === savedTrainee.id) {
          toast.success('✓ Database verification passed', {
            description: `Trainee ${formData.firstName} ${formData.lastName} has been successfully ${id ? 'updated in' : 'saved to'} the database.`,
            duration: 4000
          });
          
          logger.debug('Database verification passed', {
            traineeId: savedTrainee.id,
            action: id ? 'UPDATE' : 'CREATE',
          });
        } else {
          toast.warning('⚠ Verification incomplete', {
            description: `Trainee was ${id ? 'updated' : 'created'} but could not be verified. Please check the trainee list.`
          });
        }
      } catch (verifyError) {
        logger.error('Database verification error', { verifyError });
        toast.warning('⚠ Could not verify database save', {
          description: `Trainee appears to be ${id ? 'updated' : 'created'}, but verification failed. Please check the trainee list.`
        });
      } finally {
        setIsVerifying(false);
      }
      
      // Navigate back to trainee list
      setTimeout(() => {
        navigate('/trainees');
      }, 2000);
    } catch (error: any) {
      logger.error('Failed to save trainee', {
        action: id ? 'update' : 'create',
        status: error?.response?.status,
        message: error?.message,
        responseMessage: error?.response?.data?.message,
      });
      const errorMessage = error.response?.data?.message || error.message || `Failed to ${id ? 'update' : 'register'} trainee`;
      
      // Check for specific validation errors from backend
      if (errorMessage.includes('email already exists')) {
        setValidationErrors({ email: 'This email is already registered' });
        setCurrentStep(2); // Go back to address step where email is
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    // Validate current step before proceeding
    const errors = getStepErrors(currentStep);
    const isValid = Object.keys(errors).length === 0;
    
    // Update validation errors state for UI display
    setValidationErrors(errors);
    
    if (!isValid) {
      // Scroll to top to show error alert
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      toast.error('Please fill in all required fields', {
        description: 'Check the form for any missing or invalid information.'
      });
      return;
    }
    if (currentStep < steps.length) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return (
    <DashboardLayout title={id ? 'Edit Trainee' : 'New Trainee'}>
      {loading && id ? (
        <div className="min-h-[400px] space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Progress Steps - Desktop */}
        <Card className="hidden lg:block">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`flex size-10 items-center justify-center rounded-full border-2 ${
                        currentStep === step.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : currentStep > step.id
                          ? 'border-secondary bg-secondary text-secondary-foreground'
                          : 'border-muted-foreground text-muted-foreground'
                      }`}
                    >
                      {step.id}
                    </div>
                    <div className="text-center">
                      <p className="text-sm">{step.name}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 ${currentStep > step.id ? 'bg-secondary' : 'bg-muted'}`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Progress Steps - Mobile */}
        <div className="lg:hidden">
          <div className="mb-4 text-center">
            <p className="text-muted-foreground">
              Step {currentStep} of {steps.length}
            </p>
            <h3>{steps[currentStep - 1].name}</h3>
            <p className="text-sm text-muted-foreground">{steps[currentStep - 1].description}</p>
          </div>
          <div className="flex gap-1">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`h-1 flex-1 rounded-full ${
                  currentStep >= step.id ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form Content */}
        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep - 1].name}</CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Validation Errors Alert */}
            {Object.keys(validationErrors).length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Please fix the following errors:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {Object.entries(validationErrors).map(([field, error]) => (
                      <li key={field} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Step 1: Personal Info */}
            {currentStep === 1 && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Organization context (read-only) — spans full width */}
                {user?.tenantName && (
                  <div className="md:col-span-2 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                    <Building2 className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Organization:</span>
                    <span className="font-medium">{user.tenantName}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Dela Cruz"
                    required
                    className={validationErrors.lastName ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {validationErrors.lastName && (
                    <p className="text-sm text-red-500">{validationErrors.lastName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="Juan"
                    className={validationErrors.firstName ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    required
                  />
                  {validationErrors.firstName && (
                    <p className="text-sm text-red-500">{validationErrors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={formData.middleName}
                    onChange={(e) => handleInputChange('middleName', e.target.value)}
                    placeholder="Santos"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sex">Sex *</Label>
                  <Select value={formData.sex || undefined} onValueChange={(value: string) => handleInputChange('sex', value)}>
                    <SelectTrigger className={validationErrors.sex ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  {validationErrors.sex && (
                    <p className="text-sm text-red-500">{validationErrors.sex}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthdate">Birthdate *</Label>
                  <Input
                    id="birthdate"
                    type="date"
                    value={formData.birthdate}
                    onChange={(e) => handleInputChange('birthdate', e.target.value)}
                    required
                    max={new Date().toISOString().split('T')[0]}
                    className={validationErrors.birthdate ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {validationErrors.birthdate && (
                    <p className="text-sm text-red-500">{validationErrors.birthdate}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthplace">Birthplace *</Label>
                  <Input
                    id="birthplace"
                    value={formData.birthplace}
                    onChange={(e) => handleInputChange('birthplace', e.target.value)}
                    placeholder="Bongabong, Oriental Mindoro"
                    required
                    className={validationErrors.birthplace ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {validationErrors.birthplace && (
                    <p className="text-sm text-red-500">{validationErrors.birthplace}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="civilStatus">Civil Status *</Label>
                  <Select value={formData.civilStatus || undefined} onValueChange={(value: string) => handleInputChange('civilStatus', value)}>
                    <SelectTrigger className={validationErrors.civilStatus ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                      <SelectItem value="Separated">Separated</SelectItem>
                    </SelectContent>
                  </Select>
                  {validationErrors.civilStatus && (
                    <p className="text-sm text-red-500">{validationErrors.civilStatus}</p>
                  )}
                </div>

                {/* Privacy Notice & Consent — new trainees only */}
                {!id && (
                  <div className="md:col-span-2 space-y-3 pt-2">
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
                            Your personal information will be collected and processed by{' '}
                            <strong>{user?.tenantName || 'this organization'}</strong> for training program
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
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="privacy-consent"
                          checked={privacyConsent}
                          onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor="privacy-consent"
                          className="text-sm leading-snug cursor-pointer"
                        >
                          I have read and agree to the Privacy Notice and consent to the collection and
                          processing of my personal data by{' '}
                          <strong>{user?.tenantName || 'this organization'}</strong> in accordance with
                          RA 10173.
                        </label>
                      </div>
                      {validationErrors.privacyConsent && (
                        <p className="text-sm text-red-500">{validationErrors.privacyConsent}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Address */}
            {currentStep === 2 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="province">Province *</Label>
                  <Input
                    id="province"
                    value={formData.province}
                    onChange={(e) => handleInputChange('province', e.target.value)}
                    required
                    className={validationErrors.province ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {validationErrors.province && (
                    <p className="text-sm text-red-500">{validationErrors.province}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="municipality">Municipality *</Label>
                  <Input
                    id="municipality"
                    value={formData.municipality}
                    onChange={(e) => handleInputChange('municipality', e.target.value)}
                    placeholder="Bongabong"
                    required
                    className={validationErrors.municipality ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {validationErrors.municipality && (
                    <p className="text-sm text-red-500">{validationErrors.municipality}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barangay">Barangay *</Label>
                  <Input
                    id="barangay"
                    value={formData.barangay}
                    onChange={(e) => handleInputChange('barangay', e.target.value)}
                    placeholder="Enter barangay"
                    required
                    className={validationErrors.barangay ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {validationErrors.barangay && (
                    <p className="text-sm text-red-500">{validationErrors.barangay}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street">Street/Purok</Label>
                  <Input
                    id="street"
                    value={formData.street}
                    onChange={(e) => handleInputChange('street', e.target.value)}
                    placeholder="Enter street"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number *</Label>
                  <Input
                    id="contactNumber"
                    type="tel"
                    value={formData.contactNumber}
                    onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                    placeholder="09123456789"
                    required
                    className={validationErrors.contactNumber ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {validationErrors.contactNumber && (
                    <p className="text-sm text-red-500">{validationErrors.contactNumber}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Format: 09XXXXXXXXX (11 digits)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="juan@example.com"
                    disabled={!canEditEmail}
                    className={validationErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {validationErrors.email && (
                    <p className="text-sm text-red-500">{validationErrors.email}</p>
                  )}
                  {!canEditEmail && id && (
                    <p className="text-xs text-muted-foreground">Only admin can change trainee email.</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Education */}
            {currentStep === 3 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="educationalAttainment">Educational Attainment *</Label>
                  <Select value={formData.educationalAttainment || undefined} onValueChange={(value: string) => handleInputChange('educationalAttainment', value)}>
                    <SelectTrigger className={validationErrors.educationalAttainment ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Elementary">Elementary</SelectItem>
                      <SelectItem value="High School">High School</SelectItem>
                      <SelectItem value="Senior High School">Senior High School</SelectItem>
                      <SelectItem value="Vocational">Vocational</SelectItem>
                      <SelectItem value="College">College</SelectItem>
                      <SelectItem value="Post Graduate">Post Graduate</SelectItem>
                    </SelectContent>
                  </Select>
                  {validationErrors.educationalAttainment && (
                    <p className="text-sm text-red-500">{validationErrors.educationalAttainment}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course">Course/Strand *</Label>
                  <Input
                    id="course"
                    value={formData.course}
                    onChange={(e) => handleInputChange('course', e.target.value)}
                    placeholder="e.g., STEM, HUMSS, ICT"
                    required
                    className={validationErrors.course ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {validationErrors.course && (
                    <p className="text-sm text-red-500">{validationErrors.course}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearGraduated">Year Graduated *</Label>
                  <Input
                    id="yearGraduated"
                    type="number"
                    value={formData.yearGraduated}
                    onChange={(e) => handleInputChange('yearGraduated', e.target.value)}
                    placeholder="2024"
                    min="1950"
                    max={new Date().getFullYear()}
                    required
                    className={validationErrors.yearGraduated ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {validationErrors.yearGraduated && (
                    <p className="text-sm text-red-500">{validationErrors.yearGraduated}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Classification */}
            {currentStep === 4 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="classification">Client Classification *</Label>
                  <Select value={formData.classification || undefined} onValueChange={(value: string) => handleInputChange('classification', value)}>
                    <SelectTrigger className={validationErrors.classification ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select classification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Out-of-School Youth">Out-of-School Youth</SelectItem>
                      <SelectItem value="Student">Student</SelectItem>
                      <SelectItem value="Unemployed">Unemployed</SelectItem>
                      <SelectItem value="Underemployed">Underemployed</SelectItem>
                      <SelectItem value="4Ps Beneficiary">4Ps Beneficiary</SelectItem>
                    </SelectContent>
                  </Select>
                  {validationErrors.classification && (
                    <p className="text-sm text-red-500">{validationErrors.classification}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disability">Disability (if any)</Label>
                  <Input
                    id="disability"
                    value={formData.disability}
                    onChange={(e) => handleInputChange('disability', e.target.value)}
                    placeholder="None or specify"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employmentStatus">Employment Status *</Label>
                  <Select value={formData.employmentStatus || undefined} onValueChange={(value: string) => handleInputChange('employmentStatus', value)}>
                    <SelectTrigger className={validationErrors.employmentStatus ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Employed">Employed</SelectItem>
                      <SelectItem value="Self-employed">Self-employed</SelectItem>
                      <SelectItem value="Unemployed">Unemployed</SelectItem>
                      <SelectItem value="Student">Student</SelectItem>
                    </SelectContent>
                  </Select>
                  {validationErrors.employmentStatus && (
                    <p className="text-sm text-red-500">{validationErrors.employmentStatus}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Trainings */}
            {currentStep === 5 && (
              <div className="space-y-6">
                {/* First Training */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="program">Training Program *</Label>
                    <Select value={trainings[0].program || undefined} onValueChange={(value: string) => handleTrainingChange(0, 'program', value)}>
                      <SelectTrigger className={validationErrors.program ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select program">
                          {trainings[0].program ? getProgramNameById(trainings[0].program) : "Select program"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {programs.length === 0 ? (
                          <SelectItem value="none" disabled>No programs available</SelectItem>
                        ) : (
                          programs.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {validationErrors.program && (
                      <p className="text-sm text-red-500">{validationErrors.program}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select value={trainings[0].status} onValueChange={(value: string) => handleTrainingChange(0, 'status', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateEnrolled">Date Enrolled *</Label>
                    <Input
                      id="dateEnrolled"
                      type="date"
                      value={trainings[0].dateEnrolled}
                      onChange={(e) => handleTrainingChange(0, 'dateEnrolled', e.target.value)}
                      required
                      className={validationErrors.dateEnrolled ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {validationErrors.dateEnrolled && (
                      <p className="text-sm text-red-500">{validationErrors.dateEnrolled}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateCompleted">Date Completed</Label>
                    <Input
                      id="dateCompleted"
                      type="date"
                      value={trainings[0].dateCompleted}
                      onChange={(e) => handleTrainingChange(0, 'dateCompleted', e.target.value)}
                    />
                  </div>
                </div>

                {/* Additional Trainings */}
                {trainings.length > 1 && (
                  <div className="space-y-4">
                    {trainings.slice(1).map((training, index) => (
                      <div key={index} className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`program-${index + 1}`}>Training Program *</Label>
                          <Select value={training.program} onValueChange={(value: string) => handleTrainingChange(index + 1, 'program', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select program">
                                {training.program ? getProgramNameById(training.program) : "Select program"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {programs.length === 0 ? (
                                <SelectItem value="none" disabled>No programs available</SelectItem>
                              ) : (
                                programs.map((program) => (
                                  <SelectItem key={program.id} value={program.id}>
                                    {program.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`status-${index + 1}`}>Status *</Label>
                          <Select value={training.status} onValueChange={(value: string) => handleTrainingChange(index + 1, 'status', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`dateEnrolled-${index + 1}`}>Date Enrolled *</Label>
                          <Input
                            id={`dateEnrolled-${index + 1}`}
                            type="date"
                            value={training.dateEnrolled}
                            onChange={(e) => handleTrainingChange(index + 1, 'dateEnrolled', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`dateCompleted-${index + 1}`}>Date Completed</Label>
                          <Input
                            id={`dateCompleted-${index + 1}`}
                            type="date"
                            value={training.dateCompleted}
                            onChange={(e) => handleTrainingChange(index + 1, 'dateCompleted', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Buttons moved to bottom */}
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addTraining}
                  >
                    <Plus className="mr-2 size-4" />
                    Add Training
                  </Button>

                  {trainings.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={removeTraining}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Remove Training
                    </Button>
                  )}
                </div>

                {/* Certificates Section — only visible when editing */}
                {id && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className="size-5 text-primary" />
                          <div>
                            <h4 className="font-semibold">Certificates</h4>
                            <p className="text-xs text-muted-foreground">
                              Upload certificates for this trainee
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setUploadCertModalOpen(true)}
                        >
                          <Upload className="mr-2 size-4" />
                          Upload Certificate
                        </Button>
                      </div>

                      {loadingCertificates ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        </div>
                      ) : (
                        <CertificateViewer
                          certificates={certificates}
                          canDelete
                          onDelete={handleDeleteCertificate}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Certificate Upload Modal */}
            {id && (
              <CertificateUploadModal
                open={uploadCertModalOpen}
                onClose={() => setUploadCertModalOpen(false)}
                traineeId={id}
                traineeName={traineeName}
                onSuccess={() => {
                  loadCertificates();
                  setUploadCertModalOpen(false);
                }}
              />
            )}

            {/* Step 6: Photo */}
            {currentStep === 6 && (
              <div className="space-y-6">
                {/* Dropzone */}
                <div
                  onDragEnter={handlePhotoDragEnter}
                  onDragLeave={handlePhotoDragLeave}
                  onDragOver={handlePhotoDragOver}
                  onDrop={handlePhotoDrop}
                  onClick={() => photoInputRef.current?.click()}
                  className={`relative cursor-pointer rounded-lg border-2 border-dashed transition-all ${
                    isDraggingPhoto
                      ? 'border-primary bg-primary/5 scale-[1.01]'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  } ${photoPreview ? 'p-3' : 'p-10'}`}
                >
                  <input
                    ref={photoInputRef}
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />

                  {photoPreview ? (
                    <div className="group relative flex flex-col items-center gap-3">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="h-48 w-auto rounded-md object-cover shadow"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={(e: React.MouseEvent) => { e.stopPropagation(); photoInputRef.current?.click(); }}
                        >
                          <Upload className="size-4 mr-2" />
                          Change
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            setPhotoPreview(null);
                            setFormData(prev => ({ ...prev, photo: null }));
                            if (photoInputRef.current) photoInputRef.current.value = '';
                          }}
                        >
                          <X className="size-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-center pointer-events-none">
                      <div className={`flex size-16 items-center justify-center rounded-full transition-all ${
                        isDraggingPhoto ? 'bg-primary/20 scale-110' : 'bg-muted'
                      }`}>
                        <ImageIcon className={`size-8 ${isDraggingPhoto ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {isDraggingPhoto ? 'Drop photo here' : 'Click to upload or drag & drop'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          PNG, JPG, WEBP &bull; max 5MB &bull; 2×2 ID format recommended
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Summary */}
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">Review Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span>{formData.firstName} {formData.lastName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trainings:</span>
                        <span>{trainings.filter(t => t.program).length} program(s)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contact:</span>
                        <span>{formData.contactNumber || 'Not provided'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/trainees')}
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
            {currentStep} / {steps.length}
          </div>

          {currentStep < steps.length ? (
            <Button 
              type="button"
              onClick={nextStep}
            >
              Next
              <ChevronRight className="ml-2 size-4" />
            </Button>
          ) : (
            <Button 
              type="button"
              onClick={handleSubmit} 
              disabled={loading || isVerifying}
            >
              <Save className="mr-2 size-4" />
              {loading ? (id ? 'Updating...' : 'Saving...') : isVerifying ? 'Verifying...' : (id ? 'Update Trainee' : 'Save Trainee')}
            </Button>
          )}
        </div>
      </div>
      )}
    </DashboardLayout>
  );
}