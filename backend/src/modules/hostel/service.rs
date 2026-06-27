use sqlx::PgPool;
use uuid::Uuid;
use chrono::Utc;
use crate::{
    error::AppError,
    events::{bus::EventBus, types::*},
    middleware::auth::Claims,
    modules::hostel::models::*,
};

pub async fn create_room(
    db: &PgPool,
    claims: &Claims,
    req: CreateRoomRequest,
) -> Result<HostelRoom, AppError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM hostel_rooms WHERE institution_id = $1 AND hostel_name = $2 AND room_number = $3 AND soft_deleted = false)"
    )
    .bind(claims.institution_id)
    .bind(&req.hostel_name)
    .bind(&req.room_number)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    if exists {
        return Err(AppError::BadRequest("Room already registered in this hostel".into()));
    }

    let room = sqlx::query_as::<_, HostelRoom>(
        r#"
        INSERT INTO hostel_rooms (
            institution_id, hostel_name, room_number, room_type, capacity, available_beds, rent_amount
        )
        VALUES ($1, $2, $3, $4, $5, $5, $6)
        RETURNING room_id, institution_id, hostel_name, room_number, room_type, capacity, available_beds, CAST(rent_amount AS TEXT) AS rent_amount, created_at, updated_at, soft_deleted
        "#
    )
    .bind(claims.institution_id)
    .bind(&req.hostel_name)
    .bind(&req.room_number)
    .bind(&req.room_type)
    .bind(req.capacity)
    .bind(req.rent_amount)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(room)
}

pub async fn list_rooms(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<HostelRoom>, AppError> {
    let rooms = sqlx::query_as::<_, HostelRoom>(
        r#"
        SELECT room_id, institution_id, hostel_name, room_number, room_type, capacity, available_beds, CAST(rent_amount AS TEXT) AS rent_amount, created_at, updated_at, soft_deleted
        FROM hostel_rooms
        WHERE institution_id = $1 AND soft_deleted = false
        ORDER BY hostel_name, room_number ASC
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(rooms)
}

pub async fn allocate_room(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: AllocateRoomRequest,
) -> Result<HostelAllocation, AppError> {
    // 1. Fetch room
    let room = sqlx::query_as::<_, HostelRoom>(
        r#"SELECT room_id, institution_id, hostel_name, room_number, room_type, capacity, available_beds, CAST(rent_amount AS TEXT) AS rent_amount, created_at, updated_at, soft_deleted
           FROM hostel_rooms
           WHERE room_id = $1 AND institution_id = $2 AND soft_deleted = false"#
    )
    .bind(req.room_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Room not found".into()))?;

    if room.available_beds <= 0 {
        return Err(AppError::BadRequest("No available beds in this room".into()));
    }

    // 2. Validate student exists
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

    // 3. Start Transaction
    let mut tx = db.begin().await.map_err(AppError::Database)?;

    let affected = sqlx::query(
        "UPDATE hostel_rooms SET available_beds = available_beds - 1, updated_at = NOW() WHERE room_id = $1 AND available_beds > 0"
    )
    .bind(room.room_id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    if affected.rows_affected() == 0 {
        return Err(AppError::BadRequest("No available beds in this room".into()));
    }

    let start_date = Utc::now().date_naive();
    let allocation = sqlx::query_as::<_, HostelAllocation>(
        r#"
        INSERT INTO hostel_allocations (
            institution_id, room_id, student_id, start_date, mess_plan, status
        )
        VALUES ($1, $2, $3, $4, $5, 'Active')
        RETURNING allocation_id, institution_id, room_id, student_id, start_date, end_date, mess_plan, status, created_at, updated_at
        "#
    )
    .bind(claims.institution_id)
    .bind(room.room_id)
    .bind(req.student_id)
    .bind(start_date)
    .bind(&req.mess_plan)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    tx.commit().await.map_err(AppError::Database)?;

    // 4. Calculate total charging amount
    let rent: f64 = room.rent_amount.parse().unwrap_or(0.0);
    let mess_fee = match req.mess_plan.as_str() {
        "Veg" => 2000.0,
        "Non-Veg" => 3000.0,
        _ => 0.0,
    };
    let total_amount = rent + mess_fee;

    // 5. Publish domain event
    bus.publish(DomainEvent::HostelChargeGenerated(HostelChargeGeneratedPayload {
        allocation_id: allocation.allocation_id,
        student_id: allocation.student_id,
        institution_id: allocation.institution_id,
        amount: total_amount,
        occurred_at: Utc::now(),
    }));

    Ok(allocation)
}

pub async fn vacate_room(
    db: &PgPool,
    claims: &Claims,
    allocation_id: Uuid,
) -> Result<HostelAllocation, AppError> {
    let allocation = sqlx::query_as::<_, HostelAllocation>(
        r#"SELECT allocation_id, institution_id, room_id, student_id, start_date, end_date, mess_plan, status, created_at, updated_at
           FROM hostel_allocations
           WHERE allocation_id = $1 AND institution_id = $2"#
    )
    .bind(allocation_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Hostel room stay allocation not found".into()))?;

    if allocation.status == "Vacated" {
        return Err(AppError::BadRequest("Stay allocation has already been vacated".into()));
    }

    let end_date = Utc::now().date_naive();
    let mut tx = db.begin().await.map_err(AppError::Database)?;

    sqlx::query(
        "UPDATE hostel_rooms SET available_beds = available_beds + 1, updated_at = NOW() WHERE room_id = $1"
    )
    .bind(allocation.room_id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    let updated_alloc = sqlx::query_as::<_, HostelAllocation>(
        r#"
        UPDATE hostel_allocations
        SET status = 'Vacated', end_date = $1, updated_at = NOW()
        WHERE allocation_id = $2 AND institution_id = $3
        RETURNING allocation_id, institution_id, room_id, student_id, start_date, end_date, mess_plan, status, created_at, updated_at
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
) -> Result<Vec<RoomAllocationResponse>, AppError> {
    let allocations = sqlx::query_as::<_, RoomAllocationResponse>(
        r#"
        SELECT
            a.allocation_id,
            a.room_id,
            r.hostel_name,
            r.room_number,
            r.room_type,
            a.student_id,
            CONCAT(p.first_name, ' ', p.last_name) AS student_name,
            a.start_date,
            a.end_date,
            a.mess_plan,
            a.status,
            CAST(r.rent_amount AS TEXT) AS rent_amount
        FROM hostel_allocations a
        JOIN hostel_rooms r ON a.room_id = r.room_id
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
) -> Result<Vec<RoomAllocationResponse>, AppError> {
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

    let allocations = sqlx::query_as::<_, RoomAllocationResponse>(
        r#"
        SELECT
            a.allocation_id,
            a.room_id,
            r.hostel_name,
            r.room_number,
            r.room_type,
            a.student_id,
            CONCAT(p.first_name, ' ', p.last_name) AS student_name,
            a.start_date,
            a.end_date,
            a.mess_plan,
            a.status,
            CAST(r.rent_amount AS TEXT) AS rent_amount
        FROM hostel_allocations a
        JOIN hostel_rooms r ON a.room_id = r.room_id
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
