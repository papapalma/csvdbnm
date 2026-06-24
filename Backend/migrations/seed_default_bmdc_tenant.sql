-- =============================================================================
-- seed_default_bmdc_tenant.sql
-- Seed data for the BMDC multi-tenant system.
-- Creates the BMDC tenant, all user roles, feature flags, sample programs,
-- trainees, enrollments, attendance records, and certificates.
--
-- All passwords are bcrypt hashes of 'admin123' (cost factor 10).
-- Hash: $2a$10$dIgYW9pSYPQ4id0g7wsPj.yHKHZ9cfMeyUWqIogTRWoeP8JWbsCEO
--
-- Depends On: full_schema.sql must be applied first.
-- Usage: psql "$DATABASE_URL" -f migrations/seed_default_bmdc_tenant.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. BMDC TENANT
-- =============================================================================
INSERT INTO tenants (
  id, name, status, contact_email, contact_phone, address, configuration,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Bongabong Manpower Development Center',
  'active',
  'admin@bmdc.gov.ph',
  '+63 43 283 0001',
  'Bongabong, Oriental Mindoro, Philippines',
  '{
    "branding": {
      "logoUrl": null,
      "primaryColor": "#1a56db",
      "secondaryColor": "#e3a008",
      "welcomeMessage": "Welcome to the Bongabong Manpower Development Center Training Portal"
    },
    "features": {
      "inventoryManagement": true,
      "certificateGeneration": true,
      "qrCodeAttendance": true,
      "mobileAppAccess": true
    },
    "notifications": { "whatsapp": null, "email": null }
  }',
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. USERS  (password = 'admin123')
--    Hash generated with bcryptjs cost factor 10, verified correct.
--    Hash: $2a$10$dIgYW9pSYPQ4id0g7wsPj.yHKHZ9cfMeyUWqIogTRWoeP8JWbsCEO
-- =============================================================================
INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at) VALUES
  (
    '00000000-0000-0000-0001-000000000001',
    'superadmin@bmdc.gov.ph', 'superadmin',
    '$2a$10$dIgYW9pSYPQ4id0g7wsPj.yHKHZ9cfMeyUWqIogTRWoeP8JWbsCEO',
    'super_admin', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0001-000000000002',
    'localadmin@bmdc.gov.ph', 'bmdc_admin',
    '$2a$10$dIgYW9pSYPQ4id0g7wsPj.yHKHZ9cfMeyUWqIogTRWoeP8JWbsCEO',
    'local_admin', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0001-000000000003',
    'training.coord@bmdc.gov.ph', 'bmdc_training',
    '$2a$10$dIgYW9pSYPQ4id0g7wsPj.yHKHZ9cfMeyUWqIogTRWoeP8JWbsCEO',
    'staff_training_coordinator', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0001-000000000004',
    'inventory@bmdc.gov.ph', 'bmdc_inventory',
    '$2a$10$dIgYW9pSYPQ4id0g7wsPj.yHKHZ9cfMeyUWqIogTRWoeP8JWbsCEO',
    'staff_inventory_manager', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0001-000000000005',
    'trainee1@bmdc.gov.ph', 'bmdc_trainee1',
    '$2a$10$dIgYW9pSYPQ4id0g7wsPj.yHKHZ9cfMeyUWqIogTRWoeP8JWbsCEO',
    'trainee', NOW(), NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  updated_at = NOW();

-- =============================================================================
-- 3. USERS_TENANTS — associate all users with BMDC tenant
-- =============================================================================
INSERT INTO users_tenants (user_id, tenant_id, is_primary, created_at) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', true, NOW()),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', true, NOW()),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', true, NOW()),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', true, NOW()),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001', true, NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- =============================================================================
-- 4. FEATURE FLAGS
-- =============================================================================
INSERT INTO feature_flags (tenant_id, feature_key, enabled, configuration, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'inventory_management',   true,  NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'certificate_generation', true,  NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'qr_code_attendance',     true,  NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'mobile_app_access',      true,  NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'whatsapp_notifications',  false, NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'email_notifications',     true,  NULL, NOW(), NOW())
ON CONFLICT (tenant_id, feature_key) DO NOTHING;

-- =============================================================================
-- 5. TRAINING PROGRAMS
-- =============================================================================
INSERT INTO programs (
  id, tenant_id, name, description, duration_weeks,
  start_date, end_date, status, max_trainees,
  image_path, thumbnail_path, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Bread and Pastry Production NC II',
    'TESDA-accredited course covering bread making, pastry production, and food safety standards.',
    8, '2025-02-03', '2025-03-28', 'completed', 30,
    NULL, NULL, NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Electrical Installation and Maintenance NC II',
    'Covers residential and commercial electrical wiring, safety practices, and TESDA competency standards.',
    10, '2025-04-07', '2025-06-13', 'active', 25,
    NULL, NULL, NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0002-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Shielded Metal Arc Welding (SMAW) NC II',
    'Hands-on welding training aligned with TESDA SMAW NC II qualification standards.',
    12, '2025-07-07', '2025-09-26', 'upcoming', 20,
    NULL, NULL, NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 6. INSTRUCTORS
-- =============================================================================
INSERT INTO instructors (
  id, tenant_id, first_name, last_name, email, phone, specialization, status, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0007-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Maria', 'Santos', 'maria.santos@bmdc.gov.ph', '+63 912 001 0001',
    'Food Technology', 'active', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0007-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Roberto', 'Cruz', 'roberto.cruz@bmdc.gov.ph', '+63 912 001 0002',
    'Electrical Engineering', 'active', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0007-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Eduardo', 'Reyes', 'eduardo.reyes@bmdc.gov.ph', '+63 912 001 0003',
    'Welding Technology', 'active', NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 7. PROGRAM_INSTRUCTORS — link instructors to programs
-- =============================================================================
INSERT INTO program_instructors (id, tenant_id, program_id, instructor_id, role, created_at) VALUES
  ('00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0007-000000000001', 'instructor', NOW()),
  ('00000000-0000-0000-0008-000000000002', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0007-000000000002', 'instructor', NOW()),
  ('00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0007-000000000003', 'instructor', NOW())
ON CONFLICT (program_id, instructor_id) DO NOTHING;

-- =============================================================================
-- 8. TRAINEES
-- =============================================================================
INSERT INTO trainees (
  id, tenant_id, user_id,
  first_name, last_name, middle_name, email, phone, sex, birth_date, birth_place,
  civil_status, province, municipality, barangay, street,
  educational_attainment, employment_status,
  program_id, qr_code, status, enrollment_date,
  consent_given, consent_timestamp, consent_version,
  created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0001-000000000005',
    'Ana', 'Dela Cruz', 'Reyes', 'ana.delacruz@email.com', '+63 912 345 6001',
    'Female', '1998-05-14', 'Bongabong, Oriental Mindoro',
    'Single', 'Oriental Mindoro', 'Bongabong', 'Poblacion', '123 Rizal St.',
    'College Graduate', 'Unemployed',
    '00000000-0000-0000-0002-000000000001', 'BMDC-2025-0001',
    'completed', '2025-02-03', true, '2025-02-03 08:00:00+08', 'v1.0', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000001', NULL,
    'Jose', 'Mendoza', 'Garcia', 'jose.mendoza@email.com', '+63 912 345 6002',
    'Male', '2000-11-22', 'Pinamalayan, Oriental Mindoro',
    'Single', 'Oriental Mindoro', 'Bongabong', 'Labasan', '45 Mabini Ave.',
    'High School Graduate', 'Unemployed',
    '00000000-0000-0000-0002-000000000001', 'BMDC-2025-0002',
    'completed', '2025-02-03', true, '2025-02-03 08:05:00+08', 'v1.0', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0000-000000000001', NULL,
    'Liza', 'Bautista', 'Torres', 'liza.bautista@email.com', '+63 912 345 6003',
    'Female', '1995-03-08', 'Bongabong, Oriental Mindoro',
    'Married', 'Oriental Mindoro', 'Bongabong', 'Hagan', '78 Bonifacio St.',
    'Vocational Graduate', 'Underemployed',
    '00000000-0000-0000-0002-000000000002', 'BMDC-2025-0003',
    'active', '2025-04-07', true, '2025-04-07 08:00:00+08', 'v1.0', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-000000000001', NULL,
    'Mark', 'Villanueva', 'Santos', 'mark.villanueva@email.com', '+63 912 345 6004',
    'Male', '2001-07-30', 'Bongabong, Oriental Mindoro',
    'Single', 'Oriental Mindoro', 'Bongabong', 'Alag', '12 Quezon Blvd.',
    'High School Graduate', 'Unemployed',
    '00000000-0000-0000-0002-000000000002', 'BMDC-2025-0004',
    'active', '2025-04-07', true, '2025-04-07 08:10:00+08', 'v1.0', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0000-000000000001', NULL,
    'Carla', 'Fernandez', 'Lopez', 'carla.fernandez@email.com', '+63 912 345 6005',
    'Female', '1999-09-17', 'Roxas, Oriental Mindoro',
    'Single', 'Oriental Mindoro', 'Bongabong', 'Pag-asa', '56 Luna St.',
    'College Graduate', 'Unemployed',
    '00000000-0000-0000-0002-000000000003', 'BMDC-2025-0005',
    'active', '2025-07-07', true, '2025-07-07 08:00:00+08', 'v1.0', NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 9. TRAINEE_ACCOUNTS — link Ana Dela Cruz to her user account
-- =============================================================================
INSERT INTO trainee_accounts (id, tenant_id, trainee_id, user_id, created_at) VALUES
  (
    '00000000-0000-0000-0009-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0001-000000000005',
    NOW()
  )
ON CONFLICT (trainee_id) DO NOTHING;

-- =============================================================================
-- 10. ENROLLMENTS
-- =============================================================================
INSERT INTO enrollments (
  id, tenant_id, trainee_id, program_id,
  enrollment_date, completion_date, status, final_grade,
  created_at, updated_at
) VALUES
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0002-000000000001',
   '2025-02-03', '2025-03-28', 'completed', 92.50, NOW(), NOW()),
  ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0002-000000000001',
   '2025-02-03', '2025-03-28', 'completed', 88.00, NOW(), NOW()),
  ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0002-000000000002',
   '2025-04-07', NULL, 'active', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0002-000000000002',
   '2025-04-07', NULL, 'active', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0004-000000000005', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0002-000000000003',
   '2025-07-07', NULL, 'enrolled', NULL, NOW(), NOW())
ON CONFLICT (trainee_id, program_id) DO NOTHING;

-- =============================================================================
-- 11. ATTENDANCE RECORDS
-- Skipped: the `attendance` table requires a valid session_id from
-- `program_sessions`, which has no seeded rows. Add attendance records
-- after seeding program_sessions with real UUIDs.
-- =============================================================================

-- =============================================================================
-- 12. CERTIFICATES
-- =============================================================================
INSERT INTO certificates (
  id, tenant_id, enrollment_id, certificate_number, issue_date,
  file_path, qr_code, qr_code_path, verification_url,
  signatory_name, signatory_title, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0004-000000000001', 'BMDC-CERT-2025-0001', '2025-03-28',
    'uploads/00000000-0000-0000-0000-000000000001/documents/certificates/BMDC-CERT-2025-0001.pdf',
    'CERT-QR-BMDC-2025-0001',
    'uploads/00000000-0000-0000-0000-000000000001/qrcodes/certificates/BMDC-CERT-2025-0001.png',
    'https://bmdc.gov.ph/verify/BMDC-CERT-2025-0001',
    'Hon. Juan dela Vega', 'Municipal Mayor', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0004-000000000002', 'BMDC-CERT-2025-0002', '2025-03-28',
    'uploads/00000000-0000-0000-0000-000000000001/documents/certificates/BMDC-CERT-2025-0002.pdf',
    'CERT-QR-BMDC-2025-0002',
    'uploads/00000000-0000-0000-0000-000000000001/qrcodes/certificates/BMDC-CERT-2025-0002.png',
    'https://bmdc.gov.ph/verify/BMDC-CERT-2025-0002',
    'Hon. Juan dela Vega', 'Municipal Mayor', NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 13. SAMPLE INVENTORY ITEMS
-- =============================================================================
INSERT INTO items (
  id, tenant_id, name, description, category,
  quantity, available_quantity, unit, location, qr_code,
  status, minimum_quantity, condition, created_by, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-000a-000000000001', '00000000-0000-0000-0000-000000000001',
    'Welding Machine', 'Arc welding machine for SMAW training', 'Equipment',
    5, 5, 'units', 'Workshop A', 'ITEM-WELD-001',
    'available', 2, 'Good', '00000000-0000-0000-0001-000000000004', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-000a-000000000002', '00000000-0000-0000-0000-000000000001',
    'Safety Helmet', 'Hard hat for electrical and welding training', 'Safety Equipment',
    20, 18, 'units', 'Storage Room B', 'ITEM-HELM-001',
    'available', 5, 'Good', '00000000-0000-0000-0001-000000000004', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-000a-000000000003', '00000000-0000-0000-0000-000000000001',
    'Mixing Bowl Set', 'Stainless steel mixing bowls for bread and pastry training', 'Kitchen Equipment',
    10, 10, 'sets', 'Kitchen Lab', 'ITEM-BOWL-001',
    'available', 3, 'New', '00000000-0000-0000-0001-000000000004', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-000a-000000000004', '00000000-0000-0000-0000-000000000001',
    'Electrical Tester', 'Digital multimeter for electrical training', 'Tools',
    3, 1, 'units', 'Workshop B', 'ITEM-TSTR-001',
    'low_stock', 3, 'Fair', '00000000-0000-0000-0001-000000000004', NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 14. ANOMALY DETECTION CONFIG (default settings)
-- =============================================================================
INSERT INTO anomaly_detection_configs (
  tenant_id, config_key, config_value, description, updated_by, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  '{
    "enabled_checks": {
      "quantity_discrepancy": true,
      "overdue_lending": true,
      "impossible_availability": true,
      "zero_quantity_lending": true,
      "active_trainee_without_program": true,
      "expired_active_program": true,
      "lending_inactive_trainee": true,
      "minimum_quantity_unset": true
    },
    "thresholds": {
      "quantity_discrepancy_warning_ratio": 0.1,
      "quantity_discrepancy_critical_ratio": 0.3,
      "overdue_warning_days": 3,
      "overdue_critical_days": 7
    },
    "auto_resolve": { "enabled": true, "max_days": 14 }
  }'::jsonb,
  'Default anomaly detection settings',
  'system',
  NOW(), NOW()
) ON CONFLICT (tenant_id, config_key) DO NOTHING;

-- =============================================================================
-- 15. CMS SETTINGS (default branding content)
-- =============================================================================
INSERT INTO cms_settings (tenant_id, key, value, description, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'hero_title',
   'Bongabong Manpower Development Center',
   'Main hero section title', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'hero_subtitle',
   'Empowering the community through skills training and livelihood programs.',
   'Hero section subtitle', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'contact_address',
   'Bongabong, Oriental Mindoro, Philippines',
   'Office address displayed on contact page', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'contact_phone',
   '+63 43 283 0001',
   'Contact phone number', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'contact_email',
   'admin@bmdc.gov.ph',
   'Contact email address', NOW(), NOW())
ON CONFLICT (tenant_id, key) DO NOTHING;

COMMIT;

-- =============================================================================
-- VERIFICATION (uncomment to run after seeding)
-- =============================================================================
-- SELECT id, name, status FROM tenants;
-- SELECT id, email, role FROM users ORDER BY role;
-- SELECT id, name, status FROM programs WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
-- SELECT id, first_name, last_name, status FROM trainees WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
-- SELECT id, status, final_grade FROM enrollments WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
-- SELECT id, name, status FROM items WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
