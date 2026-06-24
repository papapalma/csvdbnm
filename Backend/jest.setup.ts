/**
 * Jest global setup file.
 *
 * Sets environment variables required by modules that read them at import
 * time (e.g. JWT_SECRET in lib/auth.ts and lib/auth/jwt.ts).
 */
process.env.JWT_SECRET = 'test-jwt-secret-for-jest-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = '8h';
process.env.NODE_ENV = 'test';

// Supabase configuration for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uhhavzjgdsznlokozocr.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoaGF2empnZHN6bmxva296b2NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Mzc5OTMsImV4cCI6MjA5MjUxMzk5M30.aga73y6a2zEV2zJPZC9TiEI66uifY96dnXfzVehDBdk';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoaGF2empnZHN6bmxva296b2NyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjkzNzk5MywiZXhwIjoyMDkyNTEzOTkzfQ.4wDgUR0nsJ6Qqr2kgGTM4VyOMM0zou92YrqR8g2J2aw';
