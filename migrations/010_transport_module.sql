-- ── Transport Routes ─────────────────────────────────────────────────────────────
CREATE TABLE transport_routes (
    route_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    route_code      VARCHAR(50) NOT NULL,
    route_name      VARCHAR(150) NOT NULL,
    start_location  VARCHAR(150) NOT NULL,
    end_location    VARCHAR(150) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(institution_id, route_code)
);

-- ── Transport Stops ──────────────────────────────────────────────────────────────
CREATE TABLE transport_stops (
    stop_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id        UUID NOT NULL REFERENCES transport_routes(route_id),
    stop_name       VARCHAR(150) NOT NULL,
    pickup_time     TIME NOT NULL,
    fare_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Transport Vehicles ───────────────────────────────────────────────────────────
CREATE TABLE transport_vehicles (
    vehicle_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    vehicle_number  VARCHAR(50) NOT NULL,
    capacity        INT NOT NULL DEFAULT 1,
    available_seats INT NOT NULL DEFAULT 1,
    driver_name     VARCHAR(100),
    driver_phone    VARCHAR(30),
    status          VARCHAR(30) NOT NULL DEFAULT 'Active',
    -- Active | Maintenance | OutOfService
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    soft_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(institution_id, vehicle_number)
);

-- ── Transport Allocations ────────────────────────────────────────────────────────
CREATE TABLE transport_allocations (
    allocation_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id  UUID NOT NULL REFERENCES institutions(institution_id),
    student_id      UUID NOT NULL REFERENCES student_profiles(student_id),
    route_id        UUID NOT NULL REFERENCES transport_routes(route_id),
    stop_id         UUID NOT NULL REFERENCES transport_stops(stop_id),
    vehicle_id      UUID NOT NULL REFERENCES transport_vehicles(vehicle_id),
    start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date        DATE,
    status          VARCHAR(30) NOT NULL DEFAULT 'Active',
    -- Active | Vacated | Cancelled
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transport_allocations_student ON transport_allocations(student_id);
CREATE INDEX idx_transport_allocations_route ON transport_allocations(route_id);
CREATE INDEX idx_transport_allocations_vehicle ON transport_allocations(vehicle_id);

-- Seed transport permissions directly for existing roles in the DB
INSERT INTO role_permissions (permission_id, role_id, resource, action)
SELECT uuid_generate_v4(), role_id, 'transport', 'manage'
FROM roles WHERE role_name IN ('Principal', 'Registrar', 'Faculty')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (permission_id, role_id, resource, action)
SELECT uuid_generate_v4(), role_id, 'transport', 'view'
FROM roles WHERE role_name IN ('Principal', 'Registrar', 'Faculty', 'Student')
ON CONFLICT DO NOTHING;
