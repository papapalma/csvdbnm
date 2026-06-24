import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type jsQRType from 'jsqr';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  X, Flashlight, FlashlightOff, Package, CheckCircle2,
  Camera, AlertCircle, ScanLine, Users, QrCode,
  Clock, Calendar, CalendarCheck, MapPin, Pause, Play, Keyboard,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import inventoryService, { InventoryItem } from '../services/inventoryService';
import attendanceService from '../services/attendanceService';
import sessionService, { ProgramSession } from '../services/sessionService';
import programService from '../services/programService';
import { useAuth } from '../contexts/AuthContext';

type ScanMode = 'item' | 'attendance';

interface ScannedItemResult {
  item: InventoryItem;
}

interface AttendanceResult {
  trainee_name?: string;
  status: string;
  message: string;
  scanned_at: string;
}

interface ScanHistoryEntry {
  id: string;
  mode: ScanMode;
  label: string;
  status: string;
  scanned_at: string;
}

interface QR_Scanner_Modal_Props {
  /** Controls modal visibility */
  isOpen: boolean;
  
  /** Callback invoked when modal should close */
  onClose: () => void;
  
  /** Initial scanning mode (defaults to 'item' for super_admin/local_admin/staff_inventory_manager, 'attendance' for staff_training_coordinator) */
  initialMode?: 'item' | 'attendance';
  
  /** Optional: Pre-select a program (for attendance mode) */
  initialProgramId?: string;
  
  /** Optional: Pre-select a session (for attendance mode) */
  initialSessionId?: string;
}

export default function QR_Scanner_Modal({
  isOpen,
  onClose,
  initialMode,
  initialProgramId,
  initialSessionId,
}: QR_Scanner_Modal_Props) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const cooldownRef = useRef(false);
  const accessToastShownRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Lazy-loaded jsQR module
  const [jsQR, setJsQR] = useState<typeof jsQRType | null>(null);

  // UUID validation helper function
  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const currentRole = user?.role ?? '';
  const canScanItems = currentRole === 'super_admin' || currentRole === 'local_admin' || currentRole === 'staff_inventory_manager';
  const canScanAttendance = currentRole === 'super_admin' || currentRole === 'local_admin' || currentRole === 'staff_training_coordinator';
  const hasScannerAccess = canScanItems || canScanAttendance;
  const canSwitchModes = canScanItems && canScanAttendance;

  const [mode, setMode] = useState<ScanMode>(initialMode || (canScanItems ? 'item' : 'attendance'));
  const [torch, setTorch] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);

  // Item mode state
  const [scannedItem, setScannedItem] = useState<ScannedItemResult | null>(null);
  const [itemLoading, setItemLoading] = useState(false);

  // Attendance mode state
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(initialProgramId || '');
  const [programsLoading, setProgramsLoading] = useState(false);
  const [todaySessions, setTodaySessions] = useState<ProgramSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || '');
  const [attendanceResult, setAttendanceResult] = useState<AttendanceResult | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [now, setNow] = useState(new Date());

  const pushScanHistory = useCallback((entry: Omit<ScanHistoryEntry, 'id'>) => {
    setScanHistory(prev => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...entry,
      },
      ...prev,
    ].slice(0, 5));
  }, []);

  // Screen reader announcement utility
  const announce = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  // ── Camera lifecycle ────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
  }, [stream]);

  const startCamera = async (deviceId?: string) => {
    const targetDeviceId = deviceId || selectedDeviceId;
    setCameraError(null);
    setPermissionDenied(false);
    setTorch(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera not supported on this device');
        return;
      }

      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: targetDeviceId
          ? { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameraDevices = devices.filter(device => device.kind === 'videoinput');
        setVideoDevices(cameraDevices);
        if (!selectedDeviceId && cameraDevices.length > 0) {
          setSelectedDeviceId(cameraDevices[0].deviceId);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => startDecoding();
      }
      setStream(mediaStream);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied');
        setPermissionDenied(true);
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device');
      } else if (err.name === 'NotReadableError') {
        setCameraError('Camera is already in use by another application');
      } else {
        setCameraError('Failed to access camera');
      }
    }
  };

  const handleCameraDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    // Debounce camera changes to avoid rapid switching
    await new Promise(resolve => setTimeout(resolve, 300));
    await startCamera(deviceId);
  };

  // ── Torch ────────────────────────────────────────────────────────────────────

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities() as any;
    if (caps.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: !torch } as any] });
        setTorch(!torch);
      } catch {
        toast.error('Torch control failed');
      }
    } else {
      toast.error('Torch not supported on this device');
    }
  };

  // ── QR decode loop ───────────────────────────────────────────────────────────

  const startDecoding = () => {
    if (!jsQR) return; // Wait for jsQR to load
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (scannerPaused) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code && !cooldownRef.current) {
        handleQRDetected(code.data);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // triggers cooldown so we don't process the same QR 60× per second
  const triggerCooldown = (ms = 2000) => {
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, ms);
  };

  // ── Manual code entry ────────────────────────────────────────────────────────

  const handleManualCodeSubmit = async () => {
    const code = manualCode.trim();
    if (!code) {
      toast.warning('Enter a QR value first');
      return;
    }

    setManualCode('');
    await handleQRDetected(code);
  };

  // ── QR result handler ────────────────────────────────────────────────────────

  const handleQRDetected = useCallback(async (raw: string) => {
    if (scannerPaused) return;

    if (mode === 'item' && !canScanItems) {
      toast.error('Your role is restricted to attendance scanning only.');
      return;
    }

    if (mode === 'attendance' && !canScanAttendance) {
      toast.error('Your role is restricted to item scanning only.');
      return;
    }

    // Defensive check: validate session state before processing attendance scans
    if (mode === 'attendance' && (!selectedSessionId || !isValidUUID(selectedSessionId))) {
      toast.warning('Please select a session before scanning');
      return; // Don't trigger cooldown
    }

    if (mode === 'item') {
      await handleItemScan(raw);
    } else {
      await handleAttendanceScan(raw);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedSessionId, canScanItems, canScanAttendance, scannerPaused]);

  // ── Item scanning ────────────────────────────────────────────────────────────

  const handleItemScan = async (raw: string) => {
    let itemId: string | null = null;
    try {
      const parsed = JSON.parse(raw);
      itemId = parsed.id ?? null;
    } catch {
      // raw string might itself be an ID
      itemId = raw.trim();
    }
    if (!itemId) {
      toast.error('Invalid item QR code');
      return;
    }
    setItemLoading(true);
    try {
      const item = await inventoryService.getInventoryItemById(itemId);
      triggerCooldown();
      setScannedItem({ item });
      pushScanHistory({
        mode: 'item',
        label: item.name,
        status: item.available_quantity > 0 ? 'available' : 'out_of_stock',
        scanned_at: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        }),
      });
    } catch {
      toast.error('Item not found. QR code may be outdated.');
    } finally {
      setItemLoading(false);
    }
  };

  // ── Attendance scanning ──────────────────────────────────────────────────────

  const handleAttendanceScan = async (qrCode: string) => {
    if (!selectedSessionId || !isValidUUID(selectedSessionId)) {
      toast.warning('Please select a valid session first');
      cooldownRef.current = false; // allow immediate re-scan after choosing session
      return;
    }
    triggerCooldown();
    const scannedAt = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    setAttendanceLoading(true);
    try {
      const res = await attendanceService.scanAttendance({
        session_id: selectedSessionId,
        qr_code: qrCode,
      });
      const data = res.data as any;
      const result: AttendanceResult = {
        trainee_name: data?.trainee
          ? `${data.trainee.first_name} ${data.trainee.last_name}`
          : undefined,
        status: data?.status ?? 'present',
        message: res.message ?? 'Attendance recorded',
        scanned_at: scannedAt,
      };
      setAttendanceResult(result);
      setScanCount(c => c + 1);
      pushScanHistory({
        mode: 'attendance',
        label: result.trainee_name || 'Unknown trainee',
        status: result.status,
        scanned_at: result.scanned_at,
      });
      toast.success(result.message);
      // Auto-clear result after 3 s and continue scanning
      setTimeout(() => {
        setAttendanceResult(null);
        triggerCooldown(500);
      }, 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Attendance scan failed';
      if (msg.includes('session') || msg.includes('Session')) {
        toast.error('Invalid session. Please select a session and try again.');
      } else {
        toast.error(msg);
      }
    } finally {
      setAttendanceLoading(false);
    }
  };

  // ── Programs loader ──────────────────────────────────────────────────────────

  const loadPrograms = async () => {
    setProgramsLoading(true);
    try {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const res = await programService.getPrograms();
      setPrograms(res.data ?? []);
    } catch (err: any) {
      // Don't show error if request was aborted
      if (err.name === 'AbortError') return;
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to load programs';
      toast.error(msg);
    } finally {
      setProgramsLoading(false);
    }
  };

  // ── Auto-selection engine ───────────────────────────────────────────────────

  /**
   * Automatically selects the appropriate session when a program is chosen
   * 
   * Selection Rules:
   * 1. Filter sessions where session_date === today's date (YYYY-MM-DD)
   * 2. If exactly 1 session found → auto-select it
   * 3. If multiple sessions found → select the one with earliest start_time
   * 4. If no sessions found → leave selection empty, show all sessions
   * 
   * @param sessions - All sessions for the program
   * @returns Selected session ID or null
   */
  const autoSelectTodaySession = useCallback((sessions: ProgramSession[]): string | null => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Filter sessions for today
    const todaySessions = sessions.filter(
      session => session.session_date === today
    );
    
    if (todaySessions.length === 0) {
      console.log(`[Auto-Selection] No sessions found for today (${today})`);
      return null;
    }
    
    if (todaySessions.length === 1) {
      console.log(`[Auto-Selection] Single session found for today:`, todaySessions[0].id);
      return todaySessions[0].id;
    }
    
    // Multiple sessions today - select earliest start_time
    const sorted = [...todaySessions].sort((a, b) => 
      a.start_time.localeCompare(b.start_time)
    );
    
    console.log(`[Auto-Selection] Multiple sessions today, selecting earliest:`, sorted[0].id);
    return sorted[0].id;
  }, []);

  // ── Sessions loader by program ───────────────────────────────────────────────

  const loadSessionsForProgram = async (programId: string) => {
    setSessionsLoading(true);
    setSelectedSessionId('');
    try {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      const res = await sessionService.getSessionsByProgram(programId);
      // Sort: most recent date first, then by start time
      const sorted = (res.data ?? []).sort((a, b) =>
        b.session_date.localeCompare(a.session_date) || a.start_time.localeCompare(b.start_time)
      );
      setTodaySessions(sorted);
      
      // Trigger auto-selection after sessions are loaded
      const autoSelectedId = autoSelectTodaySession(sorted);
      if (autoSelectedId) {
        setSelectedSessionId(autoSelectedId);
      }
    } catch (err: any) {
      // Don't show error if request was aborted
      if (err.name === 'AbortError') return;
      toast.error('Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Lazy load jsQR library when modal opens
  useEffect(() => {
    if (isOpen && !jsQR) {
      import('jsqr').then(module => {
        setJsQR(() => module.default);
      }).catch(err => {
        console.error('Failed to load jsQR:', err);
        toast.error('Failed to load QR scanner library');
      });
    }
  }, [isOpen, jsQR]);

  useEffect(() => {
    if (!hasScannerAccess || !isOpen) return;
    startCamera();
    return () => {
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasScannerAccess, selectedDeviceId, isOpen]);

  useEffect(() => {
    if (!canSwitchModes) {
      const forcedMode: ScanMode = canScanItems ? 'item' : 'attendance';
      if (mode !== forcedMode) {
        setMode(forcedMode);
      }
    }
  }, [canSwitchModes, canScanItems, mode]);

  useEffect(() => {
    if (!hasScannerAccess && !accessToastShownRef.current && isOpen) {
      accessToastShownRef.current = true;
      toast.error('You do not have permission to use the QR scanner.');
    }
  }, [hasScannerAccess, isOpen]);

  useEffect(() => {
    if (mode === 'attendance' && isOpen) loadPrograms();
    // Reset results on mode switch
    setScannedItem(null);
    setAttendanceResult(null);
    setSelectedProgramId(initialProgramId || '');
    setSelectedSessionId(initialSessionId || '');
    setTodaySessions([]);
    setScanCount(0);
    setScanHistory([]);
    setScannerPaused(false);
    setManualCode('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isOpen]);

  // Load sessions when a program is selected
  useEffect(() => {
    if (selectedProgramId && isOpen) loadSessionsForProgram(selectedProgramId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, isOpen]);

  // Reset scan count when session changes
  useEffect(() => {
    setScanCount(0);
  }, [selectedSessionId]);

  // Announce session selection to screen readers
  useEffect(() => {
    if (selectedSessionId && isOpen) {
      const session = todaySessions.find(s => s.id === selectedSessionId);
      if (session) {
        announce(`Session selected: ${session.title}`);
      }
    }
  }, [selectedSessionId, todaySessions, isOpen, announce]);

  // Announce attendance results to screen readers
  useEffect(() => {
    if (attendanceResult && isOpen) {
      announce(`Attendance recorded for ${attendanceResult.trainee_name || 'trainee'}`);
    }
  }, [attendanceResult, isOpen, announce]);

  // Restart decode loop when mode or session changes
  useEffect(() => {
    if (stream && videoRef.current && isOpen && jsQR) startDecoding();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedSessionId, scannerPaused, isOpen, jsQR]);

  // Live clock – tick every second
  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  // ── Helper functions and computed values ─────────────────────────────────────

  const isAttendanceReady = mode === 'attendance' && !!selectedSessionId;
  const cornerClass = mode === 'item'
    ? 'border-blue-300'
    : isAttendanceReady ? 'border-blue-400' : 'border-blue-200/60';
  const scanLineClass = mode === 'item'
    ? 'bg-blue-400'
    : isAttendanceReady ? 'bg-blue-300' : 'bg-blue-200/60';
  const modeBadgeClass = mode === 'item'
    ? 'border-blue-300/40 bg-blue-500/15 text-blue-100'
    : 'border-blue-200/45 bg-blue-400/20 text-white';
  const readinessClass = cameraError
    ? 'border-blue-200/45 bg-blue-500/20 text-blue-100'
    : (mode === 'attendance' && !isAttendanceReady)
      ? 'border-blue-200/45 bg-blue-500/20 text-blue-50'
      : 'border-blue-300/45 bg-blue-500/20 text-blue-100';
  const readinessLabel = cameraError
    ? 'Camera Offline'
    : (mode === 'attendance' && !isAttendanceReady)
      ? 'Awaiting Session'
      : 'Ready to Scan';

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedSession = todaySessions.find(s => s.id === selectedSessionId) ?? null;
  
  // Memoize session filtering for performance
  const todaySessionsList = useMemo(() => 
    todaySessions.filter(s => s.session_date === todayStr),
    [todaySessions, todayStr]
  );
  
  const otherSessionsList = useMemo(() => 
    todaySessions.filter(s => s.session_date !== todayStr),
    [todaySessions, todayStr]
  );

  const formatTime12 = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  };
  
  const formatSessionDate = (dateStr: string) => {
    if (dateStr === todayStr) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else {
      document.body.style.overflow = '';
      // Restore previous focus
      previousFocusRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keyboard navigation (ESC to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      // Abort any pending API requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Reset state
      setSelectedProgramId(initialProgramId || '');
      setSelectedSessionId(initialSessionId || '');
      setScanCount(0);
      setScanHistory([]);
      setScannedItem(null);
      setAttendanceResult(null);
    }
  }, [isOpen, initialProgramId, initialSessionId]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-title"
      aria-describedby="scanner-description"
      ref={modalRef}
    >
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl sm:h-[88vh] sm:max-h-[760px] sm:max-w-[920px] lg:max-w-[980px]">
        <canvas ref={canvasRef} className="hidden" />

      {/* ── Top control bar ─────────────────────────────────────────────────── */}
      <div className="relative shrink-0 overflow-hidden border-b border-white/[0.08] bg-gradient-to-b from-black via-gray-950 to-gray-950">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-12 -top-16 size-44 rounded-full bg-blue-500/16 blur-3xl" />
          <div className="absolute right-0 top-0 size-40 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Title row */}
        <div className="relative z-10 flex items-center justify-between px-3 pt-3 pb-2">
          <Button
            variant="ghost" size="icon"
            className="size-9 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
            onClick={handleClose}
            aria-label="Close scanner"
          >
            <X className="size-5" />
          </Button>

          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/35">
                <QrCode className="size-4 text-primary" />
              </div>
              <span id="scanner-title" className="text-sm font-semibold text-white tracking-wide">Live QR Scanner</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/35">
              <Calendar className="size-2.5" />
              <span>{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="text-white/20">·</span>
              <Clock className="size-2.5" />
              <span className="font-mono tabular-nums text-white/55">
                {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>

          {!cameraError ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={`size-9 rounded-xl transition-all ${scannerPaused ? 'text-amber-200 bg-amber-500/20 hover:bg-amber-500/30' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                onClick={() => setScannerPaused(prev => !prev)}
              >
                {scannerPaused ? <Play className="size-4.5" /> : <Pause className="size-4.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`size-9 rounded-xl transition-all ${torch ? 'text-blue-200 bg-blue-500/20 hover:bg-blue-500/30' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                onClick={toggleTorch}
              >
                {torch ? <Flashlight className="size-5" /> : <FlashlightOff className="size-5" />}
              </Button>
            </div>
          ) : (
            <div className="size-9" />
          )}
        </div>

        {/* Mode toggle */}
        <div className="relative z-10 flex justify-center px-4 pb-2">
          {canSwitchModes ? (
            <div className="flex items-center overflow-hidden rounded-xl border border-white/15 bg-white/[0.06] shadow-lg shadow-black/35 backdrop-blur-sm">
              <button
                className={`flex items-center gap-1.5 px-5 py-2 text-sm font-semibold transition-all duration-200 ${mode === 'item' ? 'bg-gradient-to-r from-blue-100 to-white text-slate-900' : 'text-white/55 hover:text-white hover:bg-white/10'}`}
                onClick={() => setMode('item')}
              >
                <Package className="size-4" />Items
              </button>
              <div className="h-5 w-px bg-white/15" />
              <button
                className={`flex items-center gap-1.5 px-5 py-2 text-sm font-semibold transition-all duration-200 ${mode === 'attendance' ? 'bg-gradient-to-r from-white to-blue-100 text-slate-900' : 'text-white/55 hover:text-white hover:bg-white/10'}`}
                onClick={() => setMode('attendance')}
              >
                <Users className="size-4" />Attendance
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/85 shadow-lg shadow-black/35 backdrop-blur-sm">
              {canScanItems ? <Package className="size-4 text-blue-200" /> : <Users className="size-4 text-blue-200" />}
              {canScanItems ? 'Item Scanner Only' : 'Attendance Scanner Only'}
            </div>
          )}
        </div>

        {/* Status chips */}
        <div className="relative z-10 px-4 pb-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${modeBadgeClass}`}>
              <ScanLine className="size-3" />
              {mode === 'item' ? 'Item Mode' : 'Attendance Mode'}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${readinessClass}`}>
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-2 animate-ping rounded-full bg-current opacity-50" />
                <span className="relative inline-flex size-2 rounded-full bg-current" />
              </span>
              {readinessLabel}
            </span>
            {scanCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/75">
                <CheckCircle2 className="size-3 text-blue-200" />
                {scanCount} scans
              </span>
            )}
            {!canSwitchModes && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-300/35 bg-indigo-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
                Role Restricted
              </span>
            )}
          </div>
        </div>

        {/* Quick scanner tools */}
        {!cameraError && hasScannerAccess && (
          <div className="relative z-10 px-4 pb-3 space-y-2">
            <div className="h-px bg-white/[0.06]" />
            <div className="flex flex-col gap-2 md:flex-row">
              {videoDevices.length > 1 && (
                <Select value={selectedDeviceId} onValueChange={handleCameraDeviceChange}>
                  <SelectTrigger className="md:w-64 h-10 rounded-xl bg-white/[0.08] border-white/15 text-white text-xs">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoDevices.map((device, index) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        Camera {index + 1}{device.label ? ` - ${device.label}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/45" />
                  <Input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleManualCodeSubmit();
                      }
                    }}
                    placeholder={mode === 'item' ? 'Paste item QR/id...' : 'Paste trainee QR...'}
                    className="h-10 rounded-xl bg-white/[0.08] border-white/15 text-white placeholder:text-white/45 text-sm pl-9"
                  />
                </div>
                <Button
                  onClick={() => void handleManualCodeSubmit()}
                  disabled={!manualCode.trim() || itemLoading || attendanceLoading}
                  className="h-10 rounded-xl px-4 text-xs font-semibold"
                >
                  Scan
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Attendance selectors */}
        {mode === 'attendance' && canScanAttendance && !attendanceResult && (
          <div className="relative z-10 px-4 pb-4 space-y-2.5">
            <div className="h-px bg-white/[0.06]" />

            {/* Program */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <span className="size-1.5 rounded-full bg-blue-300 inline-block" />
                Program
              </label>
              {programsLoading ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-10 w-full rounded-xl bg-white/10" />
                  <Skeleton className="h-10 w-4/5 rounded-xl bg-white/10" />
                </div>
              ) : programs.length === 0 ? (
                <p className="text-sm text-white/40 py-1.5">No programs available.</p>
              ) : (
                <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                  <SelectTrigger className="bg-white/[0.08] border-white/15 text-white h-10 text-sm rounded-xl">
                    <SelectValue placeholder="Choose a program…" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Session chips */}
            {selectedProgramId && (
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  <span className="size-1.5 rounded-full bg-blue-300 inline-block" />
                  Session
                  {todaySessionsList.length > 0 && (
                    <span className="ml-auto rounded-full bg-blue-500/25 px-1.5 py-0.5 text-[9px] font-bold text-blue-200 normal-case tracking-normal">
                      {todaySessionsList.length} today
                    </span>
                  )}
                </label>
                {sessionsLoading ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="shrink-0 h-[68px] w-[88px] rounded-xl bg-white/10 animate-pulse" />
                    ))}
                  </div>
                ) : todaySessions.length === 0 ? (
                  <p className="text-sm text-white/40 py-1.5">No sessions for this program.</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                    {todaySessionsList.map(s => {
                      const active = selectedSessionId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSessionId(s.id)}
                          className={`shrink-0 flex flex-col rounded-xl border px-3 py-2.5 text-left transition-all min-w-[88px] max-w-[120px] ${
                            active
                              ? 'border-blue-300/70 bg-blue-500/20'
                              : 'border-white/10 bg-white/[0.05] hover:border-white/25 hover:bg-white/[0.08]'
                          }`}
                        >
                          <span className={`text-[8px] font-bold uppercase tracking-wider leading-none mb-1.5 ${
                            active ? 'text-blue-200' : 'text-white/35'
                          }`}>Today</span>
                          <span className={`text-[11px] font-semibold truncate leading-tight ${
                            active ? 'text-white' : 'text-white/65'
                          }`}>{s.title}</span>
                          <span className={`text-[9px] mt-1.5 font-mono tabular-nums ${
                            active ? 'text-blue-200/80' : 'text-white/30'
                          }`}>{formatTime12(s.start_time)}</span>
                        </button>
                      );
                    })}
                    {todaySessionsList.length > 0 && otherSessionsList.length > 0 && (
                      <div className="self-stretch w-px bg-white/[0.08] shrink-0 my-1" />
                    )}
                    {otherSessionsList.map(s => {
                      const active = selectedSessionId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSessionId(s.id)}
                          className={`shrink-0 flex flex-col rounded-xl border px-3 py-2.5 text-left transition-all min-w-[88px] max-w-[120px] ${
                            active
                              ? 'border-blue-300/70 bg-blue-500/20'
                              : 'border-white/10 bg-white/[0.05] hover:border-white/25 hover:bg-white/[0.08]'
                          }`}
                        >
                          <span className={`text-[8px] font-bold uppercase tracking-wider leading-none mb-1.5 ${
                            active ? 'text-blue-200' : 'text-white/35'
                          }`}>{formatSessionDate(s.session_date)}</span>
                          <span className={`text-[11px] font-semibold truncate leading-tight ${
                            active ? 'text-white' : 'text-white/65'
                          }`}>{s.title}</span>
                          <span className={`text-[9px] mt-1.5 font-mono tabular-nums ${
                            active ? 'text-blue-200/80' : 'text-white/30'
                          }`}>{formatTime12(s.start_time)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Session info card / status */}
            <div>
              {selectedSessionId && selectedSession ? (
                <div className="rounded-xl bg-white/[0.05] border border-blue-400/25 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-blue-300 animate-pulse inline-block" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Active Session</span>
                    {scanCount > 0 && (
                      <span className="ml-auto flex items-center gap-1 rounded-full bg-blue-500/25 px-2 py-0.5">
                        <CheckCircle2 className="size-2.5 text-blue-200" />
                        <span className="text-[10px] font-bold text-blue-200">{scanCount} scanned</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-white leading-tight">{selectedSession.title}</p>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-white/45">
                    <span className="flex items-center gap-1">
                      <CalendarCheck className="size-3 text-white/30" />
                      {formatSessionDate(selectedSession.session_date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 text-white/30" />
                      {formatTime12(selectedSession.start_time)} – {formatTime12(selectedSession.end_time)}
                    </span>
                    {selectedSession.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3 text-white/30" />
                        {selectedSession.location}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] border border-white/10 px-3 py-1 text-xs text-white/40">
                    {selectedProgramId ? 'Select a session above to begin' : 'Select a program to continue'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attendance success flash */}
        {mode === 'attendance' && attendanceResult && (
          <div className="px-4 pb-4">
            <div className="h-px bg-white/[0.06] mb-3" />
            <div className="rounded-2xl border border-blue-400/30 bg-blue-500/15 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/25">
                  <CheckCircle2 className="size-5 text-blue-100" />
                </div>
                <div className="flex-1 min-w-0">
                  {attendanceResult.trainee_name && (
                    <p className="font-semibold text-sm text-white truncate">{attendanceResult.trainee_name}</p>
                  )}
                  <p className="text-xs text-blue-100/85">{attendanceResult.message}</p>
                </div>
                <Badge className="capitalize border-0 shrink-0 bg-blue-500/30 text-xs font-semibold text-blue-100">
                  {attendanceResult.status}
                </Badge>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5 border-t border-blue-400/20 pt-2.5 text-[10px] text-blue-100/65">
                <Clock className="size-3 shrink-0" />
                <span>Logged at <span className="font-mono font-semibold">{attendanceResult.scanned_at}</span></span>
                {scanCount > 0 && (
                  <><span className="mx-1 opacity-30">·</span><span>{scanCount} total this session</span></>
                )}
              </div>
            </div>
          </div>
        )}

        <p id="scanner-description" className="sr-only">
          Scan QR codes for inventory items or trainee attendance
        </p>
      </div>

      {/* ── Camera / scan area ──────────────────────────────────────────────── */}
      <div className="flex-1 bg-white p-3">
        <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
        {!hasScannerAccess && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-gray-900 to-black p-8">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-500/15 ring-1 ring-blue-400/30">
              <AlertCircle className="size-8 text-blue-200" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-lg font-semibold text-white">Scanner Access Restricted</p>
              <p className="max-w-sm text-sm text-white/60">
                Your account does not have access to QR scanner tools.
              </p>
            </div>
            <Button className="rounded-xl px-6" onClick={handleClose}>Close Scanner</Button>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`size-full object-cover ${cameraError ? 'hidden' : ''}`}
        />

        {!cameraError && hasScannerAccess && <div className="scan-overlay absolute inset-0 pointer-events-none" />}

        {!cameraError && hasScannerAccess && !scannedItem && (
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-[5] flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 backdrop-blur-sm">
              <Camera className="size-3" />
              Live Camera
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 backdrop-blur-sm">
              <QrCode className="size-3" />
              {mode === 'item' ? 'Inventory' : 'Attendance'}
            </span>
          </div>
        )}

        {!cameraError && hasScannerAccess && scanHistory.length > 0 && !scannedItem && (
          <div className="absolute right-3 top-16 z-[6] w-56 rounded-xl border border-white/15 bg-black/55 backdrop-blur-md p-2.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/55">Recent Scans</p>
            <div className="space-y-1.5">
              {scanHistory.map(entry => (
                <div key={entry.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-white/85">{entry.label}</p>
                    <span className="text-[10px] text-white/45 font-mono">{entry.scanned_at}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] capitalize text-white/55">{entry.mode} - {entry.status}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="flex size-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-gray-900 to-black p-8">
            <div className="relative">
              <div className="flex size-20 items-center justify-center rounded-3xl bg-blue-500/10 ring-1 ring-blue-400/25">
                <AlertCircle className="size-10 text-blue-200" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-blue-500/90">
                <X className="size-3 text-white" />
              </div>
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-base font-semibold text-white">{cameraError}</p>
              {permissionDenied && (
                <p className="text-sm text-white/50 max-w-[260px] leading-relaxed">
                  Allow camera access in your browser settings, then tap Try Again
                </p>
              )}
            </div>
            <Button onClick={() => startCamera()} size="lg" className="gap-2 rounded-xl px-6">
              <Camera className="size-4" />Try Again
            </Button>
          </div>
        )}

        {/* Viewfinder */}
        {!cameraError && hasScannerAccess && (mode === 'item' || (mode === 'attendance' && !attendanceResult)) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative size-64" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.52)' }}>
              <div className={`viewfinder-pulse absolute -inset-3 rounded-[1.7rem] border ${mode === 'item' ? 'border-blue-300/45' : isAttendanceReady ? 'border-blue-300/45' : 'border-white/20'}`} />
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/10" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/10" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/10" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/10" />
              <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.55)]" />
              <div className={`corner-breathe absolute left-0 top-0 size-9 border-l-[3px] border-t-[3px] rounded-tl ${cornerClass}`} />
              <div className={`corner-breathe absolute right-0 top-0 size-9 border-r-[3px] border-t-[3px] rounded-tr ${cornerClass}`} />
              <div className={`corner-breathe absolute bottom-0 left-0 size-9 border-b-[3px] border-l-[3px] rounded-bl ${cornerClass}`} />
              <div className={`corner-breathe absolute bottom-0 right-0 size-9 border-b-[3px] border-r-[3px] rounded-br ${cornerClass}`} />
              {(mode === 'item' || isAttendanceReady) && (
                <>
                  <div className={`scan-line absolute inset-x-3 h-[6px] -translate-y-[2px] ${scanLineClass} opacity-20 blur-sm rounded-full`} />
                  <div className={`scan-line absolute inset-x-1 h-[2px] ${scanLineClass} rounded-full opacity-90`} />
                </>
              )}
            </div>
          </div>
        )}

        {/* Hint pill */}
        {!cameraError && hasScannerAccess && !scannedItem && !attendanceResult && (
          <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
            <span className={`inline-flex items-center gap-2 rounded-full border backdrop-blur-md px-4 py-2 text-sm ${mode === 'item' ? 'bg-blue-500/15 border-blue-300/35 text-blue-100' : isAttendanceReady ? 'bg-blue-500/15 border-blue-300/35 text-blue-100' : 'bg-black/55 border-white/10 text-white/75'}`}>
              <ScanLine className="size-3.5" />
              {scannerPaused
                ? 'Scanner is paused. Tap play to resume.'
                : mode === 'item'
                ? 'Align item QR code within the frame'
                : isAttendanceReady
                  ? 'Align trainee QR code within the frame'
                  : 'Select a session above to begin scanning'}
            </span>
          </div>
        )}

        {/* Processing overlay */}
        {(itemLoading || attendanceLoading) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-gray-900/90 border border-white/10 p-7 shadow-2xl">
              <Skeleton className="size-10 rounded-full bg-white/20" />
              <Skeleton className="h-4 w-40 bg-white/20" />
              <p className="sr-only">{itemLoading ? 'Looking up item…' : 'Recording attendance…'}</p>
            </div>
          </div>
        )}

        {/* Item scan result */}
        {scannedItem && (
          <div className="slide-up absolute bottom-0 left-0 right-0 z-10 rounded-t-3xl bg-gray-950 border-t border-white/[0.08] shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500/25 via-blue-400/15 to-transparent px-5 pt-5 pb-4">
              <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-3" />
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 ring-1 ring-blue-300/35">
                  <QrCode className="size-6 text-blue-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-200/85">Item Found</p>
                  <h3 className="font-bold text-white truncate text-base leading-tight">{scannedItem.item.name}</h3>
                  <p className="text-sm text-white/50">{scannedItem.item.category}</p>
                </div>
                {scannedItem.item.condition && (
                  <Badge variant="outline" className="shrink-0 border-white/20 text-white/60 text-xs">
                    {scannedItem.item.condition}
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-y border-white/[0.06] bg-white/[0.02]">
              <div className="px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35 mb-0.5">Available</p>
                <p className={`text-xl font-bold ${scannedItem.item.available_quantity > 0 ? 'text-blue-200' : 'text-white/65'}`}>
                  {scannedItem.item.available_quantity}
                </p>
              </div>
              <div className="px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35 mb-0.5">Total</p>
                <p className="text-xl font-bold text-white">{scannedItem.item.quantity}</p>
              </div>
              <div className="px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35 mb-0.5">Location</p>
                <p className="text-sm font-medium text-white/80 truncate mt-1">{scannedItem.item.location ?? '—'}</p>
              </div>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  size="lg"
                  className="w-full rounded-xl gap-2 font-semibold"
                  disabled={scannedItem.item.available_quantity === 0}
                  onClick={handleClose}
                >
                  <CheckCircle2 className="size-4" />Borrow
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-xl gap-2 border-white/15 bg-white/[0.06] text-white hover:bg-white/10 font-semibold"
                  onClick={handleClose}
                >
                  Return
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full rounded-xl text-white/45 hover:text-white hover:bg-white/[0.07]"
                onClick={() => { setScannedItem(null); triggerCooldown(500); }}
              >
                Scan Another
              </Button>
            </div>
          </div>
        )}
        </div>
      </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
