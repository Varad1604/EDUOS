-- ============================================================
-- 012_medical_module.sql
-- Medical / Health Center Module
-- Compliant with: Clinical Establishments Act 2010, 
-- MCI/NMC record-keeping, PCPNDT-independent health records
-- ============================================================

-- ── Patient Visits / OPD Register ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_visits (
    visit_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id      UUID        NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    student_id          UUID        NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    visit_date          DATE        NOT NULL DEFAULT CURRENT_DATE,
    visit_time          TIMETZ      NOT NULL DEFAULT NOW()::TIMETZ,
    chief_complaint     TEXT        NOT NULL,                  -- Primary reason for visit
    doctor_name         TEXT        NOT NULL,
    diagnosis           TEXT,
    notes               TEXT,
    follow_up_date      DATE,
    status              TEXT        NOT NULL DEFAULT 'Open'
                            CHECK (status IN ('Open','Closed','FollowUp')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Vital Signs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_vitals (
    vital_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id            UUID        NOT NULL REFERENCES medical_visits(visit_id) ON DELETE CASCADE,
    temperature_c       NUMERIC(5,2),                         -- in Celsius
    pulse_bpm           INT,                                  -- Beats per minute
    bp_systolic         INT,                                  -- mmHg
    bp_diastolic        INT,                                  -- mmHg
    spo2_pct            NUMERIC(5,2),                         -- SpO2 %
    weight_kg           NUMERIC(6,2),
    height_cm           NUMERIC(6,2),
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Prescriptions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_prescriptions (
    prescription_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id            UUID        NOT NULL REFERENCES medical_visits(visit_id) ON DELETE CASCADE,
    medicine_name       TEXT        NOT NULL,
    dosage              TEXT        NOT NULL,                  -- e.g. "500mg"
    frequency           TEXT        NOT NULL,                  -- e.g. "TDS" "BD" "OD"
    duration_days       INT         NOT NULL DEFAULT 3,
    route               TEXT        NOT NULL DEFAULT 'Oral'
                            CHECK (route IN ('Oral','Topical','IV','IM','Sublingual','Inhalation','Other')),
    instructions        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Medical Inventory ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_inventory (
    item_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id      UUID        NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    item_name           TEXT        NOT NULL,
    item_category       TEXT        NOT NULL DEFAULT 'Medicine'
                            CHECK (item_category IN ('Medicine','Consumable','Equipment','Vaccine','Other')),
    unit                TEXT        NOT NULL DEFAULT 'Tab',    -- Tab, Ml, Strip, Piece, Vial etc.
    quantity_in_stock   INT         NOT NULL DEFAULT 0,
    reorder_level       INT         NOT NULL DEFAULT 10,
    expiry_date         DATE,
    batch_number        TEXT,
    manufacturer        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted        BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ── Sick Leave Certificates ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_sick_leaves (
    sick_leave_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id            UUID        NOT NULL REFERENCES medical_visits(visit_id) ON DELETE CASCADE,
    student_id          UUID        NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    institution_id      UUID        NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    leave_from          DATE        NOT NULL,
    leave_to            DATE        NOT NULL,
    days                INT         NOT NULL GENERATED ALWAYS AS (leave_to - leave_from + 1) STORED,
    doctor_name         TEXT        NOT NULL,
    remarks             TEXT,
    certificate_number  TEXT        UNIQUE,                   -- Unique reference for the certificate
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (leave_to >= leave_from)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medical_visits_institution     ON medical_visits(institution_id);
CREATE INDEX IF NOT EXISTS idx_medical_visits_student         ON medical_visits(student_id);
CREATE INDEX IF NOT EXISTS idx_medical_visits_date            ON medical_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_medical_vitals_visit           ON medical_vitals(visit_id);
CREATE INDEX IF NOT EXISTS idx_medical_prescriptions_visit    ON medical_prescriptions(visit_id);
CREATE INDEX IF NOT EXISTS idx_medical_inventory_institution  ON medical_inventory(institution_id);
CREATE INDEX IF NOT EXISTS idx_medical_sick_leaves_student    ON medical_sick_leaves(student_id);
