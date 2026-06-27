-- ── Hostel Rooms ──────────────────────────────────────────────────────────────
CREATE TABLE hostel_rooms (
    room_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    hostel_name     VARCHAR(100) NOT NULL,
    room_number     VARCHAR(50) NOT NULL,
    room_type       VARCHAR(100) NOT NULL,
    capacity        INT NOT NULL DEFAULT 1,
    available_beds  INT NOT NULL DEFAULT 1,
    rent_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(institution_id, hostel_name, room_number)
);

-- ── Hostel Allocations ────────────────────────────────────────────────────────
CREATE TABLE hostel_allocations (
    allocation_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    room_id         UUID NOT NULL REFERENCES hostel_rooms(room_id),
    student_id      UUID NOT NULL REFERENCES student_profiles(student_id),
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,
    mess_plan       VARCHAR(30) NOT NULL DEFAULT 'None',
    -- Veg | Non-Veg | None
    status          VARCHAR(30) NOT NULL DEFAULT 'Active',
    -- Active | Vacated | Cancelled
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hostel_allocations_student ON hostel_allocations(student_id);
CREATE INDEX idx_hostel_allocations_room ON hostel_allocations(room_id);
