-- Migration 026: Performance Optimization Indices for Monolith High-Scale Operations

-- 1. Index for timetable queries (class timetables and room conflict checking)
CREATE INDEX IF NOT EXISTS idx_timetable_slots_performance 
ON timetable_slots(institution_id, class_id, day_of_week);

-- 2. Index for course allocations (retrieving allocation records by class/course)
CREATE INDEX IF NOT EXISTS idx_course_allocations_performance 
ON course_allocations(institution_id, class_id, course_id);

-- 3. Index for bulk attendance marking and registries checks
CREATE INDEX IF NOT EXISTS idx_attendance_performance 
ON attendance(institution_id, class_id, course_id, attendance_date);

-- 4. Index for lesson plans lookup
CREATE INDEX IF NOT EXISTS idx_lesson_plans_performance 
ON lesson_plans(institution_id, faculty_id, course_id);
