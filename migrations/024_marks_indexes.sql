-- Migration 024: Add marks indexes
-- Optimize mark filtering by status and lookups by exam + course + status.
CREATE INDEX IF NOT EXISTS idx_marks_status ON marks(status);
CREATE INDEX IF NOT EXISTS idx_marks_exam_course_status ON marks(exam_id, course_id, status);
