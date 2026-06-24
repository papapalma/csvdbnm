-- =============================================================================
-- full_schema.sql
-- Multi-Tenant LGU System — Complete Database Schema
--
-- This file creates the entire database from scratch in a single script.
-- It is the consolidated equivalent of running migrations 001 through 011
-- in sequence. Use this for fresh database setups.
--
-- For incremental migrations on an existing database, use the numbered
-- migration files (001–011) instead.
--
-- Migrations consolidated:
--   001–004  Core schema (tenants, users, programs, trainees, items, etc.)
--   005      notification_preferences on trainees
--   006      purge_expired_audit_logs() retention function
--   007      attendance table (replaces attendance_records)
--   008      activity_logs table
--   009      Correct user role values
--   010      lendings: nullable trainee_id + borrower fields
--   011      audit_logs.entity_id changed to TEXT
--
-- Run order within this file:
--   1.  Extensions
--   2.  Utility functions & triggers
--   3.  Platform-wide tables (tenants, users, users_tenants)
--   4.  Tenant-scoped tables (programs, trainees, items)
--   5.  New multi-tenant tables (enrollments, attendance, certificates)
--   6.  Audit & governance tables (audit_logs, activity_logs, feature_flags, extension_requests)
--   7.  Indexes
--   8.  Row-Level Security (RLS) policies
--   9.  Carried-over tables (instructors, lendings, cms_settings, anomalies, etc.)
--   10. Indexes for carried-over tables
--   11. RLS for carried-over tables
--   12. Platform auth tables (password_reset_requests, refresh_tokens, revoked_tokens)
--   13. Audit retention policy function (migration 006)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

-- pgcrypto provides gen_random_uuid() used as the default PK generator
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- 2. UTILITY FUNCTIONS & TRIGGERS
-- =============================================================================

-- Automatically updates the updated_at column on every row modification.
-- Attached to every table that carries an updated_at column.
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- 3. PLATFORM-WIDE TABLES
--    These tables are NOT tenant-scoped. A user can belong to multiple tenants
--    via the users_tenants junction table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tenants
-- Stores metadata for each LGU tenant instance.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255)  UNIQUE NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive', 'suspended')),
  contact_email VARCHAR(255)  NOT NULL,
  contact_phone VARCHAR(50),
  address       TEXT,
  -- JSONB structure:
  -- {
  --   "branding": {
  --     "logoUrl": string | null,
  --     "primaryColor": "#hex",
  --     "secondaryColor": "#hex",
  --     "welcomeMessage": string
  --   },
  --   "features": {
  --     "inventoryManagement": boolean,
  --     "certificateGeneration": boolean,
  --     "qrCodeAttendance": boolean,
  --     "mobileAppAccess": boolean
  --   },
  --   "notifications": {
  --     "whatsapp": { "apiKey": string, "phoneNumberId": string } | null,
  --     "email": { "smtpHost": string, "smtpPort": number, "senderAddress": string } | null
  --   }
  -- }
  configuration JSONB         NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_tenants ON tenants;
CREATE TRIGGER set_updated_at_tenants
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- users
-- Platform-wide user accounts. Not directly tenant-scoped.
-- Tenant membership is managed via users_tenants.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255)  UNIQUE NOT NULL,
  username      VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,  -- bcrypt, cost factor 12
  role          VARCHAR(50)   NOT NULL
                              CHECK (role IN (
                                'super_admin',
                                'local_admin',
                                'staff_training_coordinator',
                                'staff_inventory_manager',
                                'trainee'
                              )),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_users ON users;
CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- users_tenants
-- Junction table: a user can belong to one or more tenants.
-- is_primary marks the user's default tenant for login pre-selection.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users_tenants (
  user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_primary BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tenant_id)
);


-- =============================================================================
-- 4. TENANT-SCOPED TABLES (existing tables extended for multi-tenancy)
--    Each table carries a tenant_id FK referencing tenants(id).
--    RLS policies (section 8) enforce that queries only return rows
--    matching the current session's tenant context.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- programs
-- Training programs offered by a tenant.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           VARCHAR(255)  NOT NULL,
  description    TEXT,
  duration_weeks INTEGER       NOT NULL,
  start_date     DATE          NOT NULL,
  end_date       DATE          NOT NULL,
  status         VARCHAR(20)   NOT NULL
                               CHECK (status IN ('active', 'completed', 'upcoming', 'cancelled')),
  max_trainees   INTEGER       NOT NULL,
  instructor     VARCHAR(255),
  level          VARCHAR(50)   CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'All Levels')),
  image_path     VARCHAR(500),
  thumbnail_path VARCHAR(500),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_programs ON programs;
CREATE TRIGGER set_updated_at_programs
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- trainees
-- Trainee profiles within a tenant.
-- Optionally linked to a users account for mobile app access.
-- Contains PII — RA 10173 (Philippine Data Privacy Act) applies.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trainees (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID          NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  user_id                 UUID          REFERENCES users(id)              ON DELETE SET NULL,
  first_name              VARCHAR(255)  NOT NULL,
  last_name               VARCHAR(255)  NOT NULL,
  middle_name             VARCHAR(255),
  email                   VARCHAR(255)  NOT NULL,
  phone                   VARCHAR(50)   NOT NULL,
  sex                     VARCHAR(10)   NOT NULL CHECK (sex IN ('Male', 'Female')),
  birth_date              DATE          NOT NULL,
  birth_place             VARCHAR(255),
  civil_status            VARCHAR(20)   CHECK (civil_status IN ('Single', 'Married', 'Widowed', 'Separated')),
  province                VARCHAR(255),
  municipality            VARCHAR(255),
  barangay                VARCHAR(255),
  street                  VARCHAR(255),
  educational_attainment  VARCHAR(50),
  course                  VARCHAR(255),
  year_graduated          VARCHAR(10),
  classification          VARCHAR(50),
  disability              VARCHAR(255),
  employment_status       VARCHAR(50),
  program_id              UUID          REFERENCES programs(id)           ON DELETE SET NULL,
  qr_code                 VARCHAR(255)  UNIQUE NOT NULL,
  photo_path              VARCHAR(500),
  thumbnail_path          VARCHAR(500),
  qr_code_path            VARCHAR(500),
  emergency_contact_name  VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  status                  VARCHAR(20)   NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active', 'inactive', 'completed', 'dropped')),
  enrollment_date         DATE          NOT NULL,
  -- RA 10173 consent fields
  consent_given           BOOLEAN       NOT NULL DEFAULT false,
  consent_timestamp       TIMESTAMPTZ,
  consent_version         VARCHAR(50),
  notification_preferences JSONB         NOT NULL DEFAULT '{}', 
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_trainees ON trainees;
CREATE TRIGGER set_updated_at_trainees
  BEFORE UPDATE ON trainees
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- items
-- Inventory items (equipment, materials, supplies) per tenant.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name               VARCHAR(255)  NOT NULL,
  description        TEXT,
  category           VARCHAR(100)  NOT NULL,
  quantity           INTEGER       NOT NULL DEFAULT 0,
  available_quantity INTEGER       NOT NULL DEFAULT 0,
  unit               VARCHAR(50)   NOT NULL,
  location           VARCHAR(255),
  qr_code            VARCHAR(255)  UNIQUE NOT NULL,
  image_path         VARCHAR(500),
  thumbnail_path     VARCHAR(500),
  qr_code_path       VARCHAR(500),
  status             VARCHAR(20)   NOT NULL
                                   CHECK (status IN ('available', 'low_stock', 'out_of_stock', 'maintenance')),
  minimum_quantity   INTEGER       NOT NULL DEFAULT 0,  -- low-stock alert threshold
  purchase_date      DATE,
  condition          VARCHAR(20)   CHECK (condition IN ('New', 'Good', 'Fair', 'Poor', 'Damaged')),
  created_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_items ON items;
CREATE TRIGGER set_updated_at_items
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- =============================================================================
-- 5. NEW MULTI-TENANT TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- enrollments
-- Tracks trainee enrollment in programs.
-- Enforces one enrollment per trainee-program pair via UNIQUE constraint.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  trainee_id      UUID          NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  program_id      UUID          NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  enrollment_date DATE          NOT NULL,
  completion_date DATE,
  status          VARCHAR(20)   NOT NULL DEFAULT 'enrolled'
                                CHECK (status IN ('enrolled', 'active', 'completed', 'dropped', 'failed')),
  final_grade     DECIMAL(5,2),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (trainee_id, program_id)
);

DROP TRIGGER IF EXISTS set_updated_at_enrollments ON enrollments;
CREATE TRIGGER set_updated_at_enrollments
  BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- attendance
-- Session-level attendance for trainees.
-- Linked directly to program_sessions and trainees for QR-code scanning support.
-- Unique constraint on (session_id, trainee_id) prevents duplicate records.
-- NOTE: session_id FK to program_sessions is added after program_sessions is
--       created (see section 9 below).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  session_id     UUID          NOT NULL,  -- FK added below after program_sessions is created
  trainee_id     UUID          NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  status         VARCHAR(20)   NOT NULL
                               CHECK (status IN ('present', 'absent', 'late', 'excused')),
  check_in_time  TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  scanned_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, trainee_id)
);

DROP TRIGGER IF EXISTS set_updated_at_attendance ON attendance;
CREATE TRIGGER set_updated_at_attendance
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- certificates
-- Certificates issued upon program completion.
-- certificate_number and qr_code are globally unique to support
-- cross-tenant verification lookups.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID          NOT NULL REFERENCES tenants(id)     ON DELETE CASCADE,
  enrollment_id      UUID          NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  certificate_number VARCHAR(100)  UNIQUE NOT NULL,
  issue_date         DATE          NOT NULL,
  file_path          VARCHAR(500)  NOT NULL,
  qr_code            VARCHAR(255)  UNIQUE NOT NULL,
  qr_code_path       VARCHAR(500),
  verification_url   VARCHAR(500),
  signatory_name     VARCHAR(255),
  signatory_title    VARCHAR(255),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_certificates ON certificates;
CREATE TRIGGER set_updated_at_certificates
  BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- =============================================================================
-- 6. AUDIT & GOVERNANCE TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- audit_logs
-- Immutable log of all system events for compliance and security monitoring.
-- tenant_id is nullable — NULL means a platform-level (Super Admin) event.
-- Retention: 2 years for most events, 5 years for security events.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          REFERENCES tenants(id) ON DELETE CASCADE,  -- nullable
  user_id     UUID          REFERENCES users(id)   ON DELETE SET NULL,
  action      VARCHAR(100)  NOT NULL,   -- e.g. 'program.create', 'auth.login_failed'
  entity_type VARCHAR(100)  NOT NULL,   -- e.g. 'program', 'trainee', 'user'
  entity_id   TEXT,                     -- TEXT (not UUID) to support non-UUID entity identifiers
  details     JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  -- No updated_at — audit log rows are immutable
);


-- -----------------------------------------------------------------------------
-- activity_logs
-- User-facing action history for the application UI.
-- Distinct from audit_logs (which is for compliance/security).
-- tenant_id is nullable — NULL means a platform-level (Super Admin) action.
-- entity_id is TEXT to support non-UUID identifiers (e.g. scan run IDs).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          REFERENCES tenants(id) ON DELETE CASCADE,  -- nullable
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      VARCHAR(100)  NOT NULL,
  entity_type VARCHAR(100)  NOT NULL,
  entity_id   TEXT          NOT NULL,
  details     JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  -- Immutable — no updated_at
);


-- -----------------------------------------------------------------------------
-- feature_flags
-- Per-tenant feature enablement. Allows enabling/disabling features at runtime
-- without code deployments.
--
-- Known feature keys:
--   inventory_management   — inventory tracking module
--   certificate_generation — PDF certificate generation
--   qr_code_attendance     — QR code-based attendance
--   mobile_app_access      — trainee mobile app access
--   whatsapp_notifications — WhatsApp Business API notifications
--   email_notifications    — SMTP email notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flags (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  feature_key   VARCHAR(100)  NOT NULL,
  enabled       BOOLEAN       NOT NULL DEFAULT false,
  configuration JSONB,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, feature_key)
);

DROP TRIGGER IF EXISTS set_updated_at_feature_flags ON feature_flags;
CREATE TRIGGER set_updated_at_feature_flags
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- extension_requests
-- Formal feature requests submitted by LGU tenants to the Super Admin.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extension_requests (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by           UUID          NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  title                  VARCHAR(255)  NOT NULL,
  description            TEXT          NOT NULL,
  business_justification TEXT,
  priority               VARCHAR(20)   NOT NULL
                                       CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status                 VARCHAR(20)   NOT NULL DEFAULT 'submitted'
                                       CHECK (status IN (
                                         'submitted',
                                         'under_review',
                                         'approved',
                                         'in_development',
                                         'deployed',
                                         'rejected'
                                       )),
  affected_users_count   INTEGER,
  reviewed_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMPTZ,
  review_notes           TEXT,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_extension_requests ON extension_requests;
CREATE TRIGGER set_updated_at_extension_requests
  BEFORE UPDATE ON extension_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- =============================================================================
-- 7. INDEXES
-- =============================================================================

-- tenants
CREATE INDEX IF NOT EXISTS idx_tenants_name   ON tenants(name);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- users_tenants
CREATE INDEX IF NOT EXISTS idx_users_tenants_user   ON users_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_users_tenants_tenant ON users_tenants(tenant_id);

-- programs
CREATE INDEX IF NOT EXISTS idx_programs_tenant        ON programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_programs_tenant_status ON programs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_programs_tenant_dates  ON programs(tenant_id, start_date, end_date);

-- trainees
CREATE INDEX IF NOT EXISTS idx_trainees_tenant         ON trainees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trainees_tenant_program ON trainees(tenant_id, program_id);
CREATE INDEX IF NOT EXISTS idx_trainees_tenant_status  ON trainees(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_trainees_tenant_email   ON trainees(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_trainees_qr             ON trainees(qr_code);
-- GIN index for notification preference opt-out filtering (Req 12.11)
CREATE INDEX IF NOT EXISTS idx_trainees_notification_prefs ON trainees USING gin (notification_preferences);

COMMENT ON COLUMN trainees.notification_preferences IS
  'Trainee notification opt-out preferences. Keys: optOutAll, optOutEnrollment, optOutScheduleChange, optOutReminders, optOutCompletion (all boolean). Req 12.11.';

-- items
CREATE INDEX IF NOT EXISTS idx_items_tenant          ON items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_items_tenant_category ON items(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_items_tenant_status   ON items(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_items_qr              ON items(qr_code);

-- enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant  ON enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_trainee ON enrollments(tenant_id, trainee_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_program ON enrollments(tenant_id, program_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status  ON enrollments(tenant_id, status);

-- attendance
CREATE INDEX IF NOT EXISTS idx_attendance_tenant   ON attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session  ON attendance(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_trainee  ON attendance(tenant_id, trainee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status   ON attendance(tenant_id, status);

-- certificates
CREATE INDEX IF NOT EXISTS idx_certificates_tenant     ON certificates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_certificates_enrollment ON certificates(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_certificates_number     ON certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_qr         ON certificates(qr_code);

-- audit_logs (partial indexes — only rows with a tenant_id)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant         ON audit_logs(tenant_id)         WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action  ON audit_logs(tenant_id, action)  WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user           ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action         ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity         ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created        ON audit_logs(created_at);

-- activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant  ON activity_logs(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_user    ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity  ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action  ON activity_logs(action);

-- feature_flags
CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant ON feature_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key    ON feature_flags(feature_key);

-- extension_requests
CREATE INDEX IF NOT EXISTS idx_extension_requests_tenant   ON extension_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_extension_requests_status   ON extension_requests(status);
CREATE INDEX IF NOT EXISTS idx_extension_requests_priority ON extension_requests(priority);


-- =============================================================================
-- 8. ROW-LEVEL SECURITY (RLS)
--
-- How it works:
--   Before every query the application middleware calls:
--     SELECT set_config('app.current_tenant_id', '<uuid>', true);
--     SELECT set_config('app.is_super_admin', 'true', true);  -- Super Admin only
--
--   The tenant isolation policy filters rows to the current tenant.
--   The super admin bypass policy allows cross-tenant access for aggregated
--   reporting and platform oversight.
--
-- Tables NOT covered by RLS (platform-wide, managed via supabaseAdmin client):
--   tenants, users, users_tenants
-- =============================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE programs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags      ENABLE ROW LEVEL SECURITY;
ALTER TABLE extension_requests ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Tenant isolation policies
-- Restricts SELECT, INSERT, UPDATE, DELETE to rows matching the current
-- session's tenant_id.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS tenant_isolation_programs ON programs;
CREATE POLICY tenant_isolation_programs ON programs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_trainees ON trainees;
CREATE POLICY tenant_isolation_trainees ON trainees
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_items ON items;
CREATE POLICY tenant_isolation_items ON items
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_enrollments ON enrollments;
CREATE POLICY tenant_isolation_enrollments ON enrollments
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_attendance ON attendance;
CREATE POLICY tenant_isolation_attendance ON attendance
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_certificates ON certificates;
CREATE POLICY tenant_isolation_certificates ON certificates
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- audit_logs: tenant_id may be NULL for platform-level events
DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR tenant_id IS NULL
  );

-- activity_logs: tenant_id may be NULL for platform-level events
DROP POLICY IF EXISTS tenant_isolation_activity_logs ON activity_logs;
CREATE POLICY tenant_isolation_activity_logs ON activity_logs
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR tenant_id IS NULL
  );

DROP POLICY IF EXISTS tenant_isolation_feature_flags ON feature_flags;
CREATE POLICY tenant_isolation_feature_flags ON feature_flags
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_extension_requests ON extension_requests;
CREATE POLICY tenant_isolation_extension_requests ON extension_requests
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- Super Admin bypass policies
-- When app.is_super_admin = 'true' is set in the session, the Super Admin
-- can read and write across all tenants.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS super_admin_bypass_programs ON programs;
CREATE POLICY super_admin_bypass_programs ON programs
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_trainees ON trainees;
CREATE POLICY super_admin_bypass_trainees ON trainees
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_items ON items;
CREATE POLICY super_admin_bypass_items ON items
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_enrollments ON enrollments;
CREATE POLICY super_admin_bypass_enrollments ON enrollments
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_attendance ON attendance;
CREATE POLICY super_admin_bypass_attendance ON attendance
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_certificates ON certificates;
CREATE POLICY super_admin_bypass_certificates ON certificates
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_audit_logs ON audit_logs;
CREATE POLICY super_admin_bypass_audit_logs ON audit_logs
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_activity_logs ON activity_logs;
CREATE POLICY super_admin_bypass_activity_logs ON activity_logs
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_feature_flags ON feature_flags;
CREATE POLICY super_admin_bypass_feature_flags ON feature_flags
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_extension_requests ON extension_requests;
CREATE POLICY super_admin_bypass_extension_requests ON extension_requests
  USING (current_setting('app.is_super_admin', true)::boolean = true);


-- =============================================================================
-- 9. TABLES CARRIED OVER FROM THE ORIGINAL SINGLE-TENANT SCHEMA
--    These tables existed in the original BMDC system and are preserved here
--    with tenant_id added for multi-tenancy. RLS policies are applied to all
--    of them so each LGU sees only its own data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- instructors
-- Instructors who deliver training programs. Tenant-scoped.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instructors (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name     VARCHAR(100)  NOT NULL,
  last_name      VARCHAR(100)  NOT NULL,
  middle_name    VARCHAR(100),
  email          VARCHAR(255)  NOT NULL,
  phone          VARCHAR(20),
  specialization VARCHAR(255),
  bio            TEXT,
  photo_path     VARCHAR(500),
  status         VARCHAR(50)   NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'inactive')),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_instructors ON instructors;
CREATE TRIGGER set_updated_at_instructors
  BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- program_instructors
-- Many-to-many: links instructors to programs within the same tenant.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS program_instructors (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id)    ON DELETE CASCADE,
  program_id    UUID          NOT NULL REFERENCES programs(id)   ON DELETE CASCADE,
  instructor_id UUID          NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  role          VARCHAR(100)  NOT NULL DEFAULT 'instructor'
                              CHECK (role IN ('instructor', 'assistant', 'guest')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, instructor_id)
);


-- -----------------------------------------------------------------------------
-- program_sessions
-- Individual scheduled sessions (lectures, labs, workshops) within a program.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS program_sessions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  program_id   UUID          NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  title        VARCHAR(255)  NOT NULL,
  description  TEXT,
  session_date DATE          NOT NULL,
  start_time   TIME          NOT NULL,
  end_time     TIME          NOT NULL,
  location     VARCHAR(255),
  session_type VARCHAR(50)   NOT NULL DEFAULT 'lecture'
                             CHECK (session_type IN ('lecture', 'lab', 'workshop', 'exam', 'seminar', 'field_trip')),
  status       VARCHAR(50)   NOT NULL DEFAULT 'scheduled'
                             CHECK (status IN ('scheduled', 'completed', 'cancelled', 'postponed')),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_program_sessions ON program_sessions;
CREATE TRIGGER set_updated_at_program_sessions
  BEFORE UPDATE ON program_sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Add the deferred FK from attendance.session_id → program_sessions(id)
-- (attendance is created in section 5 before program_sessions exists)
ALTER TABLE attendance
  ADD CONSTRAINT fk_attendance_session
  FOREIGN KEY (session_id) REFERENCES program_sessions(id) ON DELETE CASCADE;


-- -----------------------------------------------------------------------------
-- pending_registrations
-- Trainee self-registration requests awaiting staff approval.
-- Tenant-scoped so each LGU manages its own approval queue.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_registrations (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID          NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  username               VARCHAR(100)  NOT NULL,
  email                  VARCHAR(255)  NOT NULL,
  password_hash          TEXT          NOT NULL,
  first_name             VARCHAR(100)  NOT NULL,
  last_name              VARCHAR(100)  NOT NULL,
  middle_name            VARCHAR(100)  NOT NULL DEFAULT '',
  phone                  VARCHAR(20)   NOT NULL,
  sex                    VARCHAR(10)   NOT NULL,
  birth_date             DATE          NOT NULL,
  birth_place            VARCHAR(255)  NOT NULL,
  civil_status           VARCHAR(20)   NOT NULL,
  province               VARCHAR(100)  NOT NULL,
  municipality           VARCHAR(100)  NOT NULL,
  barangay               VARCHAR(100)  NOT NULL,
  street                 TEXT          NOT NULL,
  educational_attainment VARCHAR(100)  NOT NULL,
  course                 VARCHAR(255)  NOT NULL,
  year_graduated         VARCHAR(4)    NOT NULL,
  classification         VARCHAR(100)  NOT NULL,
  disability             VARCHAR(100),
  employment_status      VARCHAR(50)   NOT NULL,
  program_id             UUID          NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status                 VARCHAR(20)   NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason       TEXT,
  reviewed_by            UUID          REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_pending_registrations ON pending_registrations;
CREATE TRIGGER set_updated_at_pending_registrations
  BEFORE UPDATE ON pending_registrations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- trainee_accounts
-- Links a trainee profile to a users account for mobile app login.
-- One-to-one: each trainee has at most one user account.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trainee_accounts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  trainee_id UUID        UNIQUE NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  user_id    UUID        UNIQUE NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- lendings
-- Tracks equipment/material loans from inventory to trainees or walk-in borrowers.
-- Tenant-scoped so each LGU manages its own lending records.
-- trainee_id is nullable to support non-trainee (walk-in) borrowers.
-- Either trainee_id or borrower_name must be provided (enforced at app level).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lendings (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID          NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  item_id              UUID          NOT NULL REFERENCES items(id)     ON DELETE CASCADE,
  trainee_id           UUID          REFERENCES trainees(id) ON DELETE SET NULL,  -- nullable
  borrower_name        VARCHAR(255),   -- for non-trainee borrowers
  borrower_contact     VARCHAR(50),    -- for non-trainee borrowers
  quantity             INTEGER       NOT NULL,
  lent_date            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expected_return_date DATE          NOT NULL,
  actual_return_date   TIMESTAMPTZ,
  status               VARCHAR(50)   NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active', 'returned', 'overdue', 'lost')),
  notes                TEXT,
  lent_by              UUID          REFERENCES users(id) ON DELETE SET NULL,
  returned_by          UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_lendings ON lendings;
CREATE TRIGGER set_updated_at_lendings
  BEFORE UPDATE ON lendings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- non_attendance_dates
-- Dates excluded from attendance tracking (holidays, suspensions, etc.).
-- Can be program-specific or tenant-wide (program_id = NULL).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS non_attendance_dates (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  date         DATE          NOT NULL,
  reason       VARCHAR(255)  NOT NULL,
  description  TEXT,
  program_id   UUID          REFERENCES programs(id) ON DELETE CASCADE,  -- NULL = applies to all programs
  is_recurring BOOLEAN       NOT NULL DEFAULT false,
  created_by   UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, date, program_id)
);

DROP TRIGGER IF EXISTS set_updated_at_non_attendance_dates ON non_attendance_dates;
CREATE TRIGGER set_updated_at_non_attendance_dates
  BEFORE UPDATE ON non_attendance_dates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- cms_settings
-- Key-value store for tenant-specific CMS content (hero images, announcements,
-- contact info, etc.). Each tenant manages its own settings independently.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cms_settings (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key         VARCHAR(255)  NOT NULL,
  value       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, key)
);

DROP TRIGGER IF EXISTS set_updated_at_cms_settings ON cms_settings;
CREATE TRIGGER set_updated_at_cms_settings
  BEFORE UPDATE ON cms_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- anomaly_detection_configs
-- Per-tenant configuration for the anomaly detection engine.
-- Each LGU can tune thresholds and enabled checks independently.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anomaly_detection_configs (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_key   VARCHAR(100)  NOT NULL,
  config_value JSONB         NOT NULL DEFAULT '{}'::jsonb,
  description  TEXT,
  updated_by   VARCHAR(255)  NOT NULL DEFAULT 'system',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, config_key)
);

DROP TRIGGER IF EXISTS set_updated_at_anomaly_detection_configs ON anomaly_detection_configs;
CREATE TRIGGER set_updated_at_anomaly_detection_configs
  BEFORE UPDATE ON anomaly_detection_configs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- anomaly_detection_runs
-- Records each execution of the anomaly detection engine per tenant.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anomaly_detection_runs (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  started_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  duration_seconds      INTEGER,
  total_anomalies_found INTEGER       NOT NULL DEFAULT 0,
  critical_count        INTEGER       NOT NULL DEFAULT 0,
  warning_count         INTEGER       NOT NULL DEFAULT 0,
  info_count            INTEGER       NOT NULL DEFAULT 0,
  trigger_type          VARCHAR(20)   NOT NULL CHECK (trigger_type IN ('scheduled', 'manual')),
  triggered_by          VARCHAR(255),
  status                VARCHAR(20)   NOT NULL DEFAULT 'running'
                                      CHECK (status IN ('running', 'completed', 'failed')),
  error_message         TEXT,
  config_snapshot       JSONB,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_anomaly_detection_runs ON anomaly_detection_runs;
CREATE TRIGGER set_updated_at_anomaly_detection_runs
  BEFORE UPDATE ON anomaly_detection_runs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- -----------------------------------------------------------------------------
-- anomalies
-- Individual anomaly records detected by the anomaly detection engine.
-- Tenant-scoped so each LGU sees only its own anomalies.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anomalies (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category            VARCHAR(50)   NOT NULL DEFAULT 'system'
                                    CHECK (category IN ('trainee', 'inventory', 'lending', 'program', 'activity_log', 'system')),
  anomaly_type        VARCHAR(100)  NOT NULL DEFAULT 'system_alert',
  severity            VARCHAR(50)   NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  status              VARCHAR(50)   NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  description         TEXT          NOT NULL,
  recommendation      TEXT,
  detection_logic     TEXT,
  entity_type         VARCHAR(100),
  entity_id           UUID,
  entity_identifier   VARCHAR(255),
  metadata            JSONB,
  auto_resolved       BOOLEAN       NOT NULL DEFAULT false,
  occurrence_count    INTEGER       NOT NULL DEFAULT 1,
  first_occurrence_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_occurrence_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  detection_run_id    UUID          REFERENCES anomaly_detection_runs(id) ON DELETE SET NULL,
  detected_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ,
  resolved_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes    TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_anomalies ON anomalies;
CREATE TRIGGER set_updated_at_anomalies
  BEFORE UPDATE ON anomalies
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- =============================================================================
-- 10. INDEXES FOR CARRIED-OVER TABLES
-- =============================================================================

-- instructors
CREATE INDEX IF NOT EXISTS idx_instructors_tenant  ON instructors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instructors_email   ON instructors(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_instructors_status  ON instructors(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_instructors_name    ON instructors(tenant_id, last_name, first_name);

-- program_instructors
CREATE INDEX IF NOT EXISTS idx_program_instructors_tenant     ON program_instructors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_program_instructors_program    ON program_instructors(program_id);
CREATE INDEX IF NOT EXISTS idx_program_instructors_instructor ON program_instructors(instructor_id);

-- program_sessions
CREATE INDEX IF NOT EXISTS idx_program_sessions_tenant       ON program_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_program_sessions_program      ON program_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_program_sessions_date         ON program_sessions(tenant_id, session_date);
CREATE INDEX IF NOT EXISTS idx_program_sessions_status       ON program_sessions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_program_sessions_program_date ON program_sessions(program_id, session_date);

-- pending_registrations
CREATE INDEX IF NOT EXISTS idx_pending_registrations_tenant  ON pending_registrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_status  ON pending_registrations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_program ON pending_registrations(program_id);

-- trainee_accounts
CREATE INDEX IF NOT EXISTS idx_trainee_accounts_tenant  ON trainee_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trainee_accounts_trainee ON trainee_accounts(trainee_id);
CREATE INDEX IF NOT EXISTS idx_trainee_accounts_user    ON trainee_accounts(user_id);

-- lendings
CREATE INDEX IF NOT EXISTS idx_lendings_tenant          ON lendings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lendings_item            ON lendings(tenant_id, item_id);
CREATE INDEX IF NOT EXISTS idx_lendings_trainee         ON lendings(tenant_id, trainee_id);
CREATE INDEX IF NOT EXISTS idx_lendings_status          ON lendings(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_lendings_dates           ON lendings(tenant_id, lent_date, expected_return_date);
CREATE INDEX IF NOT EXISTS idx_lendings_overdue         ON lendings(tenant_id, status, expected_return_date);

-- non_attendance_dates
CREATE INDEX IF NOT EXISTS idx_non_attendance_tenant  ON non_attendance_dates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_non_attendance_date    ON non_attendance_dates(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_non_attendance_program ON non_attendance_dates(program_id);

-- cms_settings
CREATE INDEX IF NOT EXISTS idx_cms_settings_tenant ON cms_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cms_settings_key    ON cms_settings(tenant_id, key);

-- anomaly_detection_configs
CREATE INDEX IF NOT EXISTS idx_anomaly_configs_tenant ON anomaly_detection_configs(tenant_id);

-- anomaly_detection_runs
CREATE INDEX IF NOT EXISTS idx_anomaly_runs_tenant       ON anomaly_detection_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_runs_started_at   ON anomaly_detection_runs(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_runs_status       ON anomaly_detection_runs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_anomaly_runs_trigger_type ON anomaly_detection_runs(trigger_type);

-- anomalies
CREATE INDEX IF NOT EXISTS idx_anomalies_tenant       ON anomalies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_category     ON anomalies(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_anomalies_type         ON anomalies(tenant_id, anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_status       ON anomalies(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity     ON anomalies(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected_at  ON anomalies(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_entity       ON anomalies(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_run          ON anomalies(detection_run_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_status_date  ON anomalies(tenant_id, status, detected_at DESC);


-- =============================================================================
-- 11. RLS FOR CARRIED-OVER TABLES
-- =============================================================================

ALTER TABLE instructors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_instructors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_registrations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainee_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lendings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_attendance_dates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_detection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_detection_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies               ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
DROP POLICY IF EXISTS tenant_isolation_instructors ON instructors;
CREATE POLICY tenant_isolation_instructors ON instructors
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_program_instructors ON program_instructors;
CREATE POLICY tenant_isolation_program_instructors ON program_instructors
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_program_sessions ON program_sessions;
CREATE POLICY tenant_isolation_program_sessions ON program_sessions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_pending_registrations ON pending_registrations;
CREATE POLICY tenant_isolation_pending_registrations ON pending_registrations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_trainee_accounts ON trainee_accounts;
CREATE POLICY tenant_isolation_trainee_accounts ON trainee_accounts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_lendings ON lendings;
CREATE POLICY tenant_isolation_lendings ON lendings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_non_attendance_dates ON non_attendance_dates;
CREATE POLICY tenant_isolation_non_attendance_dates ON non_attendance_dates
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_cms_settings ON cms_settings;
CREATE POLICY tenant_isolation_cms_settings ON cms_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_anomaly_configs ON anomaly_detection_configs;
CREATE POLICY tenant_isolation_anomaly_configs ON anomaly_detection_configs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_anomaly_runs ON anomaly_detection_runs;
CREATE POLICY tenant_isolation_anomaly_runs ON anomaly_detection_runs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_anomalies ON anomalies;
CREATE POLICY tenant_isolation_anomalies ON anomalies
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Super Admin bypass policies
DROP POLICY IF EXISTS super_admin_bypass_instructors ON instructors;
CREATE POLICY super_admin_bypass_instructors ON instructors
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_program_instructors ON program_instructors;
CREATE POLICY super_admin_bypass_program_instructors ON program_instructors
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_program_sessions ON program_sessions;
CREATE POLICY super_admin_bypass_program_sessions ON program_sessions
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_pending_registrations ON pending_registrations;
CREATE POLICY super_admin_bypass_pending_registrations ON pending_registrations
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_trainee_accounts ON trainee_accounts;
CREATE POLICY super_admin_bypass_trainee_accounts ON trainee_accounts
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_lendings ON lendings;
CREATE POLICY super_admin_bypass_lendings ON lendings
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_non_attendance_dates ON non_attendance_dates;
CREATE POLICY super_admin_bypass_non_attendance_dates ON non_attendance_dates
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_cms_settings ON cms_settings;
CREATE POLICY super_admin_bypass_cms_settings ON cms_settings
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_anomaly_configs ON anomaly_detection_configs;
CREATE POLICY super_admin_bypass_anomaly_configs ON anomaly_detection_configs
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_anomaly_runs ON anomaly_detection_runs;
CREATE POLICY super_admin_bypass_anomaly_runs ON anomaly_detection_runs
  USING (current_setting('app.is_super_admin', true)::boolean = true);

DROP POLICY IF EXISTS super_admin_bypass_anomalies ON anomalies;
CREATE POLICY super_admin_bypass_anomalies ON anomalies
  USING (current_setting('app.is_super_admin', true)::boolean = true);


-- -----------------------------------------------------------------------------
-- password_reset_requests
-- Admin-assisted password reset flow. Platform-wide (no tenant_id).
-- A user submits a request; a super_admin or local_admin approves it and
-- provides a one-time reset token.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_email       VARCHAR(255)  NOT NULL,
  status              VARCHAR(20)   NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  reset_token_hash    TEXT,           -- bcrypt/sha256 hash of the one-time token; NULL until approved
  token_expires_at    TIMESTAMPTZ,    -- when the reset token expires
  completed_at        TIMESTAMPTZ,    -- when the password was actually reset
  approved_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  request_notes       TEXT,           -- admin notes on approval/rejection
  created_ip          INET,
  created_user_agent  TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_password_reset_requests ON password_reset_requests;
CREATE TRIGGER set_updated_at_password_reset_requests
  BEFORE UPDATE ON password_reset_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user   ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email  ON password_reset_requests(request_email);

-- No RLS — this is a platform-wide table managed by super_admin via supabaseAdmin client.


-- -----------------------------------------------------------------------------
-- refresh_tokens
-- Opaque refresh token store for JWT rotation.
-- Platform-wide (no tenant_id).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          TEXT          NOT NULL UNIQUE,
  expires_at          TIMESTAMPTZ   NOT NULL,
  revoked_at          TIMESTAMPTZ,
  last_used_at        TIMESTAMPTZ,
  rotated_from        UUID          REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  created_ip          INET,
  created_user_agent  TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user      ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash      ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires   ON refresh_tokens(expires_at);

-- No RLS — managed via supabaseAdmin client.


-- -----------------------------------------------------------------------------
-- revoked_tokens
-- Denylist for revoked JWTs (jti-based). Platform-wide.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        TEXT        PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL  -- used to prune expired entries
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);

-- No RLS — managed via supabaseAdmin client.
--
-- Implements Requirement 21.14:
--   - Standard events: retain for 2 years
--   - Security/auth events (action LIKE 'auth.%' or 'security.%'): retain 5 years
--
-- Call purge_expired_audit_logs() manually or via an external scheduler
-- (e.g. Supabase Edge Functions cron) if pg_cron is not available.
-- =============================================================================

CREATE OR REPLACE FUNCTION purge_expired_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count    INTEGER := 0;
  batch_count      INTEGER := 0;
  standard_cutoff  TIMESTAMPTZ := NOW() - INTERVAL '2 years';
  security_cutoff  TIMESTAMPTZ := NOW() - INTERVAL '5 years';
BEGIN
  -- Delete standard events older than 2 years
  -- (exclude security/auth events which have a 5-year retention period)
  DELETE FROM audit_logs
  WHERE created_at < standard_cutoff
    AND action NOT LIKE 'auth.%'
    AND action NOT LIKE 'security.%'
    AND (details->>'_retention' IS NULL OR details->>'_retention' != '5years');

  GET DIAGNOSTICS batch_count = ROW_COUNT;
  deleted_count := deleted_count + batch_count;

  -- Delete security/auth events older than 5 years
  DELETE FROM audit_logs
  WHERE created_at < security_cutoff
    AND (
      action LIKE 'auth.%'
      OR action LIKE 'security.%'
      OR details->>'_retention' = '5years'
    );

  GET DIAGNOSTICS batch_count = ROW_COUNT;
  deleted_count := deleted_count + batch_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION purge_expired_audit_logs() IS
  'Purges audit log entries per retention policy: 2 years standard, 5 years security/auth. Req 21.14.';

-- Schedule daily at 02:00 UTC if pg_cron is available.
-- If not, call purge_expired_audit_logs() via an external scheduler.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-audit-logs',
      '0 2 * * *',
      'SELECT purge_expired_audit_logs()'
    );
  END IF;
END $$;


COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- Uncomment and run after applying this schema to confirm everything is set up.
-- =============================================================================

-- Check all tables exist (should return 24 tables):
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check RLS is enabled on all tenant-scoped tables:
-- SELECT tablename, rowsecurity FROM pg_tables
--  WHERE schemaname = 'public'
--    AND tablename NOT IN ('tenants','users','users_tenants')
--  ORDER BY tablename;

-- Check all policies are in place:
-- SELECT tablename, policyname FROM pg_policies
--  WHERE schemaname = 'public'
--  ORDER BY tablename, policyname;

-- Check all indexes:
-- SELECT indexname, tablename FROM pg_indexes
--  WHERE schemaname = 'public'
--  ORDER BY tablename, indexname;
