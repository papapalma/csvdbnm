import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { motion, useScroll, useTransform } from 'motion/react';
import LoginModal from '../components/LoginModal';
import RegistrationModal from '../components/RegistrationModal';
import ProgramDetailsModal from '../components/ProgramDetailsModal';
import { getFileUrl, getThumbnailUrl } from '../services/api';
import { programService } from '../services/programService';
import { type Program, isProgramExpired } from './ProgramsPage';
import logger from '../utils/logger';
import cmsSettingsService from '../services/cmsSettingsService';
import {
  GraduationCap,
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
  Calendar,
  Clock,
  Target,
  Facebook,
  MapPin,
  Phone,
  Mail,
  Sparkles,
  ChevronDown,
  ArrowRight,
  Star,
} from 'lucide-react';

interface CMSSettings {
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  appearance: {
    logo: string;
    heroBackground: string;
  };
  mission: string;
  vision: string;
  contact: {
    address: string;
    addressLine2: string;
    phone: string;
    email: string;
    facebook: string;
  };
  footer: {
    companyName: string;
    tagline: string;
  };
}

const defaultCmsSettings: CMSSettings = {
  hero: {
    badge: 'Quality Training & Development',
    title: 'Discover Your Path',
    subtitle: 'Transform your future with our comprehensive training programs. Choose from a variety of courses designed to empower you with in-demand skills.',
    ctaPrimary: 'Enroll Now',
    ctaSecondary: 'Browse Programs',
  },
  appearance: {
    logo: '',
    heroBackground: '',
  },
  mission: 'To provide accessible, quality training and development programs that equip individuals with the skills and knowledge necessary to improve their livelihood and contribute to community development.',
  vision: 'A community where every individual has access to quality education and training, empowering them to achieve their full potential and contribute to sustainable economic growth and social progress.',
  contact: {
    address: 'Bongabong, Oriental Mindoro',
    addressLine2: 'Philippines',
    phone: '+63 XXX XXX XXXX',
    email: 'info@bmdc.edu.ph',
    facebook: 'https://facebook.com',
  },
  footer: {
    companyName: 'Bongabong Manpower Development Center',
    tagline: 'Empowering Communities',
  },
};

const normalizeCmsSettings = (saved: Partial<CMSSettings> | null): CMSSettings => ({
  ...defaultCmsSettings,
  ...saved,
  hero: { ...defaultCmsSettings.hero, ...saved?.hero },
  appearance: { ...defaultCmsSettings.appearance, ...saved?.appearance },
  contact: { ...defaultCmsSettings.contact, ...saved?.contact },
  footer: { ...defaultCmsSettings.footer, ...saved?.footer },
});

// Icon mapping for programs
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    Laptop, Wrench, ChefHat, Users, Briefcase, Heart,
    Scissors, Paintbrush, Camera, Music, Code, Car, GraduationCap,
  };
  return iconMap[iconName] || GraduationCap;
};

// Format date helper
const formatDate = (dateString: string) => {
  if (!dateString) return 'TBA';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper to extract value from either string or object with value property
const getValue = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val.value !== undefined) return val.value;
  return String(val);
};

// Determine if a program is upcoming (starts in the future)
const isProgramUpcoming = (startDate: string): boolean => {
  if (!startDate) return false;
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start > today;
};

// Days until a program starts
const daysUntilStart = (startDate: string): number => {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [cmsSettings, setCmsSettings] = useState<CMSSettings>(defaultCmsSettings);
  const [heroImgLoaded, setHeroImgLoaded] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  // Parallax scroll effect for hero background
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 600], [0, 120]);

  // Auto-open login or registration modal when redirected
  useEffect(() => {
    if (location.state?.openLogin) {
      setIsLoginModalOpen(true);
      window.history.replaceState({}, '');
    }
    if (location.state?.openRegister) {
      setIsRegistrationModalOpen(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Load CMS settings from database (with localStorage fallback)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await cmsSettingsService.getSettings();
        if (data) {
          setCmsSettings(normalizeCmsSettings(data));
        } else {
          // Fallback to localStorage if database is empty
          const savedSettings = localStorage.getItem('bmdc-cms-settings');
          if (savedSettings) {
            setCmsSettings(normalizeCmsSettings(JSON.parse(savedSettings)));
          } else {
            setCmsSettings(defaultCmsSettings);
          }
        }
      } catch (error) {
        logger.error('Failed to load CMS settings', { error });
        // Fallback to localStorage on error
        const savedSettings = localStorage.getItem('bmdc-cms-settings');
        if (savedSettings) {
          setCmsSettings(normalizeCmsSettings(JSON.parse(savedSettings)));
        } else {
          setCmsSettings(defaultCmsSettings);
        }
      }
    };
    
    loadSettings();
  }, []);

  // Load programs from API — fetch both active and upcoming
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const [activeRes, upcomingRes] = await Promise.all([
          programService.getPrograms({ status: 'active' }),
          programService.getPrograms({ status: 'upcoming' }),
        ]);

        const toFrontend = (serviceProgram: any): Program => ({
          id: serviceProgram.id,
          name: serviceProgram.name,
          description: serviceProgram.description || '',
          duration: serviceProgram.duration_weeks ? `${serviceProgram.duration_weeks} weeks` : '',
          level: (serviceProgram as any).level || '',
          icon: 'GraduationCap',
          status: serviceProgram.status === 'active' ? 'active' : 'inactive',
          startDate: serviceProgram.start_date || '',
          endDate: serviceProgram.end_date || '',
          photoUrl: getThumbnailUrl(serviceProgram.thumbnail_path || serviceProgram.image_path),
          createdAt: serviceProgram.created_at || '',
          updatedAt: serviceProgram.updated_at || '',
          instructor: serviceProgram.instructor || undefined,
        });

        const activePrograms: Program[] = (activeRes?.data || [])
          .map(toFrontend)
          .filter((p: Program) => p.status === 'active' && !isProgramExpired(p.endDate));

        const upcomingPrograms: Program[] = (upcomingRes?.data || [])
          .map(toFrontend);

        // Merge, deduplicate by id, active first then upcoming
        const seen = new Set<string>();
        const merged: Program[] = [];
        for (const p of [...activePrograms, ...upcomingPrograms]) {
          if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
        }

        logger.debug('LandingPage programs loaded', { count: merged.length });
        setPrograms(merged);
      } catch (error) {
        logger.error('Failed to fetch programs', { error });
        setPrograms([]);
      }
    };
    fetchPrograms();
  }, []);

  const fadeInUp: any = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeInOut" } },
  };

  const staggerContainer: any = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
  };

  const heroBackground = cmsSettings.appearance.heroBackground
    ? getFileUrl(cmsSettings.appearance.heroBackground)
    : '';

  // Split programs: currently running vs upcoming
  const runningPrograms = programs.filter(p => p.status === 'active' && !isProgramUpcoming(p.startDate));
  const upcomingPrograms = programs.filter(p => isProgramUpcoming(p.startDate));
  const allDisplayPrograms = programs;

  return (
    <div className="min-h-screen bg-background">
      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/70 shadow-sm">
        <div className="container mx-auto flex h-24 md:h-28 items-center justify-between px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 md:gap-4"
          >
            {cmsSettings?.appearance?.logo ? (
              <img
                src={getFileUrl(cmsSettings.appearance.logo)}
                alt="BMDC Logo"
                className="size-14 md:size-16 rounded-2xl object-contain shadow-lg ring-2 ring-primary/10"
              />
            ) : (
              <div className="flex size-14 md:size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary shadow-lg ring-2 ring-primary/20">
                <span className="text-base md:text-lg font-bold text-white">BMDC</span>
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-lg md:text-xl font-bold leading-tight tracking-tight">
                {getValue(cmsSettings?.footer?.companyName) || 'Bongabong MDC'}
              </p>
              <p className="text-sm md:text-base font-medium text-muted-foreground">
                {getValue(cmsSettings?.footer?.tagline) || 'Empowering Communities'}
              </p>
            </div>
          </motion.div>

          <motion.nav
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-6 md:gap-8"
          >
            <a href="#programs" className="hidden text-xl md:text-2xl font-bold text-slate-600 transition-all hover:text-primary hover:scale-105 md:block">
              Programs
            </a>
            <a href="#about" className="hidden text-xl md:text-2xl font-bold text-slate-600 transition-all hover:text-primary hover:scale-105 md:block">
              About Us
            </a>
            <a href="#contact" className="hidden text-xl md:text-2xl font-bold text-slate-600 transition-all hover:text-primary hover:scale-105 md:block">
              Contact
            </a>
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button size="lg" className="shadow-lg hover:shadow-xl transition-all hover:scale-105 font-bold text-xl md:text-2xl px-10 md:px-14 py-4 md:py-5 rounded-xl">Dashboard</Button>
              </Link>
            ) : (
              <Button size="lg" onClick={() => setIsLoginModalOpen(true)} className="shadow-lg hover:shadow-xl transition-all hover:scale-105 font-bold text-xl md:text-2xl px-10 md:px-14 py-4 md:py-5 rounded-xl">
                Login
              </Button>
            )}
          </motion.nav>
        </div>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section ref={heroRef} className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white flex flex-col">
        {/* Background image with parallax */}
        <motion.div
          className="absolute inset-0"
          style={{ y: heroParallax }}
        >
          {heroBackground ? (
            <>
              <img
                src={heroBackground}
                alt=""
                aria-hidden="true"
                onLoad={() => setHeroImgLoaded(true)}
                className={`h-[110%] w-full object-cover transition-opacity duration-1000 ${heroImgLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
              {/* Strong dark overlay to ensure text contrast - works with any image */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-950/80 to-blue-950/85" />
              {/* Additional overlay for depth and color */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
              {/* Subtle color accents */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.15),transparent_50%)]" />
            </>
          ) : (
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.35),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.3),transparent_50%),linear-gradient(135deg,#0f172a,#1e293b_50%,#020617)]" />
          )}
        </motion.div>

        {/* Animated gradient orbs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -top-40 -right-40 size-96 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="pointer-events-none absolute -bottom-40 -left-40 size-96 rounded-full bg-gradient-to-tr from-purple-500/30 to-pink-500/30 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.25, 0.45, 0.25],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-gradient-to-br from-indigo-500/20 to-blue-500/20 blur-3xl"
        />

        {/* Hero content */}
        <div className="container relative mx-auto flex flex-1 items-center px-4 py-12 md:py-16 lg:py-20">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="max-w-4xl"
          >
            {/* Main title - VERY large for desktop */}
            <motion.h1
              variants={fadeInUp}
              className="mb-3 md:mb-6 text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black leading-[0.95] md:leading-[0.9] tracking-tight"
            >
              <span className="text-white" style={{ textShadow: '0 4px 30px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.6)' }}>
                BMDC - EMPOWERING COMMUNITIES
              </span>
            </motion.h1>

            {/* Subtitle - large for desktop */}
            <motion.h2
              variants={fadeInUp}
              className="mb-3 md:mb-5 text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold leading-tight"
            >
              <span className="text-white" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8), 0 1px 10px rgba(0,0,0,0.6)' }}>
                Bongabong Manpower Development Center
              </span>
            </motion.h2>

            {/* Description text */}
            <motion.p
              variants={fadeInUp}
              className="mb-5 md:mb-8 text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed"
            >
              <span className="text-white/95" style={{ textShadow: '0 2px 15px rgba(0,0,0,0.8), 0 1px 8px rgba(0,0,0,0.6)' }}>
                Your gateway to skilled training and career development in Bongabong. Established 2023.
              </span>
            </motion.p>

            {/* Social link */}
            <motion.div variants={fadeInUp}>
              <a
                href={getValue(cmsSettings?.contact?.facebook) || 'https://facebook.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 md:gap-3 rounded-full bg-blue-600 px-5 py-3 md:px-8 md:py-4 text-white transition-all hover:scale-105 hover:bg-blue-700 shadow-2xl font-bold text-sm md:text-base"
              >
                <Facebook className="size-5 md:size-6" />
                <span>FOLLOW US</span>
              </a>
            </motion.div>
          </motion.div>
        </div>

        {/* Animated scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2"
        >
          <a href="#programs" aria-label="Scroll to programs">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="flex flex-col items-center gap-2 rounded-full border border-white/40 bg-black/50 px-3 py-2 md:px-4 md:py-3 backdrop-blur-2xl transition-all hover:border-white/60 hover:bg-black/60 hover:shadow-xl"
            >
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white" style={{ textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>Explore</span>
              <ChevronDown className="size-4 md:size-5 text-white" style={{ filter: 'drop-shadow(0 1px 5px rgba(0,0,0,0.5))' }} />
            </motion.div>
          </a>
        </motion.div>
      </section>

      {/* ─── PROGRAMS SECTION ─── */}
      <section id="programs" className="relative py-16 md:py-24 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 size-72 md:size-96 rounded-full bg-blue-500/5 blur-3xl" />
          <div className="absolute bottom-20 right-10 size-72 md:size-96 rounded-full bg-purple-500/5 blur-3xl" />
        </div>

        <div className="container relative mx-auto px-4">
          {/* Section header with glassmorphism */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="mb-12 md:mb-16 text-center"
          >
            <motion.div variants={fadeInUp}>
              <div className="mb-4 md:mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-gradient-to-r from-primary/15 to-secondary/15 px-5 py-2 md:px-6 md:py-2.5 backdrop-blur-sm shadow-lg">
                <GraduationCap className="size-4 md:size-5 text-primary" />
                <span className="text-xs md:text-sm font-bold tracking-wide">Training Programs</span>
              </div>
            </motion.div>
            <motion.h2 variants={fadeInUp} className="mb-4 md:mb-6 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-transparent dark:from-white dark:via-blue-100 dark:to-white">
              Programs We Offer
            </motion.h2>
            <motion.p variants={fadeInUp} className="mx-auto max-w-2xl text-base md:text-lg text-muted-foreground px-4">
              Hands-on, government-recognized training programs designed to build real skills and open real opportunities.
            </motion.p>
          </motion.div>

          {/* Upcoming programs with enhanced glassmorphism */}
          {upcomingPrograms.length > 0 && (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeInUp}
              className="mb-12 md:mb-16"
            >
              <div className="mb-6 md:mb-8 flex items-center gap-4">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex items-center gap-2 md:gap-3 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/25 to-orange-500/25 px-4 py-2 md:px-6 md:py-3 backdrop-blur-2xl shadow-xl shadow-amber-500/20"
                >
                  <Star className="size-4 md:size-5 text-amber-500 fill-amber-500" />
                  <span className="text-xs md:text-sm font-extrabold text-amber-600 dark:text-amber-400">Upcoming Programs</span>
                </motion.div>
                <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
              </div>

              <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingPrograms.map((program, i) => {
                  const IconComponent = getIconComponent(program.icon);
                  const days = daysUntilStart(program.startDate);
                  return (
                    <motion.div
                      key={program.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      whileHover={{ y: -8, scale: 1.02 }}
                    >
                      <Card
                        className="group relative h-full cursor-pointer overflow-hidden border-2 border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-white/90 backdrop-blur-2xl transition-all hover:border-amber-400/90 hover:shadow-2xl hover:shadow-amber-500/30 dark:border-amber-800/50 dark:from-amber-950/40 dark:to-slate-900/90"
                        onClick={() => setSelectedProgram(program)}
                      >
                        {/* Animated gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-orange-500/0 to-amber-500/0 opacity-0 transition-opacity group-hover:opacity-15" />
                        
                        {/* Countdown badge with glow */}
                        <div className="absolute right-3 top-3 md:right-4 md:top-4 z-10">
                          <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/60 text-xs md:text-sm font-bold">
                              {days === 0 ? '🔥 Starts Today!' : days === 1 ? '⚡ Tomorrow' : `⏰ In ${days} days`}
                            </Badge>
                          </motion.div>
                        </div>

                        {program.photoUrl && (
                          <div className="relative h-40 md:h-48 w-full overflow-hidden">
                            <img
                              src={program.photoUrl}
                              alt={program.name}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          </div>
                        )}

                        <CardHeader className="pb-3">
                          {!program.photoUrl && (
                            <motion.div
                              whileHover={{ rotate: 360 }}
                              transition={{ duration: 0.6 }}
                              className="mb-4 flex size-14 md:size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-amber-500/40"
                            >
                              <IconComponent className="size-7 md:size-8 text-white" />
                            </motion.div>
                          )}
                          <CardTitle className="text-lg md:text-xl leading-snug">{program.name}</CardTitle>
                          {program.duration && (
                            <Badge variant="outline" className="w-fit border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-400 font-semibold">{program.duration}</Badge>
                          )}
                        </CardHeader>

                        <CardContent className="space-y-3 md:space-y-4 pt-0">
                          <CardDescription className="line-clamp-2 text-sm leading-relaxed">{program.description}</CardDescription>
                          <div className="space-y-2 border-t border-amber-200/60 pt-3 dark:border-amber-800/60">
                            {program.startDate && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="size-3.5 md:size-4 text-amber-500" />
                                <span>Starts {formatDate(program.startDate)}</span>
                              </div>
                            )}
                            {program.endDate && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="size-3.5 md:size-4 text-muted-foreground" />
                                <span>Ends {formatDate(program.endDate)}</span>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 transition-all hover:from-amber-100 hover:to-orange-100 hover:shadow-lg font-semibold dark:border-amber-700 dark:from-amber-950/50 dark:to-orange-950/50 dark:text-amber-400"
                          >
                            View Details
                            <ArrowRight className="size-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Active / all programs with glassmorphism */}
          {runningPrograms.length > 0 && (
            <div>
              {upcomingPrograms.length > 0 && (
                <div className="mb-6 md:mb-8 flex items-center gap-4">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="flex items-center gap-2 md:gap-3 rounded-full border border-green-500/40 bg-gradient-to-r from-green-500/25 to-emerald-500/25 px-4 py-2 md:px-6 md:py-3 backdrop-blur-2xl shadow-xl shadow-green-500/20"
                  >
                    <div className="size-2 md:size-2.5 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/60" />
                    <span className="text-xs md:text-sm font-extrabold text-green-600 dark:text-green-400">Currently Running</span>
                  </motion.div>
                  <div className="h-px flex-1 bg-gradient-to-r from-green-500/30 to-transparent" />
                </div>
              )}

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={staggerContainer}
                className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3"
              >
                {runningPrograms.map((program, i) => {
                  const IconComponent = getIconComponent(program.icon);
                  return (
                    <motion.div
                      key={program.id}
                      variants={fadeInUp}
                      custom={i}
                      whileHover={{ y: -10, scale: 1.02 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card
                        className="group relative h-full cursor-pointer overflow-hidden border-2 border-border/60 bg-gradient-to-br from-white/90 to-slate-50/90 backdrop-blur-2xl transition-all hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/20 dark:from-slate-900/90 dark:to-slate-950/90"
                        onClick={() => setSelectedProgram(program)}
                      >
                        {/* Animated gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-secondary/0 to-primary/0 opacity-0 transition-opacity group-hover:opacity-15" />
                        
                        {program.photoUrl ? (
                          <div className="relative h-48 md:h-56 w-full overflow-hidden">
                            <img
                              src={program.photoUrl}
                              alt={program.name}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-1"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                            {/* Active badge with glow */}
                            <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4">
                              <motion.div
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                <Badge className="border border-green-400/60 bg-green-500/95 text-white backdrop-blur-sm shadow-xl shadow-green-500/60 font-bold">
                                  <div className="mr-2 size-1.5 md:size-2 rounded-full bg-white animate-pulse" />
                                  Active Now
                                </Badge>
                              </motion.div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-32 md:h-36 items-center justify-center bg-gradient-to-br from-primary/15 via-secondary/10 to-primary/15">
                            <motion.div
                              whileHover={{ rotate: 360, scale: 1.1 }}
                              transition={{ duration: 0.6 }}
                              className="flex size-20 md:size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-secondary shadow-2xl shadow-primary/40"
                            >
                              <IconComponent className="size-10 md:size-12 text-white" />
                            </motion.div>
                          </div>
                        )}

                        <CardHeader className="pb-3">
                          {program.photoUrl && (
                            <motion.div
                              whileHover={{ rotate: 360 }}
                              transition={{ duration: 0.6 }}
                              className="mb-3 flex size-12 md:size-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-xl shadow-primary/40"
                            >
                              <IconComponent className="size-6 md:size-7 text-white" />
                            </motion.div>
                          )}
                          <CardTitle className="text-lg md:text-xl leading-snug">{program.name}</CardTitle>
                          <div className="flex flex-wrap gap-2 pt-2">
                            {program.duration && <Badge className="bg-gradient-to-r from-primary to-secondary text-white font-semibold">{program.duration}</Badge>}
                            {program.level && <Badge variant="outline" className="border-primary/40 font-semibold">{program.level}</Badge>}
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3 md:space-y-4 pt-0">
                          <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                            {program.description}
                          </CardDescription>

                          {(program.startDate || program.endDate) && (
                            <div className="space-y-2 border-t border-border/60 pt-3">
                              {program.startDate && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="size-3.5 md:size-4 text-primary" />
                                  <span>Started {formatDate(program.startDate)}</span>
                                </div>
                              )}
                              {program.endDate && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="size-3.5 md:size-4 text-secondary" />
                                  <span>Ends {formatDate(program.endDate)}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 border-primary/40 bg-gradient-to-r from-primary/10 to-secondary/10 transition-all hover:from-primary/15 hover:to-secondary/15 hover:border-primary/60 hover:shadow-lg group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary font-semibold"
                          >
                            Learn More
                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          )}

          {/* Empty state */}
          {allDisplayPrograms.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-muted">
                    <GraduationCap className="size-10 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">No Programs Available</h3>
                  <p className="text-center text-muted-foreground">
                    Check back soon for upcoming training programs.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </section>

      {/* ─── ABOUT / MISSION & VISION ─── */}
      <section id="about" className="py-16 md:py-20 bg-muted/40">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="mb-10 md:mb-12 text-center"
          >
            <motion.div variants={fadeInUp}>
              <Badge variant="outline" className="mb-3 md:mb-4 px-4 py-1.5 text-xs md:text-sm font-bold border-primary/30">About BMDC</Badge>
            </motion.div>
            <motion.h2 variants={fadeInUp} className="mb-3 md:mb-4 text-3xl md:text-4xl font-extrabold tracking-tight">
              Who We Are
            </motion.h2>
            <motion.p variants={fadeInUp} className="mx-auto max-w-2xl text-sm md:text-base text-muted-foreground px-4">
              {getValue(cmsSettings?.footer?.companyName)} is committed to building a skilled and empowered community.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
            className="grid gap-4 md:gap-6 md:grid-cols-2"
          >
            <motion.div variants={fadeInUp}>
              <Card className="h-full border-2 transition-all hover:shadow-2xl hover:border-primary/50 hover:scale-[1.02]">
                <CardHeader>
                  <div className="mb-4 flex size-12 md:size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-xl shadow-primary/30">
                    <Target className="size-6 md:size-7 text-white" />
                  </div>
                  <CardTitle className="text-xl md:text-2xl">Our Mission</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed text-sm md:text-base text-muted-foreground">
                    {getValue(cmsSettings?.mission)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <Card className="h-full border-2 transition-all hover:shadow-2xl hover:border-secondary/50 hover:scale-[1.02]">
                <CardHeader>
                  <div className="mb-4 flex size-12 md:size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-secondary/70 shadow-xl shadow-secondary/30">
                    <GraduationCap className="size-6 md:size-7 text-white" />
                  </div>
                  <CardTitle className="text-xl md:text-2xl">Our Vision</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed text-sm md:text-base text-muted-foreground">
                    {getValue(cmsSettings?.vision)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── CTA BANNER with Glassmorphism ─── */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-40 -left-40 size-80 md:size-96 rounded-full bg-white/10 blur-3xl"
          />
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              rotate: [0, -90, 0],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-40 -right-40 size-80 md:size-96 rounded-full bg-white/10 blur-3xl"
          />
        </div>

        <div className="container relative mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Glassmorphic card */}
            <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/30 bg-white/15 p-8 md:p-12 lg:p-16 backdrop-blur-2xl shadow-2xl">
              {/* Decorative elements */}
              <div className="pointer-events-none absolute -top-20 -right-20 size-48 md:size-64 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 size-48 md:size-64 rounded-full bg-white/10 blur-2xl" />

              <div className="relative z-10 mx-auto max-w-3xl text-center text-white">
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <div className="mb-4 md:mb-6 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/25 px-4 py-2 md:px-6 md:py-2.5 backdrop-blur-2xl shadow-xl">
                    <Sparkles className="size-4 md:size-5" />
                    <span className="text-xs md:text-sm font-bold tracking-wide">Start Your Journey</span>
                  </div>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="mb-4 md:mb-6 text-3xl md:text-5xl lg:text-6xl font-extrabold text-white"
                >
                  Ready to Transform Your Future?
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="mb-8 md:mb-10 text-base md:text-lg lg:text-xl text-white/95 px-4"
                >
                  Join our training programs and gain the skills that employers are looking for today.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 md:gap-4"
                >
                  <a href="#programs">
                    <Button
                      size="lg"
                      className="group gap-2 bg-white px-6 py-5 md:px-8 md:py-6 text-base md:text-lg font-bold text-blue-600 shadow-2xl transition-all hover:scale-105 hover:shadow-white/40 w-full sm:w-auto"
                    >
                      View Programs
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowRight className="size-5" />
                      </motion.div>
                    </Button>
                  </a>
                  <Button
                    size="lg"
                    onClick={() => setIsRegistrationModalOpen(true)}
                    className="gap-2 border-2 border-white/50 bg-white/25 px-6 py-5 md:px-8 md:py-6 text-base md:text-lg font-bold text-white backdrop-blur-2xl transition-all hover:scale-105 hover:border-white/70 hover:bg-white/35 hover:shadow-xl w-full sm:w-auto"
                  >
                    Enroll Now
                    <Star className="size-5" />
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── CONTACT SECTION ─── */}
      <section id="contact" className="py-16 md:py-20 bg-muted/40">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="mb-10 md:mb-12 text-center"
          >
            <motion.div variants={fadeInUp}>
              <Badge variant="outline" className="mb-3 md:mb-4 px-4 py-1.5 text-xs md:text-sm font-bold border-primary/30">Contact Us</Badge>
            </motion.div>
            <motion.h2 variants={fadeInUp} className="mb-3 md:mb-4 text-3xl md:text-4xl font-extrabold tracking-tight">
              Get in Touch
            </motion.h2>
            <motion.p variants={fadeInUp} className="mx-auto max-w-xl text-sm md:text-base text-muted-foreground px-4">
              Have questions about our programs? We'd love to hear from you.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl"
          >
            <Card className="overflow-hidden border-2 shadow-xl hover:shadow-2xl transition-all">
              <CardHeader className="border-b bg-muted/50 pb-4">
                <CardTitle className="text-lg md:text-xl">Contact Information</CardTitle>
                <CardDescription className="text-sm">Visit us or reach out through any of these channels</CardDescription>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {[
                  {
                    icon: <MapPin className="size-4 md:size-5 text-primary" />,
                    bg: 'bg-primary/10',
                    label: 'Address',
                    content: (
                      <>
                        <p className="text-xs md:text-sm text-muted-foreground">{getValue(cmsSettings?.contact?.address)}</p>
                        <p className="text-xs md:text-sm text-muted-foreground">{getValue(cmsSettings?.contact?.addressLine2)}</p>
                      </>
                    ),
                  },
                  {
                    icon: <Phone className="size-4 md:size-5 text-secondary" />,
                    bg: 'bg-secondary/10',
                    label: 'Phone',
                    content: <p className="text-xs md:text-sm text-muted-foreground">{getValue(cmsSettings?.contact?.phone)}</p>,
                  },
                  {
                    icon: <Mail className="size-4 md:size-5 text-foreground" />,
                    bg: 'bg-muted',
                    label: 'Email',
                    content: <p className="text-xs md:text-sm text-muted-foreground">{getValue(cmsSettings?.contact?.email)}</p>,
                  },
                  {
                    icon: <Facebook className="size-4 md:size-5 text-blue-600" />,
                    bg: 'bg-blue-500/10',
                    label: 'Facebook',
                    content: (
                      <a
                        href={getValue(cmsSettings?.contact?.facebook)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs md:text-sm text-primary hover:underline font-semibold"
                      >
                        Visit our Facebook Page
                      </a>
                    ),
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 md:gap-4 p-4 md:p-5 transition-all hover:bg-muted/60">
                    <div className={`flex size-9 md:size-10 shrink-0 items-center justify-center rounded-xl ${item.bg} shadow-sm`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs md:text-sm font-bold">{item.label}</p>
                      {item.content}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t bg-card py-8 md:py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 md:gap-5 text-center">
            <div className="flex items-center gap-3">
              {cmsSettings?.appearance?.logo ? (
                <img
                  src={getFileUrl(cmsSettings.appearance.logo)}
                  alt="BMDC Logo"
                  className="size-10 md:size-12 rounded-xl object-contain shadow-md ring-2 ring-primary/10"
                />
              ) : (
                <div className="flex size-10 md:size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-md ring-2 ring-primary/20">
                  <span className="text-xs font-bold text-white">BMDC</span>
                </div>
              )}
              <div className="text-left">
                <p className="text-sm md:text-base font-bold">
                  {getValue(cmsSettings?.footer?.companyName) || 'Bongabong MDC'}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground font-medium">
                  {getValue(cmsSettings?.footer?.tagline) || 'Empowering Communities'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-xs md:text-sm text-muted-foreground font-semibold">
              <a href="#programs" className="hover:text-primary transition-all hover:scale-105">Programs</a>
              <a href="#about" className="hover:text-primary transition-all hover:scale-105">About</a>
              <a href="#contact" className="hover:text-primary transition-all hover:scale-105">Contact</a>
              <button onClick={() => setIsRegistrationModalOpen(true)} className="hover:text-primary transition-all hover:scale-105">Enroll</button>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              © {new Date().getFullYear()} {getValue(cmsSettings?.footer?.companyName) || 'Bongabong Manpower Development Center'}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* ─── MODALS ─── */}
      <LoginModal open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen} />
      <RegistrationModal open={isRegistrationModalOpen} onOpenChange={setIsRegistrationModalOpen} />
      <ProgramDetailsModal
        program={selectedProgram}
        open={!!selectedProgram}
        onOpenChange={(open) => !open && setSelectedProgram(null)}
        canManage={false}
      />
    </div>
  );
}
