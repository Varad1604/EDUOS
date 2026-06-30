-- Module 7: Hostel Additions

-- Maintenance Tickets
CREATE TABLE hostel_maintenance_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    room_id UUID NOT NULL REFERENCES hostel_rooms(room_id),
    reported_by UUID NOT NULL REFERENCES student_profiles(student_id),
    issue_type VARCHAR(50) NOT NULL, -- e.g. Plumbing, Electrical, Furniture, Other
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Open', -- Open, InProgress, Resolved
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hostel Leaves
CREATE TABLE hostel_leave_requests (
    leave_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    student_id UUID NOT NULL REFERENCES student_profiles(student_id),
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Approved, Rejected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mess Menus
CREATE TABLE mess_menus (
    menu_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    day_of_week VARCHAR(20) NOT NULL, -- Monday, Tuesday, etc.
    meal_type VARCHAR(20) NOT NULL, -- Breakfast, Lunch, Dinner
    items TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mess Preferences
CREATE TABLE mess_preferences (
    preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    student_id UUID NOT NULL REFERENCES student_profiles(student_id) UNIQUE,
    dietary_preference VARCHAR(30) NOT NULL, -- Veg, Non-Veg, Vegan, Eggitarian
    created_at TIMESTAMPTZ DEFAULT NOW()
);
