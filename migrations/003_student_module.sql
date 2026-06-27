-- ── Student Profiles ──────────────────────────────────────────────────────────
CREATE TABLE student_profiles (
    student_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id               UUID NOT NULL REFERENCES persons(person_id),
    institution_id          UUID NOT NULL REFERENCES institutions(institution_id),
    enrollment_number       VARCHAR(50),
    enrollment_status       VARCHAR(50) NOT NULL DEFAULT 'Applicant',
    -- Inquiry | Applicant | Admitted | Active | Detained | Alumni | Dropout | Cancelled
    enrollment_date         DATE,
    branch_id               UUID REFERENCES branches(branch_id),
    current_semester        INT,
    current_academic_year   INT,
    cgpa                    NUMERIC(4,2),
    category                VARCHAR(20),  -- General | SC | ST | OBC | EWS
    quota                   VARCHAR(30),  -- Management | Sponsored | Government
    guardian_name           VARCHAR(200),
    guardian_phone          VARCHAR(20),
    guardian_relation       VARCHAR(50),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMPTZ,
    UNIQUE(institution_id, enrollment_number)
);

-- ── Programs ──────────────────────────────────────────────────────────────────
CREATE TABLE programs (
    program_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id          UUID NOT NULL REFERENCES institutions(institution_id),
    program_name            VARCHAR(100) NOT NULL,
    duration_years          INT NOT NULL DEFAULT 4,
    department_id           UUID REFERENCES departments(department_id),
    program_outcomes        JSONB,  -- [PO1..PO12]
    program_specific_outcomes JSONB, -- [PSO1..PSO5]
    nep_2020_compliant      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Student Academic Records ───────────────────────────────────────────────────
CREATE TABLE student_academic_records (
    record_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      UUID NOT NULL REFERENCES student_profiles(student_id),
    program_id      UUID NOT NULL REFERENCES programs(program_id),
    enrollment_year INT NOT NULL,
    current_semester INT,
    cgpa            NUMERIC(4,2),
    eligibility_status VARCHAR(50) DEFAULT 'Eligible',
    -- Eligible | Detained | Backlogs | Discontinued
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, program_id, enrollment_year)
);

-- ── Student Documents ─────────────────────────────────────────────────────────
CREATE TABLE student_documents (
    document_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      UUID NOT NULL REFERENCES student_profiles(student_id),
    document_type   VARCHAR(50) NOT NULL,
    -- Aadhar | 10thMarksheet | 12thMarksheet | CasteCert | IncomeCert | Photo | Other
    file_url        VARCHAR(1000),
    file_name       VARCHAR(255),
    file_size_bytes BIGINT,
    upload_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version_number  INT NOT NULL DEFAULT 1,
    uploaded_by     UUID REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ
);

-- ── Guardian Links ────────────────────────────────────────────────────────────
CREATE TABLE guardian_links (
    link_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      UUID NOT NULL REFERENCES student_profiles(student_id),
    guardian_person_id UUID REFERENCES persons(person_id),
    relation        VARCHAR(50) NOT NULL,   -- Father | Mother | Guardian
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, guardian_person_id)
);
