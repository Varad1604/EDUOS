-- Migration 025: Quizzes and Notifications tables

CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    course_id      UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    title          VARCHAR(255) NOT NULL,
    description    TEXT,
    total_marks    INT NOT NULL DEFAULT 10,
    quiz_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    category        VARCHAR(50) NOT NULL DEFAULT 'Academic',
    target_role     VARCHAR(50) NOT NULL DEFAULT 'All',
    created_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial records if data exists
INSERT INTO quizzes (institution_id, course_id, title, description, total_marks, quiz_date)
SELECT 
    institution_id, 
    course_id, 
    'Mid-term Python Quiz', 
    'Covers variables, loops, and functions. 10 multiple-choice questions.', 
    20, 
    CURRENT_DATE + INTERVAL '5 days'
FROM courses 
LIMIT 1;

INSERT INTO notifications (institution_id, title, message, category, target_role)
SELECT 
    institution_id,
    'Semester Registrations Open',
    'Dear Students, registration for the next academic semester is now open. Kindly clear any pending fee dues and submit your course options before July 10th.',
    'Academic',
    'Student'
FROM institutions
LIMIT 1;

INSERT INTO notifications (institution_id, title, message, category, target_role)
SELECT 
    institution_id,
    'Urgent: Grade Submission Deadline',
    'Dear Faculty Members, please ensure all mid-semester exam marks are entered and processed in the system by tomorrow evening to compile the grade reports.',
    'Exam',
    'Faculty'
FROM institutions
LIMIT 1;
