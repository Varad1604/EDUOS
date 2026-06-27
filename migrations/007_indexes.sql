-- ── Event Log (append-only audit trail) ──────────────────────────────────────
CREATE TABLE event_log (
    event_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    event_type      VARCHAR(100) NOT NULL,
    aggregate_id    UUID NOT NULL,
    aggregate_type  VARCHAR(50) NOT NULL,
    user_id         UUID REFERENCES users(user_id),
    event_payload   JSONB NOT NULL,
    event_version   INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN NOT NULL DEFAULT FALSE  -- never true in practice
);

-- ── Partition event_log by month ─────────────────────────────────────────────
-- (PostgreSQL 14+ declarative partitioning — use only if needed)
-- For MVP, keep as regular table and add archival strategy later.

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Core
CREATE INDEX idx_persons_institution       ON persons(institution_id);
CREATE INDEX idx_persons_email             ON persons(email) WHERE soft_deleted = FALSE;
CREATE INDEX idx_users_institution         ON users(institution_id);
CREATE INDEX idx_users_username            ON users(institution_id, username);

-- Student
CREATE INDEX idx_student_institution       ON student_profiles(institution_id);
CREATE INDEX idx_student_status            ON student_profiles(enrollment_status) WHERE soft_deleted = FALSE;
CREATE INDEX idx_student_branch            ON student_profiles(branch_id);
CREATE INDEX idx_student_docs_student      ON student_documents(student_id) WHERE soft_deleted = FALSE;
CREATE INDEX idx_student_acad_student      ON student_academic_records(student_id);

-- Academics
CREATE INDEX idx_course_institution        ON courses(institution_id) WHERE soft_deleted = FALSE;
CREATE INDEX idx_faculty_institution       ON faculty(institution_id) WHERE soft_deleted = FALSE;
CREATE INDEX idx_faculty_dept              ON faculty(department_id);
CREATE INDEX idx_class_institution         ON classes(institution_id);
CREATE INDEX idx_alloc_class               ON course_allocations(class_id);
CREATE INDEX idx_alloc_faculty             ON course_allocations(faculty_id);
CREATE INDEX idx_timetable_class           ON timetable_slots(class_id);
CREATE INDEX idx_attendance_student_course ON attendance(student_id, course_id) WHERE soft_deleted = FALSE;
CREATE INDEX idx_attendance_date           ON attendance(attendance_date);
CREATE INDEX idx_enrollment_class          ON class_enrollments(class_id);
CREATE INDEX idx_enrollment_student        ON class_enrollments(student_id);

-- Examination
CREATE INDEX idx_exams_course              ON exams(course_id) WHERE soft_deleted = FALSE;
CREATE INDEX idx_exams_class               ON exams(class_id);
CREATE INDEX idx_hall_tickets_exam         ON exam_hall_tickets(exam_id);
CREATE INDEX idx_hall_tickets_student      ON exam_hall_tickets(student_id);
CREATE INDEX idx_marks_exam                ON marks(exam_id) WHERE soft_deleted = FALSE;
CREATE INDEX idx_marks_student             ON marks(student_id);
CREATE INDEX idx_marks_course              ON marks(course_id);
CREATE INDEX idx_results_student           ON results(student_id) WHERE soft_deleted = FALSE;
CREATE INDEX idx_results_semester          ON results(institution_id, semester, academic_year);

-- Finance
CREATE INDEX idx_fee_alloc_student         ON fee_allocations(student_id) WHERE soft_deleted = FALSE;
CREATE INDEX idx_fee_alloc_status          ON fee_allocations(status);
CREATE INDEX idx_fee_payment_student       ON fee_payments(student_id) WHERE soft_deleted = FALSE;
CREATE INDEX idx_fee_payment_status        ON fee_payments(status);
CREATE INDEX idx_scholarship_type          ON scholarships(scholarship_type);
CREATE INDEX idx_journal_institution       ON journal_entries(institution_id);
CREATE INDEX idx_journal_status            ON journal_entries(status);
CREATE INDEX idx_journal_items_journal     ON journal_items(journal_id);
CREATE INDEX idx_journal_items_account     ON journal_items(account_id);

-- Event log
CREATE INDEX idx_event_log_institution     ON event_log(institution_id);
CREATE INDEX idx_event_log_event_type      ON event_log(event_type);
CREATE INDEX idx_event_log_aggregate       ON event_log(aggregate_id);
CREATE INDEX idx_event_log_created_at      ON event_log(created_at DESC);
CREATE INDEX idx_event_log_user            ON event_log(user_id);
