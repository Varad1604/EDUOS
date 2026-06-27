-- ── Academic Calendar ─────────────────────────────────────────────────────────
CREATE TABLE academic_calendars (
    calendar_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    academic_year   INT NOT NULL,          -- e.g. 2024 for 2024-25
    semester        INT NOT NULL,          -- 1 or 2
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    exam_start_date DATE,
    exam_end_date   DATE,
    holiday_periods JSONB,  -- [{name, start_date, end_date}]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(institution_id, academic_year, semester)
);

-- ── Curriculum Versions ───────────────────────────────────────────────────────
CREATE TABLE curriculum_versions (
    curriculum_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    year            INT NOT NULL,      -- 2018 | 2022 | 2025
    pattern         VARCHAR(50) NOT NULL,  -- CBCS | Semester
    effective_from  DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(institution_id, year, pattern)
);

-- ── Courses ───────────────────────────────────────────────────────────────────
CREATE TABLE courses (
    course_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    curriculum_id   UUID NOT NULL REFERENCES curriculum_versions(curriculum_id),
    course_code     VARCHAR(20) NOT NULL,
    course_name     VARCHAR(150) NOT NULL,
    credits         NUMERIC(3,1) NOT NULL,
    course_type     VARCHAR(50) NOT NULL,  -- Theory | Practical | Project | Seminar
    semester        INT,
    min_marks       INT NOT NULL DEFAULT 35,
    max_marks       INT NOT NULL DEFAULT 100,
    internal_max    INT NOT NULL DEFAULT 30,
    external_max    INT NOT NULL DEFAULT 70,
    course_outcomes JSONB,  -- [CO1, CO2, CO3, CO4, CO5]
    weekly_hours    INT NOT NULL DEFAULT 3,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(institution_id, curriculum_id, course_code)
);

-- ── Faculty ───────────────────────────────────────────────────────────────────
CREATE TABLE faculty (
    faculty_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id       UUID NOT NULL REFERENCES persons(person_id),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    employee_code   VARCHAR(30),
    designation     VARCHAR(50) NOT NULL,
    -- Professor | AssocProf | AsstProf | Lecturer
    department_id   UUID REFERENCES departments(department_id),
    qualification   VARCHAR(50),  -- BTech | MTech | PhD
    specialization  VARCHAR(100),
    joining_date    DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    UNIQUE(institution_id, employee_code)
);

-- Backfill departments.hod_faculty_id FK now that faculty exists
ALTER TABLE departments
    ADD CONSTRAINT fk_dept_hod FOREIGN KEY (hod_faculty_id) REFERENCES faculty(faculty_id);

-- ── Classes ───────────────────────────────────────────────────────────────────
CREATE TABLE classes (
    class_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    branch_id       UUID REFERENCES branches(branch_id),
    semester        INT NOT NULL,
    section         VARCHAR(5) NOT NULL DEFAULT 'A',
    academic_year   INT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(institution_id, branch_id, semester, section, academic_year)
);

-- ── Course Allocations ────────────────────────────────────────────────────────
CREATE TABLE course_allocations (
    allocation_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    course_id       UUID NOT NULL REFERENCES courses(course_id),
    faculty_id      UUID NOT NULL REFERENCES faculty(faculty_id),
    class_id        UUID NOT NULL REFERENCES classes(class_id),
    academic_year   INT NOT NULL,
    semester        INT NOT NULL,
    allocation_type VARCHAR(30) NOT NULL DEFAULT 'Lecture',
    -- Lecture | Lab | Practical | Seminar
    weekly_hours    INT NOT NULL DEFAULT 3,
    allocation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id, class_id, faculty_id, academic_year)
);

-- ── Class Enrollments ─────────────────────────────────────────────────────────
CREATE TABLE class_enrollments (
    enrollment_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    class_id        UUID NOT NULL REFERENCES classes(class_id),
    student_id      UUID NOT NULL REFERENCES student_profiles(student_id),
    academic_year   INT NOT NULL,
    semester        INT NOT NULL,
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(class_id, student_id, academic_year)
);

-- ── Timetable Slots ───────────────────────────────────────────────────────────
CREATE TABLE timetable_slots (
    slot_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    class_id            UUID NOT NULL REFERENCES classes(class_id),
    course_allocation_id UUID NOT NULL REFERENCES course_allocations(allocation_id),
    day_of_week         INT NOT NULL,  -- 1=Mon, 5=Fri, 6=Sat
    start_time          TIME NOT NULL,
    end_time            TIME NOT NULL,
    room                VARCHAR(50),
    building            VARCHAR(100),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Attendance ────────────────────────────────────────────────────────────────
CREATE TABLE attendance (
    attendance_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES institutions(institution_id),
    student_id          UUID NOT NULL REFERENCES student_profiles(student_id),
    course_id           UUID NOT NULL REFERENCES courses(course_id),
    class_id            UUID NOT NULL REFERENCES classes(class_id),
    attendance_date     DATE NOT NULL,
    status              VARCHAR(20) NOT NULL,  -- Present | Absent | Leave | Sick | Duty
    marked_by_faculty_id UUID REFERENCES faculty(faculty_id),
    marked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    UNIQUE(student_id, course_id, attendance_date)
);

-- ── Lesson Plans ──────────────────────────────────────────────────────────────
CREATE TABLE lesson_plans (
    plan_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    faculty_id      UUID NOT NULL REFERENCES faculty(faculty_id),
    course_id       UUID NOT NULL REFERENCES courses(course_id),
    class_id        UUID NOT NULL REFERENCES classes(class_id),
    academic_year   INT NOT NULL,
    week_number     INT NOT NULL,
    topics          JSONB NOT NULL,   -- ["Topic 1", "Topic 2"]
    resources       JSONB,            -- ["URL1", "textbook ref"]
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(faculty_id, course_id, class_id, academic_year, week_number)
);
