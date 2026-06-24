// Security Utilities for BMDC System
// Comprehensive security functions for authentication, authorization, and data protection

import { hash, compare } from 'bcryptjs';
import { sign, verify, type SignOptions } from 'jsonwebtoken';
import logger from './logger';

// ============================================
// SECURITY CONSTANTS
// ============================================

export const SECURITY_CONFIG = {
  // Password Requirements
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    saltRounds: 12, // For bcrypt hashing
  },

  // Session Configuration
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    refreshThreshold: 30 * 60 * 1000, // Refresh token if < 30 minutes remaining
    absoluteTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days absolute max
  },

  // Login Attempt Limits
  loginAttempts: {
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    resetAfter: 60 * 60 * 1000, // Reset counter after 1 hour of no attempts
  },

  // JWT Configuration
  jwt: {
    accessTokenExpiry: '15m', // 15 minutes
    refreshTokenExpiry: '7d', // 7 days
    algorithm: 'HS256' as const,
  },

  // Rate Limiting
  rateLimit: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
    },
    api: {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 100,
    },
  },

  // Content Security
  contentSecurity: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedDocumentTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
};

// ============================================
// PASSWORD SECURITY
// ============================================

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
} {
  const errors: string[] = [];
  const config = SECURITY_CONFIG.password;

  // Length check
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  }
  if (password.length > config.maxLength) {
    errors.push(`Password must not exceed ${config.maxLength} characters`);
  }

  // Character requirements
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (config.requireSpecialChars && !new RegExp(`[${config.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`).test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }

  // Common password check
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123', 'admin123'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password is too common. Please choose a more unique password');
  }

  // Sequential characters check
  if (/012|123|234|345|456|567|678|789|abc|bcd|cde|def|efg/i.test(password)) {
    errors.push('Password contains sequential characters. Please avoid patterns');
  }

  // Calculate strength
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong' = 'weak';
  if (errors.length === 0) {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = new RegExp(`[${config.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`).test(password);
    const lengthScore = password.length >= 12 ? 2 : password.length >= 10 ? 1 : 0;

    const score = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0) + lengthScore;

    if (score >= 7) strength = 'very-strong';
    else if (score >= 5) strength = 'strong';
    else if (score >= 4) strength = 'medium';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const validation = validatePasswordStrength(password);
  
  if (!validation.isValid) {
    throw new Error(`Weak password: ${validation.errors.join(', ')}`);
  }

  return hash(password, SECURITY_CONFIG.password.saltRounds);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash);
}

/**
 * Generate secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = '';
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill remaining length
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// ============================================
// JWT TOKEN MANAGEMENT
// ============================================

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'Administrator' | 'Staff';
  permissions: string[];
  sessionId: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, secret: string): string {
  const options: SignOptions = {
    expiresIn: SECURITY_CONFIG.jwt.accessTokenExpiry as SignOptions['expiresIn'],
    algorithm: SECURITY_CONFIG.jwt.algorithm,
  };

  return sign(payload, secret, options);
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(payload: { userId: string; sessionId: string }, secret: string): string {
  const options: SignOptions = {
    expiresIn: SECURITY_CONFIG.jwt.refreshTokenExpiry as SignOptions['expiresIn'],
    algorithm: SECURITY_CONFIG.jwt.algorithm,
  };

  return sign(payload, secret, options);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    const decoded = verify(token, secret, {
      algorithms: [SECURITY_CONFIG.jwt.algorithm],
    }) as TokenPayload;
    
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Check if token needs refresh
 */
export function shouldRefreshToken(token: TokenPayload): boolean {
  if (!token.exp) return true;
  
  const expiresIn = token.exp * 1000 - Date.now();
  return expiresIn < SECURITY_CONFIG.session.refreshThreshold;
}

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Sanitize string input (prevent XSS)
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers (onclick, onerror, etc.)
    .replace(/\0/g, ''); // Remove null bytes
}

/**
 * Sanitize HTML (allow safe tags only)
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';
  
  // Remove all tags except allowed ones
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  return sanitized;
}

/**
 * Escape SQL input (use with parameterized queries)
 */
export function escapeSqlInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/'/g, "''") // Escape single quotes
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/\0/g, '\\0') // Escape null bytes
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, '');
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    
    return parsed.toString();
  } catch {
    return null;
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomStr}`;
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session: Session): boolean {
  const now = new Date();
  
  // Check absolute expiration
  if (now > session.expiresAt) {
    return true;
  }
  
  // Check inactivity timeout
  const inactiveTime = now.getTime() - session.lastActivity.getTime();
  if (inactiveTime > SECURITY_CONFIG.session.absoluteTimeout) {
    return true;
  }
  
  return false;
}

/**
 * Check if session needs refresh
 */
export function shouldRefreshSession(session: Session): boolean {
  const now = new Date();
  const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();
  return timeUntilExpiry < SECURITY_CONFIG.session.refreshThreshold;
}

// ============================================
// RATE LIMITING
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check rate limit for identifier (e.g., IP address, user ID)
 */
export function checkRateLimit(
  identifier: string,
  type: 'login' | 'api' = 'api'
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = SECURITY_CONFIG.rateLimit[type];
  const now = Date.now();
  const key = `${type}:${identifier}`;
  
  // Clean up expired entries
  for (const [k, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(k);
    }
  }
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    // Create new entry
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }
  
  // Increment count
  entry.count++;
  
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const resetIn = entry.resetAt - now;
  
  return { allowed, remaining, resetIn };
}

// ============================================
// LOGIN ATTEMPT TRACKING
// ============================================

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const loginAttemptStore = new Map<string, LoginAttempt>();

/**
 * Record failed login attempt
 */
export function recordFailedLogin(identifier: string): {
  isLocked: boolean;
  attemptsRemaining: number;
  lockedUntil: Date | null;
} {
  const config = SECURITY_CONFIG.loginAttempts;
  const now = Date.now();
  
  let attempt = loginAttemptStore.get(identifier);
  
  if (!attempt) {
    attempt = {
      count: 1,
      firstAttempt: now,
      lockedUntil: null,
    };
  } else {
    // Reset counter if enough time has passed
    if (now - attempt.firstAttempt > config.resetAfter) {
      attempt = {
        count: 1,
        firstAttempt: now,
        lockedUntil: null,
      };
    } else {
      attempt.count++;
    }
  }
  
  // Lock account if max attempts reached
  if (attempt.count >= config.maxAttempts) {
    attempt.lockedUntil = now + config.lockoutDuration;
  }
  
  loginAttemptStore.set(identifier, attempt);
  
  return {
    isLocked: attempt.lockedUntil !== null && attempt.lockedUntil > now,
    attemptsRemaining: Math.max(0, config.maxAttempts - attempt.count),
    lockedUntil: attempt.lockedUntil ? new Date(attempt.lockedUntil) : null,
  };
}

/**
 * Check if account is locked
 */
export function isAccountLocked(identifier: string): {
  isLocked: boolean;
  lockedUntil: Date | null;
} {
  const attempt = loginAttemptStore.get(identifier);
  const now = Date.now();
  
  if (!attempt || !attempt.lockedUntil) {
    return { isLocked: false, lockedUntil: null };
  }
  
  if (attempt.lockedUntil < now) {
    // Lock expired, clear it
    attempt.lockedUntil = null;
    attempt.count = 0;
    return { isLocked: false, lockedUntil: null };
  }
  
  return {
    isLocked: true,
    lockedUntil: new Date(attempt.lockedUntil),
  };
}

/**
 * Clear failed login attempts (on successful login)
 */
export function clearFailedLogins(identifier: string): void {
  loginAttemptStore.delete(identifier);
}

// ============================================
// AUTHORIZATION / PERMISSIONS
// ============================================

export type Permission = 
  // Trainee Permissions
  | 'canViewTrainees'
  | 'canCreateTrainee'
  | 'canEditTrainee'
  | 'canDeleteTrainee'
  | 'canExportTrainees'
  
  // Inventory Permissions
  | 'canViewInventory'
  | 'canCreateInventory'
  | 'canEditInventory'
  | 'canDeleteInventory'
  | 'canExportInventory'
  
  // Lending Permissions
  | 'canViewLendings'
  | 'canCreateLending'
  | 'canReturnLending'
  | 'canCancelLending'
  | 'canExportLendings'
  
  // Program Permissions
  | 'canViewPrograms'
  | 'canCreateProgram'
  | 'canEditProgram'
  | 'canDeleteProgram'
  | 'canPublishProgram'
  | 'canExportPrograms'
  
  // User Management Permissions
  | 'canViewUsers'
  | 'canCreateUser'
  | 'canEditUser'
  | 'canDeleteUser'
  | 'canManageRoles'
  
  // Anomaly Detection Permissions
  | 'canViewAnomalies'
  | 'canResolveAnomalies'
  | 'canExportAnomalies'
  | 'canTriggerDetection'
  
  // Activity Log Permissions
  | 'canViewActivityLogs'
  | 'canExportActivityLogs'
  
  // Reports Permissions
  | 'canViewReports'
  | 'canGenerateReports'
  | 'canExportReports'
  
  // System Settings Permissions
  | 'canViewSettings'
  | 'canEditSettings'
  | 'canManageBackup';

export const ROLE_PERMISSIONS: Record<'Administrator' | 'Staff', Permission[]> = {
  Administrator: [
    // All permissions (super user)
    'canViewTrainees', 'canCreateTrainee', 'canEditTrainee', 'canDeleteTrainee', 'canExportTrainees',
    'canViewInventory', 'canCreateInventory', 'canEditInventory', 'canDeleteInventory', 'canExportInventory',
    'canViewLendings', 'canCreateLending', 'canReturnLending', 'canCancelLending', 'canExportLendings',
    'canViewPrograms', 'canCreateProgram', 'canEditProgram', 'canDeleteProgram', 'canPublishProgram', 'canExportPrograms',
    'canViewUsers', 'canCreateUser', 'canEditUser', 'canDeleteUser', 'canManageRoles',
    'canViewAnomalies', 'canResolveAnomalies', 'canExportAnomalies', 'canTriggerDetection',
    'canViewActivityLogs', 'canExportActivityLogs',
    'canViewReports', 'canGenerateReports', 'canExportReports',
    'canViewSettings', 'canEditSettings', 'canManageBackup',
  ],
  
  Staff: [
    // Limited permissions
    // Trainees (View, Create, Edit only - assigned to Staff 1)
    'canViewTrainees', 'canCreateTrainee', 'canEditTrainee', 'canExportTrainees',
    
    // Inventory (View, Create, Edit only - assigned to Staff 2)
    'canViewInventory', 'canCreateInventory', 'canEditInventory', 'canExportInventory',
    
    // Lendings (View, Create, Return only)
    'canViewLendings', 'canCreateLending', 'canReturnLending', 'canExportLendings',
    
    // Programs (View only)
    'canViewPrograms', 'canExportPrograms',
    
    // Anomalies (View only)
    'canViewAnomalies',
    
    // Activity Logs (NO ACCESS - Administrator only)
    // Activity logs removed for Staff users
    
    // Reports (View and Generate only)
    'canViewReports', 'canGenerateReports', 'canExportReports',
  ],
};

/**
 * Check if user has permission
 */
export function hasPermission(userRole: 'Administrator' | 'Staff', permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions.includes(permission);
}

/**
 * Check if user has all permissions
 */
export function hasAllPermissions(userRole: 'Administrator' | 'Staff', requiredPermissions: Permission[]): boolean {
  return requiredPermissions.every(permission => hasPermission(userRole, permission));
}

/**
 * Check if user has any permission
 */
export function hasAnyPermission(userRole: 'Administrator' | 'Staff', requiredPermissions: Permission[]): boolean {
  return requiredPermissions.some(permission => hasPermission(userRole, permission));
}

/**
 * Get all permissions for role
 */
export function getPermissionsForRole(role: 'Administrator' | 'Staff'): Permission[] {
  return ROLE_PERMISSIONS[role];
}

// ============================================
// SECURITY HEADERS
// ============================================

/**
 * Get security headers for API responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // XSS Protection
    'X-XSS-Protection': '1; mode=block',
    
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
    
    // Permissions Policy
    'Permissions-Policy': [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
    ].join(', '),
    
    // HSTS (for production with HTTPS)
    // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

// ============================================
// FILE UPLOAD SECURITY
// ============================================

/**
 * Validate file upload
 */
export function validateFileUpload(file: File, type: 'image' | 'document'): {
  isValid: boolean;
  error: string | null;
} {
  const config = SECURITY_CONFIG.contentSecurity;
  
  // Check file size
  if (file.size > config.maxFileSize) {
    return {
      isValid: false,
      error: `File size exceeds maximum of ${config.maxFileSize / 1024 / 1024}MB`,
    };
  }
  
  // Check file type
  const allowedTypes = type === 'image' ? config.allowedImageTypes : config.allowedDocumentTypes;
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }
  
  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  const allowedExtensions = type === 'image' 
    ? ['jpg', 'jpeg', 'png', 'gif', 'webp']
    : ['pdf', 'doc', 'docx'];
  
  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      isValid: false,
      error: `File extension .${extension} is not allowed`,
    };
  }
  
  return { isValid: true, error: null };
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .toLowerCase();
}

// ============================================
// AUDIT LOGGING
// ============================================

export interface SecurityAuditLog {
  timestamp: Date;
  eventType: 'login' | 'logout' | 'failed_login' | 'permission_denied' | 'data_access' | 'data_modification' | 'suspicious_activity';
  userId?: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Create security audit log entry
 */
export function createSecurityAuditLog(log: SecurityAuditLog): void {
  // In production, this should write to a backend logging sink.
  // Avoid dumping full details to the browser console (may contain sensitive info).
  logger.debug('Security audit event', {
    timestamp: log.timestamp.toISOString(),
    eventType: log.eventType,
    severity: log.severity,
    userId: log.userId,
  });
  
  // TODO: Implement database logging
  // await db.insert('security_audit_logs', log);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get client IP address from request
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Get user agent from request
 */
export function getUserAgent(headers: Headers): string {
  return headers.get('user-agent') || 'unknown';
}

/**
 * Check if IP is from internal network
 */
export function isInternalIp(ip: string): boolean {
  return (
    ip === 'localhost' ||
    ip === '127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip === '::1'
  );
}

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) return false;
  if (token.length !== expectedToken.length) return false;
  
  // Constant-time comparison to prevent timing attacks
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: any): any {
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken'];
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const masked = { ...data };
  
  for (const key of Object.keys(masked)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      masked[key] = '***REDACTED***';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  
  return masked;
}

/**
 * Check if request is from bot/crawler
 */
export function isBot(userAgent: string): boolean {
  const botPatterns = [
    /bot/i,
    /spider/i,
    /crawler/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
}