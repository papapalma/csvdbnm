// Validation Utilities for BMDC System
// Comprehensive validation rules for all data types

// ============================================
// VALIDATION CONSTANTS
// ============================================

export const VALIDATION_RULES = {
  // Trainee Validation
  trainee: {
    name: {
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-Z\s.\-']+$/,
      message: 'Name must be 2-100 characters, letters only'
    },
    email: {
      pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      message: 'Invalid email format'
    },
    phone: {
      pattern: /^09\d{9}$/,
      message: 'Phone must be 11 digits starting with 09 (e.g., 09123456789)'
    },
    age: {
      min: 15,
      max: 70,
      message: 'Age must be between 15 and 70 years'
    },
    address: {
      minLength: 10,
      maxLength: 200,
      message: 'Address must be 10-200 characters'
    }
  },

  // Inventory Validation
  inventory: {
    name: {
      minLength: 3,
      maxLength: 100,
      message: 'Item name must be 3-100 characters'
    },
    quantity: {
      min: 1,
      max: 10000,
      message: 'Quantity must be between 1 and 10,000'
    },
    serialNumber: {
      pattern: /^[A-Z0-9\-]+$/,
      message: 'Serial number must contain only letters, numbers, and hyphens'
    },
    value: {
      min: 0,
      max: 10000000,
      message: 'Value must be between 0 and 10,000,000'
    }
  },

  // Program Validation
  program: {
    title: {
      minLength: 5,
      maxLength: 100,
      message: 'Program title must be 5-100 characters'
    },
    description: {
      minLength: 20,
      maxLength: 1000,
      message: 'Description must be 20-1,000 characters'
    },
    duration: {
      min: 1,
      max: 365,
      message: 'Duration must be between 1 and 365 days'
    },
    capacity: {
      min: 1,
      max: 100,
      message: 'Capacity must be between 1 and 100 trainees'
    }
  },

  // Lending Validation
  lending: {
    duration: {
      min: 1,
      max: 90,
      message: 'Lending duration must be between 1 and 90 days'
    }
  }
};

// ============================================
// ENHANCED VALIDATION FOR BACKEND COMPATIBILITY
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Enhanced email validation matching backend
export const validateEmailEnhanced = (email: string): string | null => {
  if (!email) return 'Email is required';
  if (email.length > 255) return 'Email must not exceed 255 characters';
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Invalid email address';
  
  return null;
};

// Enhanced phone validation matching backend
export const validatePhoneEnhanced = (phone: string): string | null => {
  if (!phone) return 'Phone number is required';
  if (phone.length < 10) return 'Phone number must be at least 10 characters';
  if (phone.length > 20) return 'Phone number must not exceed 20 characters';
  
  const phoneRegex = /^[0-9+\-\s()]+$/;
  if (!phoneRegex.test(phone)) {
    return 'Phone number can only contain digits, +, -, spaces, and parentheses';
  }
  
  return null;
};

// Enhanced name validation matching backend
export const validateNameEnhanced = (name: string, fieldName: string): string | null => {
  if (!name) return `${fieldName} is required`;
  if (name.length > 100) return `${fieldName} must not exceed 100 characters`;
  
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(name)) {
    return `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`;
  }
  
  return null;
};

// UUID validation
export const validateUUID = (uuid: string, fieldName: string, required: boolean = true): string | null => {
  if (!uuid && required) return `${fieldName} is required`;
  if (!uuid) return null;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) return `Invalid ${fieldName.toLowerCase()}`;
  
  return null;
};

// Comprehensive trainee validation
export const validateTraineeForm = (data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  program?: string;
}): ValidationResult => {
  const errors: Record<string, string> = {};
  
  const firstNameError = validateNameEnhanced(data.firstName, 'First name');
  if (firstNameError) errors.firstName = firstNameError;
  
  const lastNameError = validateNameEnhanced(data.lastName, 'Last name');
  if (lastNameError) errors.lastName = lastNameError;
  
  const emailError = validateEmailEnhanced(data.email);
  if (emailError) errors.email = emailError;
  
  const phoneError = validatePhoneEnhanced(data.phone);
  if (phoneError) errors.phone = phoneError;
  
  if (data.program) {
    const programError = validateUUID(data.program, 'Program', false);
    if (programError) errors.program = programError;
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ============================================
// BASIC VALIDATION FUNCTIONS
// ============================================

/**
 * Check if a value is empty (null, undefined, empty string, or whitespace only)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Validate required field
 */
export function validateRequired(value: any, fieldName: string): string | null {
  if (isEmpty(value)) {
    return `${fieldName} is required`;
  }
  return null;
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  minLength: number,
  maxLength: number,
  fieldName: string
): string | null {
  if (isEmpty(value)) return null; // Use validateRequired for required check
  
  const length = value.trim().length;
  
  if (length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }
  
  if (length > maxLength) {
    return `${fieldName} must not exceed ${maxLength} characters`;
  }
  
  return null;
}

/**
 * Validate pattern (regex)
 */
export function validatePattern(
  value: string,
  pattern: RegExp,
  errorMessage: string
): string | null {
  if (isEmpty(value)) return null;
  
  if (!pattern.test(value)) {
    return errorMessage;
  }
  
  return null;
}

/**
 * Validate number range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): string | null {
  if (value === null || value === undefined) return null;
  
  if (isNaN(value)) {
    return `${fieldName} must be a valid number`;
  }
  
  if (value < min) {
    return `${fieldName} must be at least ${min}`;
  }
  
  if (value > max) {
    return `${fieldName} must not exceed ${max}`;
  }
  
  return null;
}

/**
 * Validate date
 */
export function validateDate(value: string | Date, fieldName: string): string | null {
  if (isEmpty(value)) return null;
  
  const date = new Date(value);
  
  if (isNaN(date.getTime())) {
    return `${fieldName} must be a valid date`;
  }
  
  return null;
}

/**
 * Validate date range (end date must be after start date)
 */
export function validateDateRange(
  startDate: string | Date,
  endDate: string | Date,
  startFieldName: string = 'Start date',
  endFieldName: string = 'End date'
): string | null {
  if (isEmpty(startDate) || isEmpty(endDate)) return null;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid date format';
  }
  
  if (end <= start) {
    return `${endFieldName} must be after ${startFieldName}`;
  }
  
  return null;
}

/**
 * Validate future date (must be in the future)
 */
export function validateFutureDate(value: string | Date, fieldName: string): string | null {
  if (isEmpty(value)) return null;
  
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (date < today) {
    return `${fieldName} must be in the future`;
  }
  
  return null;
}

/**
 * Validate past date (must be in the past)
 */
export function validatePastDate(value: string | Date, fieldName: string): string | null {
  if (isEmpty(value)) return null;
  
  const date = new Date(value);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  if (date > today) {
    return `${fieldName} must be in the past`;
  }
  
  return null;
}

// ============================================
// SPECIFIC FIELD VALIDATORS
// ============================================

/**
 * Validate email address
 */
export function validateEmail(email: string): string | null {
  if (isEmpty(email)) return null;
  
  const error = validatePattern(
    email,
    VALIDATION_RULES.trainee.email.pattern,
    VALIDATION_RULES.trainee.email.message
  );
  
  if (error) return error;
  
  // Additional checks
  if (email.length > 254) {
    return 'Email address is too long';
  }
  
  return null;
}

/**
 * Validate Philippine phone number
 */
export function validatePhoneNumber(phone: string): string | null {
  if (isEmpty(phone)) return null;
  
  // Remove spaces, dashes, and parentheses for validation
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  // Check if it matches Philippine mobile format: 09XXXXXXXXX
  if (!VALIDATION_RULES.trainee.phone.pattern.test(cleaned)) {
    return VALIDATION_RULES.trainee.phone.message;
  }
  
  return null;
}

/**
 * Validate name (letters, spaces, periods, hyphens, apostrophes only)
 */
export function validateName(name: string, fieldName: string = 'Name'): string | null {
  if (isEmpty(name)) return null;
  
  const lengthError = validateLength(
    name,
    VALIDATION_RULES.trainee.name.minLength,
    VALIDATION_RULES.trainee.name.maxLength,
    fieldName
  );
  
  if (lengthError) return lengthError;
  
  return validatePattern(
    name,
    VALIDATION_RULES.trainee.name.pattern,
    `${fieldName} must contain only letters, spaces, periods, hyphens, and apostrophes`
  );
}

/**
 * Validate age
 */
export function validateAge(age: number): string | null {
  return validateRange(
    age,
    VALIDATION_RULES.trainee.age.min,
    VALIDATION_RULES.trainee.age.max,
    'Age'
  );
}

/**
 * Validate age from birthdate
 */
export function validateBirthdate(birthdate: string | Date): { age: number; error: string | null } {
  if (isEmpty(birthdate)) {
    return { age: 0, error: 'Birthdate is required' };
  }
  
  const birth = new Date(birthdate);
  const today = new Date();
  
  if (isNaN(birth.getTime())) {
    return { age: 0, error: 'Invalid birthdate' };
  }
  
  // Check if birthdate is in the future
  if (birth > today) {
    return { age: 0, error: 'Birthdate cannot be in the future' };
  }
  
  // Calculate age
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  // Validate age range
  const ageError = validateAge(age);
  
  return { age, error: ageError };
}

/**
 * Validate address
 */
export function validateAddress(address: string): string | null {
  if (isEmpty(address)) return null;
  
  return validateLength(
    address,
    VALIDATION_RULES.trainee.address.minLength,
    VALIDATION_RULES.trainee.address.maxLength,
    'Address'
  );
}

/**
 * Validate quantity (must be positive integer)
 */
export function validateQuantity(quantity: number, fieldName: string = 'Quantity'): string | null {
  if (quantity === null || quantity === undefined) return null;
  
  if (!Number.isInteger(quantity)) {
    return `${fieldName} must be a whole number`;
  }
  
  return validateRange(
    quantity,
    VALIDATION_RULES.inventory.quantity.min,
    VALIDATION_RULES.inventory.quantity.max,
    fieldName
  );
}

/**
 * Validate serial number
 */
export function validateSerialNumber(serial: string): string | null {
  if (isEmpty(serial)) return null;
  
  return validatePattern(
    serial,
    VALIDATION_RULES.inventory.serialNumber.pattern,
    VALIDATION_RULES.inventory.serialNumber.message
  );
}

/**
 * Validate monetary value
 */
export function validateMonetaryValue(value: number, fieldName: string = 'Value'): string | null {
  if (value === null || value === undefined) return null;
  
  if (value < 0) {
    return `${fieldName} cannot be negative`;
  }
  
  return validateRange(
    value,
    VALIDATION_RULES.inventory.value.min,
    VALIDATION_RULES.inventory.value.max,
    fieldName
  );
}

/**
 * Validate program title
 */
export function validateProgramTitle(title: string): string | null {
  if (isEmpty(title)) return null;
  
  return validateLength(
    title,
    VALIDATION_RULES.program.title.minLength,
    VALIDATION_RULES.program.title.maxLength,
    'Program title'
  );
}

/**
 * Validate program description
 */
export function validateProgramDescription(description: string): string | null {
  if (isEmpty(description)) return null;
  
  return validateLength(
    description,
    VALIDATION_RULES.program.description.minLength,
    VALIDATION_RULES.program.description.maxLength,
    'Description'
  );
}

/**
 * Validate program duration
 */
export function validateProgramDuration(duration: number): string | null {
  return validateRange(
    duration,
    VALIDATION_RULES.program.duration.min,
    VALIDATION_RULES.program.duration.max,
    'Duration'
  );
}

/**
 * Validate program capacity
 */
export function validateProgramCapacity(capacity: number): string | null {
  if (!Number.isInteger(capacity)) {
    return 'Capacity must be a whole number';
  }
  
  return validateRange(
    capacity,
    VALIDATION_RULES.program.capacity.min,
    VALIDATION_RULES.program.capacity.max,
    'Capacity'
  );
}

/**
 * Validate lending duration
 */
export function validateLendingDuration(duration: number): string | null {
  if (!Number.isInteger(duration)) {
    return 'Duration must be a whole number of days';
  }
  
  return validateRange(
    duration,
    VALIDATION_RULES.lending.duration.min,
    VALIDATION_RULES.lending.duration.max,
    'Lending duration'
  );
}

/**
 * Validate lending due date (must be after borrow date)
 */
export function validateLendingDates(
  borrowDate: string | Date,
  dueDate: string | Date
): string | null {
  return validateDateRange(borrowDate, dueDate, 'Borrow date', 'Due date');
}

// ============================================
// COMPOSITE VALIDATORS
// ============================================

/**
 * Validate complete trainee data
 */
export function validateTraineeData(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthdate: string | Date;
  address: string;
  gender: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  
  // First Name
  const firstNameError = validateRequired(data.firstName, 'First name') || 
                        validateName(data.firstName, 'First name');
  if (firstNameError) errors.firstName = firstNameError;
  
  // Last Name
  const lastNameError = validateRequired(data.lastName, 'Last name') || 
                       validateName(data.lastName, 'Last name');
  if (lastNameError) errors.lastName = lastNameError;
  
  // Email
  const emailError = validateRequired(data.email, 'Email') || validateEmail(data.email);
  if (emailError) errors.email = emailError;
  
  // Phone
  const phoneError = validateRequired(data.phone, 'Phone number') || 
                    validatePhoneNumber(data.phone);
  if (phoneError) errors.phone = phoneError;
  
  // Birthdate & Age
  const birthdateResult = validateBirthdate(data.birthdate);
  if (birthdateResult.error) errors.birthdate = birthdateResult.error;
  
  // Address
  const addressError = validateRequired(data.address, 'Address') || 
                      validateAddress(data.address);
  if (addressError) errors.address = addressError;
  
  // Gender
  if (!data.gender || !['Male', 'Female', 'Other'].includes(data.gender)) {
    errors.gender = 'Please select a valid gender';
  }
  
  return errors;
}

/**
 * Validate complete inventory data
 */
export function validateInventoryData(data: {
  name: string;
  category: string;
  quantity: number;
  serialNumber?: string;
  purchasePrice?: number;
  condition: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  
  // Name
  const nameError = validateRequired(data.name, 'Item name') || 
                   validateLength(data.name, 3, 100, 'Item name');
  if (nameError) errors.name = nameError;
  
  // Category
  if (isEmpty(data.category)) {
    errors.category = 'Category is required';
  }
  
  // Quantity
  const quantityError = validateRequired(data.quantity, 'Quantity') || 
                       validateQuantity(data.quantity);
  if (quantityError) errors.quantity = quantityError;
  
  // Serial Number (optional)
  if (data.serialNumber) {
    const serialError = validateSerialNumber(data.serialNumber);
    if (serialError) errors.serialNumber = serialError;
  }
  
  // Purchase Price (optional)
  if (data.purchasePrice !== undefined && data.purchasePrice !== null) {
    const priceError = validateMonetaryValue(data.purchasePrice, 'Purchase price');
    if (priceError) errors.purchasePrice = priceError;
  }
  
  // Condition
  if (isEmpty(data.condition)) {
    errors.condition = 'Condition is required';
  }
  
  return errors;
}

/**
 * Validate complete program data
 */
export function validateProgramData(data: {
  title: string;
  description: string;
  startDate: string | Date;
  endDate: string | Date;
  capacity: number;
  category: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  
  // Title
  const titleError = validateRequired(data.title, 'Program title') || 
                    validateProgramTitle(data.title);
  if (titleError) errors.title = titleError;
  
  // Description
  const descError = validateRequired(data.description, 'Description') || 
                   validateProgramDescription(data.description);
  if (descError) errors.description = descError;
  
  // Start Date
  const startDateError = validateRequired(data.startDate, 'Start date') || 
                        validateDate(data.startDate, 'Start date');
  if (startDateError) errors.startDate = startDateError;
  
  // End Date
  const endDateError = validateRequired(data.endDate, 'End date') || 
                      validateDate(data.endDate, 'End date');
  if (endDateError) errors.endDate = endDateError;
  
  // Date Range
  if (!startDateError && !endDateError) {
    const rangeError = validateDateRange(data.startDate, data.endDate);
    if (rangeError) errors.endDate = rangeError;
  }
  
  // Capacity
  const capacityError = validateRequired(data.capacity, 'Capacity') || 
                       validateProgramCapacity(data.capacity);
  if (capacityError) errors.capacity = capacityError;
  
  // Category
  if (isEmpty(data.category)) {
    errors.category = 'Category is required';
  }
  
  return errors;
}

/**
 * Validate complete lending data
 */
export function validateLendingData(data: {
  traineeId: string;
  itemId: string;
  borrowDate: string | Date;
  dueDate: string | Date;
  purpose: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  
  // Trainee
  if (isEmpty(data.traineeId)) {
    errors.traineeId = 'Please select a trainee';
  }
  
  // Item
  if (isEmpty(data.itemId)) {
    errors.itemId = 'Please select an item';
  }
  
  // Borrow Date
  const borrowError = validateRequired(data.borrowDate, 'Borrow date') || 
                     validateDate(data.borrowDate, 'Borrow date');
  if (borrowError) errors.borrowDate = borrowError;
  
  // Due Date
  const dueError = validateRequired(data.dueDate, 'Due date') || 
                  validateDate(data.dueDate, 'Due date');
  if (dueError) errors.dueDate = dueError;
  
  // Date Range
  if (!borrowError && !dueError) {
    const rangeError = validateLendingDates(data.borrowDate, data.dueDate);
    if (rangeError) errors.dueDate = rangeError;
    
    // Check duration
    const borrow = new Date(data.borrowDate);
    const due = new Date(data.dueDate);
    const duration = Math.ceil((due.getTime() - borrow.getTime()) / (1000 * 60 * 60 * 24));
    
    const durationError = validateLendingDuration(duration);
    if (durationError) errors.dueDate = durationError;
  }
  
  // Purpose
  const purposeError = validateRequired(data.purpose, 'Purpose') || 
                      validateLength(data.purpose, 5, 200, 'Purpose');
  if (purposeError) errors.purpose = purposeError;
  
  return errors;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if validation errors object is empty
 */
export function hasErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Get first error message from errors object
 */
export function getFirstError(errors: Record<string, string>): string | null {
  const keys = Object.keys(errors);
  return keys.length > 0 ? errors[keys[0]] : null;
}

/**
 * Format phone number for display (09XX-XXX-XXXX)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11 && cleaned.startsWith('09')) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone;
}

/**
 * Calculate age from birthdate
 */
export function calculateAge(birthdate: string | Date): number {
  const birth = new Date(birthdate);
  const today = new Date();
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Sanitize string input (trim and remove multiple spaces)
 */
export function sanitizeString(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Sanitize phone number (remove formatting)
 */
export function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[\s\-()]/g, '');
}
