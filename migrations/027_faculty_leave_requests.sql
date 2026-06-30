-- Migration 027: Support Leave Requests for Faculty/Teachers

-- 1. Make student_id nullable in leave_requests
ALTER TABLE leave_requests ALTER COLUMN student_id DROP NOT NULL;

-- 2. Add faculty_id column referencing faculty table
ALTER TABLE leave_requests ADD COLUMN faculty_id UUID REFERENCES faculty(faculty_id) ON DELETE CASCADE;

-- 3. Add constraint to enforce that a leave request belongs to EITHER a student OR a faculty member
ALTER TABLE leave_requests ADD CONSTRAINT chk_leave_target 
CHECK ((student_id IS NOT NULL AND faculty_id IS NULL) OR (student_id IS NULL AND faculty_id IS NOT NULL));
