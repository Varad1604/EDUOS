-- Exam Grace Policies
CREATE TABLE exam_grace_policies (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(course_id) ON DELETE CASCADE, -- if null, applies to all courses in institution
    max_grace_marks INT NOT NULL DEFAULT 5,
    min_original_marks INT NOT NULL DEFAULT 30, -- Only give grace if they scored at least this much (e.g. 30/35)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seating Arrangements
CREATE TABLE seating_arrangements (
    arrangement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    seat_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exam_id, student_id),
    UNIQUE(exam_id, room_number, seat_number)
);

-- Supplementary Exams
CREATE TABLE supplementary_exams (
    supp_exam_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_exam_id UUID NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_date DATE,
    scheduled_time TIME,
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Mark Moderations
CREATE TABLE mark_moderations (
    moderation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(exam_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    original_marks NUMERIC(5, 2) NOT NULL,
    moderated_marks NUMERIC(5, 2) NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Note: We also need to add some columns to exams if they don't exist
-- But since we use jsonb or they are fine as is, we can stick with standard
-- Let's check if we need alter table for exams to add require_seating
ALTER TABLE exams ADD COLUMN IF NOT EXISTS require_seating BOOLEAN NOT NULL DEFAULT FALSE;
