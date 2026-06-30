-- (curriculum_versions already exists in 004_academics_module.sql)

-- Link courses to a curriculum version
CREATE TABLE curriculum_courses (
    curriculum_course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES curriculum_versions(curriculum_id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    semester INT NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(curriculum_id, course_id)
);

-- Course prerequisites (chaining)
CREATE TABLE course_prerequisites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    prerequisite_course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, prerequisite_course_id)
);

-- Leave requests
CREATE TABLE leave_requests (
    leave_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type VARCHAR(50) NOT NULL, -- 'Medical', 'Personal', 'Other'
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
    approved_by UUID REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leave_requests_student ON leave_requests(student_id);
CREATE INDEX idx_curriculum_courses_curr ON curriculum_courses(curriculum_id);
