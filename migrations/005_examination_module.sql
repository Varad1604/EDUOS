-- ── Exams ─────────────────────────────────────────────────────────────────────
CREATE TABLE exams (
    exam_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    exam_code           VARCHAR(30),
    course_id           UUID NOT NULL REFERENCES courses(course_id),
    class_id            UUID NOT NULL REFERENCES classes(class_id),
    exam_type           VARCHAR(50) NOT NULL,
    -- Internal | External | Backlog | MakeUp | Quiz | Assignment
    scheduled_date      DATE NOT NULL,
    scheduled_time      TIME NOT NULL,
    duration_minutes    INT NOT NULL DEFAULT 180,
    exam_mode           VARCHAR(30) NOT NULL DEFAULT 'Written',
    -- Written | Practical | Project | Viva | Online
    max_marks           INT NOT NULL DEFAULT 100,
    min_marks           INT NOT NULL DEFAULT 35,
    invigilator_faculty_id UUID REFERENCES faculty(faculty_id),
    hall_tickets_generated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted        BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Hall Tickets ──────────────────────────────────────────────────────────────
CREATE TABLE exam_hall_tickets (
    hall_ticket_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    exam_id         UUID NOT NULL REFERENCES exams(exam_id),
    student_id      UUID NOT NULL REFERENCES student_profiles(student_id),
    hall_no         VARCHAR(20),
    seat_no         VARCHAR(20),
    qr_code         TEXT,          -- base64-encoded QR payload
    printed_date    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(exam_id, student_id)
);

-- ── Marks ─────────────────────────────────────────────────────────────────────
CREATE TABLE marks (
    marks_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    exam_id             UUID NOT NULL REFERENCES exams(exam_id),
    student_id          UUID NOT NULL REFERENCES student_profiles(student_id),
    course_id           UUID NOT NULL REFERENCES courses(course_id),
    obtained_marks      NUMERIC(6,2) NOT NULL,
    is_grace_marks      BOOLEAN NOT NULL DEFAULT FALSE,
    grace_marks_applied NUMERIC(4,2) DEFAULT 0,
    revaluation_status  VARCHAR(30) NOT NULL DEFAULT 'None',
    -- None | Requested | Processing | Approved | Denied
    revaluation_marks   NUMERIC(6,2),
    entered_by_faculty_id UUID NOT NULL REFERENCES faculty(faculty_id),
    entered_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_by         UUID REFERENCES faculty(faculty_id),
    verified_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(exam_id, student_id, course_id)
);

-- ── Revaluation Requests ──────────────────────────────────────────────────────
CREATE TABLE revaluation_requests (
    revaluation_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    marks_id        UUID NOT NULL REFERENCES marks(marks_id),
    student_id      UUID NOT NULL REFERENCES student_profiles(student_id),
    request_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    reason          TEXT,
    status          VARCHAR(30) NOT NULL DEFAULT 'Pending',
    -- Pending | Processing | Completed | Rejected
    old_marks       NUMERIC(6,2),
    new_marks       NUMERIC(6,2),
    approved_by     UUID REFERENCES users(user_id),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Results ───────────────────────────────────────────────────────────────────
CREATE TABLE results (
    result_id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id          UUID NOT NULL REFERENCES institutions(institution_id),
    student_id              UUID NOT NULL REFERENCES student_profiles(student_id),
    semester                INT NOT NULL,
    academic_year           INT NOT NULL,
    sgpa                    NUMERIC(4,2) NOT NULL,
    cgpa                    NUMERIC(4,2) NOT NULL,
    grade_points            NUMERIC(6,2),
    total_credits_earned    NUMERIC(5,1),
    total_credits_attempted NUMERIC(5,1),
    status                  VARCHAR(30) NOT NULL,
    -- Pass | Fail | Detained | BacklogEligible | Withheld
    backlogs_count          INT NOT NULL DEFAULT 0,
    published_date          TIMESTAMPTZ,
    approved_by_registrar_id UUID REFERENCES users(user_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at              TIMESTAMPTZ,
    UNIQUE(student_id, semester, academic_year)
);

-- ── Transcripts ───────────────────────────────────────────────────────────────
CREATE TABLE transcripts (
    transcript_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    student_id          UUID NOT NULL REFERENCES student_profiles(student_id),
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by_user_id UUID REFERENCES users(user_id),
    transcript_type     VARCHAR(30) NOT NULL,  -- Provisional | Official | Consolidated
    file_url            VARCHAR(1000),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
