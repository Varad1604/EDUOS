-- Module 9: Placement additions

-- Add resume_url to placement_applications
ALTER TABLE placement_applications ADD COLUMN resume_url VARCHAR(500);

-- Interview Scheduling
CREATE TABLE placement_interviews (
    interview_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    application_id UUID NOT NULL REFERENCES placement_applications(application_id) ON DELETE CASCADE,
    round_name VARCHAR(100) NOT NULL, -- e.g. Technical Round 1, HR Round
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 30,
    location_or_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'Scheduled', -- Scheduled, Completed, Cancelled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alumni Placements
CREATE TABLE alumni_placements (
    alumni_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    student_id UUID NOT NULL REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    company_name VARCHAR(150) NOT NULL,
    designation VARCHAR(150) NOT NULL,
    ctc_lpa NUMERIC(8,2) NOT NULL,
    joining_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
