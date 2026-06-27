use sqlx::PgPool;
use uuid::Uuid;
use chrono::Utc;
use crate::{
    error::AppError,
    events::{bus::EventBus, types::*},
    middleware::auth::Claims,
    modules::transport::models::*,
};

pub async fn create_route(
    db: &PgPool,
    claims: &Claims,
    req: CreateRouteRequest,
) -> Result<TransportRoute, AppError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM transport_routes WHERE institution_id = $1 AND route_code = $2 AND soft_deleted = false)"
    )
    .bind(claims.institution_id)
    .bind(&req.route_code)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    if exists {
        return Err(AppError::BadRequest("Route code already registered".into()));
    }

    let route = sqlx::query_as::<_, TransportRoute>(
        r#"
        INSERT INTO transport_routes (
            institution_id, route_code, route_name, start_location, end_location
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING route_id, institution_id, route_code, route_name, start_location, end_location, created_at, updated_at, soft_deleted
        "#
    )
    .bind(claims.institution_id)
    .bind(&req.route_code)
    .bind(&req.route_name)
    .bind(&req.start_location)
    .bind(&req.end_location)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(route)
}

pub async fn list_routes(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<TransportRoute>, AppError> {
    let routes = sqlx::query_as::<_, TransportRoute>(
        r#"
        SELECT route_id, institution_id, route_code, route_name, start_location, end_location, created_at, updated_at, soft_deleted
        FROM transport_routes
        WHERE institution_id = $1 AND soft_deleted = false
        ORDER BY route_code ASC
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(routes)
}

pub async fn create_stop(
    db: &PgPool,
    claims: &Claims,
    req: CreateStopRequest,
) -> Result<TransportStop, AppError> {
    // Verify route exists and belongs to institution
    let route_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM transport_routes WHERE route_id = $1 AND institution_id = $2 AND soft_deleted = false)"
    )
    .bind(req.route_id)
    .bind(claims.institution_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    if !route_exists {
        return Err(AppError::NotFound("Route not found".into()));
    }

    let pickup_time = chrono::NaiveTime::parse_from_str(&req.pickup_time, "%H:%M:%S")
        .or_else(|_| chrono::NaiveTime::parse_from_str(&req.pickup_time, "%H:%M"))
        .map_err(|_| AppError::BadRequest("Invalid pickup time format (use HH:MM:SS or HH:MM)".into()))?;

    let stop = sqlx::query_as::<_, TransportStop>(
        r#"
        INSERT INTO transport_stops (
            route_id, stop_name, pickup_time, fare_amount
        )
        VALUES ($1, $2, $3, $4)
        RETURNING stop_id, route_id, stop_name, pickup_time, CAST(fare_amount AS TEXT) AS fare_amount, created_at, updated_at, soft_deleted
        "#
    )
    .bind(req.route_id)
    .bind(&req.stop_name)
    .bind(pickup_time)
    .bind(req.fare_amount)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(stop)
}

pub async fn list_stops(
    db: &PgPool,
    route_id: Uuid,
) -> Result<Vec<TransportStop>, AppError> {
    let stops = sqlx::query_as::<_, TransportStop>(
        r#"
        SELECT stop_id, route_id, stop_name, pickup_time, CAST(fare_amount AS TEXT) AS fare_amount, created_at, updated_at, soft_deleted
        FROM transport_stops
        WHERE route_id = $1 AND soft_deleted = false
        ORDER BY pickup_time ASC
        "#
    )
    .bind(route_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(stops)
}

pub async fn create_vehicle(
    db: &PgPool,
    claims: &Claims,
    req: CreateVehicleRequest,
) -> Result<TransportVehicle, AppError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM transport_vehicles WHERE institution_id = $1 AND vehicle_number = $2 AND soft_deleted = false)"
    )
    .bind(claims.institution_id)
    .bind(&req.vehicle_number)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    if exists {
        return Err(AppError::BadRequest("Vehicle already registered".into()));
    }

    let vehicle = sqlx::query_as::<_, TransportVehicle>(
        r#"
        INSERT INTO transport_vehicles (
            institution_id, vehicle_number, capacity, available_seats, driver_name, driver_phone, status
        )
        VALUES ($1, $2, $3, $3, $4, $5, 'Active')
        RETURNING vehicle_id, institution_id, vehicle_number, capacity, available_seats, driver_name, driver_phone, status, created_at, updated_at, soft_deleted
        "#
    )
    .bind(claims.institution_id)
    .bind(&req.vehicle_number)
    .bind(req.capacity)
    .bind(req.driver_name)
    .bind(req.driver_phone)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(vehicle)
}

pub async fn list_vehicles(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<TransportVehicle>, AppError> {
    let vehicles = sqlx::query_as::<_, TransportVehicle>(
        r#"
        SELECT vehicle_id, institution_id, vehicle_number, capacity, available_seats, driver_name, driver_phone, status, created_at, updated_at, soft_deleted
        FROM transport_vehicles
        WHERE institution_id = $1 AND soft_deleted = false
        ORDER BY vehicle_number ASC
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(vehicles)
}

pub async fn allocate_transport(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: AllocateTransportRequest,
) -> Result<TransportAllocation, AppError> {
    // 1. Validate route and stop
    let route = sqlx::query_as::<_, TransportRoute>(
        r#"SELECT route_id, institution_id, route_code, route_name, start_location, end_location, created_at, updated_at, soft_deleted
           FROM transport_routes
           WHERE route_id = $1 AND institution_id = $2 AND soft_deleted = false"#
    )
    .bind(req.route_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Route not found".into()))?;

    let stop = sqlx::query_as::<_, TransportStop>(
        r#"SELECT stop_id, route_id, stop_name, pickup_time, CAST(fare_amount AS TEXT) AS fare_amount, created_at, updated_at, soft_deleted
           FROM transport_stops
           WHERE stop_id = $1 AND route_id = $2 AND soft_deleted = false"#
    )
    .bind(req.stop_id)
    .bind(route.route_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Stop not found on selected route".into()))?;

    // 2. Fetch and check vehicle
    let vehicle = sqlx::query_as::<_, TransportVehicle>(
        r#"SELECT vehicle_id, institution_id, vehicle_number, capacity, available_seats, driver_name, driver_phone, status, created_at, updated_at, soft_deleted
           FROM transport_vehicles
           WHERE vehicle_id = $1 AND institution_id = $2 AND soft_deleted = false"#
    )
    .bind(req.vehicle_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Vehicle not found".into()))?;

    if vehicle.available_seats <= 0 {
        return Err(AppError::BadRequest("No available seats in this vehicle".into()));
    }

    // 3. Validate student exists
    let student_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM student_profiles WHERE student_id = $1 AND institution_id = $2 AND soft_deleted = false)"
    )
    .bind(req.student_id)
    .bind(claims.institution_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    if !student_exists {
        return Err(AppError::NotFound("Student not found".into()));
    }

    // 4. Start Transaction
    let mut tx = db.begin().await.map_err(AppError::Database)?;

    let affected = sqlx::query(
        "UPDATE transport_vehicles SET available_seats = available_seats - 1, updated_at = NOW() WHERE vehicle_id = $1 AND available_seats > 0"
    )
    .bind(vehicle.vehicle_id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    if affected.rows_affected() == 0 {
        return Err(AppError::BadRequest("No available seats in this vehicle".into()));
    }

    let start_date = Utc::now().date_naive();
    let allocation = sqlx::query_as::<_, TransportAllocation>(
        r#"
        INSERT INTO transport_allocations (
            institution_id, student_id, route_id, stop_id, vehicle_id, start_date, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'Active')
        RETURNING allocation_id, institution_id, student_id, route_id, stop_id, vehicle_id, start_date, end_date, status, created_at, updated_at
        "#
    )
    .bind(claims.institution_id)
    .bind(req.student_id)
    .bind(route.route_id)
    .bind(stop.stop_id)
    .bind(vehicle.vehicle_id)
    .bind(start_date)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    tx.commit().await.map_err(AppError::Database)?;

    // 5. Calculate fare charge and publish saga event
    let fare: f64 = stop.fare_amount.parse().unwrap_or(0.0);

    bus.publish(DomainEvent::TransportChargeGenerated(TransportChargeGeneratedPayload {
        allocation_id: allocation.allocation_id,
        student_id: allocation.student_id,
        institution_id: allocation.institution_id,
        amount: fare,
        occurred_at: Utc::now(),
    }));

    Ok(allocation)
}

pub async fn vacate_transport(
    db: &PgPool,
    claims: &Claims,
    allocation_id: Uuid,
) -> Result<TransportAllocation, AppError> {
    let allocation = sqlx::query_as::<_, TransportAllocation>(
        r#"SELECT allocation_id, institution_id, student_id, route_id, stop_id, vehicle_id, start_date, end_date, status, created_at, updated_at
           FROM transport_allocations
           WHERE allocation_id = $1 AND institution_id = $2"#
    )
    .bind(allocation_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Transport allocation registry not found".into()))?;

    if allocation.status == "Vacated" {
        return Err(AppError::BadRequest("Passenger has already vacated".into()));
    }

    let end_date = Utc::now().date_naive();
    let mut tx = db.begin().await.map_err(AppError::Database)?;

    sqlx::query(
        "UPDATE transport_vehicles SET available_seats = available_seats + 1, updated_at = NOW() WHERE vehicle_id = $1"
    )
    .bind(allocation.vehicle_id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    let updated_alloc = sqlx::query_as::<_, TransportAllocation>(
        r#"
        UPDATE transport_allocations
        SET status = 'Vacated', end_date = $1, updated_at = NOW()
        WHERE allocation_id = $2 AND institution_id = $3
        RETURNING allocation_id, institution_id, student_id, route_id, stop_id, vehicle_id, start_date, end_date, status, created_at, updated_at
        "#
    )
    .bind(end_date)
    .bind(allocation_id)
    .bind(claims.institution_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    tx.commit().await.map_err(AppError::Database)?;

    Ok(updated_alloc)
}

pub async fn list_allocations(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<TransportAllocationResponse>, AppError> {
    let allocations = sqlx::query_as::<_, TransportAllocationResponse>(
        r#"
        SELECT
            a.allocation_id,
            a.route_id,
            r.route_code,
            r.route_name,
            a.stop_id,
            s.stop_name,
            s.pickup_time,
            a.vehicle_id,
            v.vehicle_number,
            v.driver_name,
            v.driver_phone,
            a.student_id,
            CONCAT(p.first_name, ' ', p.last_name) AS student_name,
            a.start_date,
            a.end_date,
            a.status,
            CAST(s.fare_amount AS TEXT) AS fare_amount
        FROM transport_allocations a
        JOIN transport_routes r ON a.route_id = r.route_id
        JOIN transport_stops s ON a.stop_id = s.stop_id
        JOIN transport_vehicles v ON a.vehicle_id = v.vehicle_id
        JOIN student_profiles sp ON a.student_id = sp.student_id
        JOIN persons p ON sp.person_id = p.person_id
        WHERE a.institution_id = $1
        ORDER BY a.created_at DESC
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(allocations)
}

pub async fn list_student_allocations(
    db: &PgPool,
    claims: &Claims,
    student_id: Uuid,
) -> Result<Vec<TransportAllocationResponse>, AppError> {
    if claims.role_name == "Student" {
        let caller_student_id: Uuid = sqlx::query_scalar(
            "SELECT sp.student_id FROM student_profiles sp
             JOIN users u ON sp.person_id = u.person_id
             WHERE u.user_id = $1 AND sp.institution_id = $2"
        )
        .bind(claims.sub)
        .bind(claims.institution_id)
        .fetch_optional(db)
        .await
        .map_err(AppError::Database)?
        .ok_or_else(|| AppError::Unauthorized("Student profile not found".into()))?;

        if caller_student_id != student_id {
            return Err(AppError::Forbidden);
        }
    }

    let allocations = sqlx::query_as::<_, TransportAllocationResponse>(
        r#"
        SELECT
            a.allocation_id,
            a.route_id,
            r.route_code,
            r.route_name,
            a.stop_id,
            s.stop_name,
            s.pickup_time,
            a.vehicle_id,
            v.vehicle_number,
            v.driver_name,
            v.driver_phone,
            a.student_id,
            CONCAT(p.first_name, ' ', p.last_name) AS student_name,
            a.start_date,
            a.end_date,
            a.status,
            CAST(s.fare_amount AS TEXT) AS fare_amount
        FROM transport_allocations a
        JOIN transport_routes r ON a.route_id = r.route_id
        JOIN transport_stops s ON a.stop_id = s.stop_id
        JOIN transport_vehicles v ON a.vehicle_id = v.vehicle_id
        JOIN student_profiles sp ON a.student_id = sp.student_id
        JOIN persons p ON sp.person_id = p.person_id
        WHERE a.student_id = $1 AND a.institution_id = $2
        ORDER BY a.created_at DESC
        "#
    )
    .bind(student_id)
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(allocations)
}
