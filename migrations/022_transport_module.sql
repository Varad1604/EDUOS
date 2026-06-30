-- Module 8: Transport Additions

-- Transport Drivers
CREATE TABLE transport_drivers (
    driver_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    name VARCHAR(100) NOT NULL,
    license_number VARCHAR(50) NOT NULL UNIQUE,
    contact_number VARCHAR(20) NOT NULL,
    assigned_vehicle_id UUID REFERENCES transport_vehicles(vehicle_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip Logs
CREATE TABLE transport_trip_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(institution_id),
    route_id UUID NOT NULL REFERENCES transport_routes(route_id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES transport_vehicles(vehicle_id) ON DELETE CASCADE,
    driver_id UUID REFERENCES transport_drivers(driver_id) ON DELETE SET NULL,
    departure_time TIMESTAMPTZ,
    arrival_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'Scheduled', -- Scheduled, InTransit, Completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
