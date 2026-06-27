-- ============================================================
-- 011_placement_module.sql
-- Placement & Career Management Module
-- Compliant with: UGC / NAAC placement record-keeping norms
-- ============================================================

-- ── Companies / Recruiters ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS placement_companies (
    company_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id      UUID        NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    company_name        TEXT        NOT NULL,
    industry            TEXT        NOT NULL,                   -- IT, Finance, FMCG, Core, etc.
    website             TEXT,
    contact_person      TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    description         TEXT,
    logo_url            TEXT,
    status              TEXT        NOT NULL DEFAULT 'Active'   -- Active | Blacklisted | Inactive
                            CHECK (status IN ('Active','Blacklisted','Inactive')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted        BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ── Job Drives / Postings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS placement_drives (
    drive_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id      UUID        NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    company_id          UUID        NOT NULL REFERENCES placement_companies(company_id),
    drive_title         TEXT        NOT NULL,
    job_role            TEXT        NOT NULL,
    job_type            TEXT        NOT NULL DEFAULT 'Full-Time'
                            CHECK (job_type IN ('Full-Time','Internship','PPO','Contractual')),
    job_location        TEXT,
    package_lpa         NUMERIC(10,2),                         -- CTC in Lakhs Per Annum
    stipend_pm          NUMERIC(10,2),                         -- Monthly stipend for internships
    min_cgpa            NUMERIC(4,2) NOT NULL DEFAULT 0.0,
    backlogs_allowed    INT          NOT NULL DEFAULT 0,
    eligible_branches   TEXT[]       NOT NULL DEFAULT '{}',    -- e.g. {'CS','EC','ME'}
    description         TEXT,
    bond_years          INT          NOT NULL DEFAULT 0,
    drive_date          DATE         NOT NULL,
    application_deadline DATE        NOT NULL,
    status              TEXT         NOT NULL DEFAULT 'Open'
                            CHECK (status IN ('Open','Closed','Cancelled','Completed')),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    soft_deleted         BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ── Student Applications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS placement_applications (
    application_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    drive_id            UUID        NOT NULL REFERENCES placement_drives(drive_id),
    student_id          UUID        NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    institution_id      UUID        NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    applied_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              TEXT        NOT NULL DEFAULT 'Applied'
                            CHECK (status IN ('Applied','Shortlisted','Rejected','Interview','Offered','Accepted','Declined')),
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (drive_id, student_id)                              -- one application per drive per student
);

-- ── Interview Rounds ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS placement_interview_rounds (
    round_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id      UUID        NOT NULL REFERENCES placement_applications(application_id) ON DELETE CASCADE,
    round_number        INT         NOT NULL,
    round_type          TEXT        NOT NULL                   -- Aptitude | Technical | HR | GD | Final
                            CHECK (round_type IN ('Aptitude','Technical','HR','GD','Coding','Final')),
    scheduled_at        TIMESTAMPTZ NOT NULL,
    venue               TEXT,
    mode                TEXT        NOT NULL DEFAULT 'In-Person'
                            CHECK (mode IN ('In-Person','Online','Hybrid')),
    result              TEXT        NOT NULL DEFAULT 'Pending'
                            CHECK (result IN ('Pending','Cleared','Rejected')),
    feedback            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Offer Letters ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS placement_offers (
    offer_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id      UUID        NOT NULL REFERENCES placement_applications(application_id) ON DELETE CASCADE,
    student_id          UUID        NOT NULL REFERENCES student_profiles(student_id),
    drive_id            UUID        NOT NULL REFERENCES placement_drives(drive_id),
    institution_id      UUID        NOT NULL REFERENCES institutions(institution_id),
    offer_date          DATE        NOT NULL DEFAULT CURRENT_DATE,
    joining_date        DATE,
    package_lpa         NUMERIC(10,2),
    stipend_pm          NUMERIC(10,2),
    offer_letter_ref    TEXT,                                  -- Document reference / S3 key
    status              TEXT        NOT NULL DEFAULT 'Pending'
                            CHECK (status IN ('Pending','Accepted','Declined','Revoked')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (application_id)                                    -- one offer per application
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_placement_companies_institution    ON placement_companies(institution_id);
CREATE INDEX IF NOT EXISTS idx_placement_drives_institution       ON placement_drives(institution_id);
CREATE INDEX IF NOT EXISTS idx_placement_drives_company           ON placement_drives(company_id);
CREATE INDEX IF NOT EXISTS idx_placement_applications_drive       ON placement_applications(drive_id);
CREATE INDEX IF NOT EXISTS idx_placement_applications_student     ON placement_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_placement_interview_rounds_app     ON placement_interview_rounds(application_id);
CREATE INDEX IF NOT EXISTS idx_placement_offers_student           ON placement_offers(student_id);
