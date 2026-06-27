use sqlx::PgPool;
use uuid::Uuid;
use anyhow::Result;
use chrono::{Datelike, Local, Duration};

use super::models::*;

/// ── Visits ────────────────────────────────────────────────────────────────────

pub async fn list_visits(
    db: &PgPool,
    institution_id: Uuid,
    student_id: Option<Uuid>,
) -> Result<Vec<MedicalVisitResponse>> {
    let rows = sqlx::query_as::<_, MedicalVisitResponse>(
        r#"
        SELECT
            v.visit_id,
            v.student_id,
            p.first_name || ' ' || p.last_name AS student_name,
            s.enrollment_number AS roll_number,
            v.visit_date,
            v.chief_complaint,
            v.doctor_name,
            v.diagnosis,
            v.notes,
            v.follow_up_date,
            v.status,
            v.created_at
        FROM medical_visits v
        JOIN student_profiles s ON s.student_id = v.student_id
        JOIN persons p ON p.person_id = s.person_id
        WHERE v.institution_id = $1
          AND ($2::UUID IS NULL OR v.student_id = $2)
        ORDER BY v.visit_date DESC, v.created_at DESC
        "#
    )
    .bind(institution_id)
    .bind(student_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn create_visit(
    db: &PgPool,
    institution_id: Uuid,
    req: CreateVisitRequest,
) -> Result<MedicalVisit> {
    let row = sqlx::query_as::<_, MedicalVisit>(
        r#"
        INSERT INTO medical_visits
            (institution_id, student_id, chief_complaint, doctor_name,
             diagnosis, notes, follow_up_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        "#
    )
    .bind(institution_id)
    .bind(req.student_id)
    .bind(&req.chief_complaint)
    .bind(&req.doctor_name)
    .bind(&req.diagnosis)
    .bind(&req.notes)
    .bind(req.follow_up_date)
    .fetch_one(db)
    .await?;
    Ok(row)
}

pub async fn close_visit(
    db: &PgPool,
    visit_id: Uuid,
    req: CloseVisitRequest,
) -> Result<MedicalVisit> {
    let row = sqlx::query_as::<_, MedicalVisit>(
        r#"
        UPDATE medical_visits
        SET diagnosis = COALESCE($1, diagnosis),
            notes = COALESCE($2, notes),
            follow_up_date = $3,
            status = $4,
            updated_at = NOW()
        WHERE visit_id = $5
        RETURNING *
        "#
    )
    .bind(&req.diagnosis)
    .bind(&req.notes)
    .bind(req.follow_up_date)
    .bind(&req.status)
    .bind(visit_id)
    .fetch_one(db)
    .await?;
    Ok(row)
}

/// ── Vitals ────────────────────────────────────────────────────────────────────

pub async fn record_vitals(
    db: &PgPool,
    visit_id: Uuid,
    req: RecordVitalsRequest,
) -> Result<MedicalVital> {
    let row = sqlx::query_as::<_, MedicalVital>(
        r#"
        INSERT INTO medical_vitals
            (visit_id, temperature_c, pulse_bpm, bp_systolic, bp_diastolic,
             spo2_pct, weight_kg, height_cm)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        "#
    )
    .bind(visit_id)
    .bind(req.temperature_c)
    .bind(req.pulse_bpm)
    .bind(req.bp_systolic)
    .bind(req.bp_diastolic)
    .bind(req.spo2_pct)
    .bind(req.weight_kg)
    .bind(req.height_cm)
    .fetch_one(db)
    .await?;
    Ok(row)
}

pub async fn get_vitals(
    db: &PgPool,
    visit_id: Uuid,
) -> Result<Vec<MedicalVital>> {
    let rows = sqlx::query_as::<_, MedicalVital>(
        "SELECT * FROM medical_vitals WHERE visit_id = $1 ORDER BY recorded_at DESC"
    )
    .bind(visit_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

/// ── Prescriptions ─────────────────────────────────────────────────────────────

pub async fn get_prescriptions(
    db: &PgPool,
    visit_id: Uuid,
) -> Result<Vec<MedicalPrescription>> {
    let rows = sqlx::query_as::<_, MedicalPrescription>(
        "SELECT * FROM medical_prescriptions WHERE visit_id = $1 ORDER BY created_at ASC"
    )
    .bind(visit_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn create_prescription(
    db: &PgPool,
    req: CreatePrescriptionRequest,
) -> Result<MedicalPrescription> {
    let row = sqlx::query_as::<_, MedicalPrescription>(
        r#"
        INSERT INTO medical_prescriptions
            (visit_id, medicine_name, dosage, frequency, duration_days, route, instructions)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        "#
    )
    .bind(req.visit_id)
    .bind(&req.medicine_name)
    .bind(&req.dosage)
    .bind(&req.frequency)
    .bind(req.duration_days)
    .bind(&req.route)
    .bind(&req.instructions)
    .fetch_one(db)
    .await?;
    Ok(row)
}

/// ── Inventory ─────────────────────────────────────────────────────────────────

pub async fn list_inventory(
    db: &PgPool,
    institution_id: Uuid,
) -> Result<Vec<MedicalInventoryItem>> {
    let rows = sqlx::query_as::<_, MedicalInventoryItem>(
        r#"
        SELECT * FROM medical_inventory
        WHERE institution_id = $1 AND soft_deleted = FALSE
        ORDER BY item_name ASC
        "#
    )
    .bind(institution_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn create_inventory_item(
    db: &PgPool,
    institution_id: Uuid,
    req: CreateInventoryItemRequest,
) -> Result<MedicalInventoryItem> {
    let row = sqlx::query_as::<_, MedicalInventoryItem>(
        r#"
        INSERT INTO medical_inventory
            (institution_id, item_name, item_category, unit,
             quantity_in_stock, reorder_level, expiry_date, batch_number, manufacturer)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        "#
    )
    .bind(institution_id)
    .bind(&req.item_name)
    .bind(&req.item_category)
    .bind(&req.unit)
    .bind(req.quantity_in_stock)
    .bind(req.reorder_level)
    .bind(req.expiry_date)
    .bind(&req.batch_number)
    .bind(&req.manufacturer)
    .fetch_one(db)
    .await?;
    Ok(row)
}

pub async fn adjust_stock(
    db: &PgPool,
    item_id: Uuid,
    req: AdjustStockRequest,
) -> Result<MedicalInventoryItem> {
    // Verify non-negative stock after adjustment
    let current: i32 = sqlx::query_scalar(
        "SELECT quantity_in_stock FROM medical_inventory WHERE item_id = $1 AND soft_deleted = FALSE"
    )
    .bind(item_id)
    .fetch_one(db)
    .await?;

    let new_qty = current + req.delta;
    if new_qty < 0 {
        return Err(anyhow::anyhow!("Insufficient stock. Available: {}", current));
    }

    let row = sqlx::query_as::<_, MedicalInventoryItem>(
        r#"
        UPDATE medical_inventory
        SET quantity_in_stock = $1, updated_at = NOW()
        WHERE item_id = $2 AND soft_deleted = FALSE
        RETURNING *
        "#
    )
    .bind(new_qty)
    .bind(item_id)
    .fetch_one(db)
    .await?;
    Ok(row)
}

/// ── Sick Leaves ───────────────────────────────────────────────────────────────

pub async fn list_sick_leaves(
    db: &PgPool,
    institution_id: Uuid,
    student_id: Option<Uuid>,
) -> Result<Vec<SickLeaveResponse>> {
    let rows = sqlx::query_as::<_, SickLeaveResponse>(
        r#"
        SELECT
            sl.sick_leave_id,
            sl.student_id,
            p.first_name || ' ' || p.last_name AS student_name,
            s.enrollment_number AS roll_number,
            sl.leave_from,
            sl.leave_to,
            sl.days,
            sl.doctor_name,
            sl.remarks,
            sl.certificate_number,
            sl.issued_at
        FROM medical_sick_leaves sl
        JOIN student_profiles s ON s.student_id = sl.student_id
        JOIN persons p ON p.person_id = s.person_id
        WHERE sl.institution_id = $1
          AND ($2::UUID IS NULL OR sl.student_id = $2)
        ORDER BY sl.issued_at DESC
        "#
    )
    .bind(institution_id)
    .bind(student_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn issue_sick_leave(
    db: &PgPool,
    institution_id: Uuid,
    req: IssueSickLeaveRequest,
) -> Result<MedicalSickLeave> {
    if req.leave_to < req.leave_from {
        return Err(anyhow::anyhow!("leave_to must be on or after leave_from"));
    }

    // Generate certificate number: SL-{YYYYMMDD}-{random 6 chars}
    let cert_num = format!("SL-{}-{}", Local::now().format("%Y%m%d"),
        uuid::Uuid::new_v4().to_string()[..6].to_uppercase());

    let row = sqlx::query_as::<_, MedicalSickLeave>(
        r#"
        INSERT INTO medical_sick_leaves
            (visit_id, student_id, institution_id, leave_from, leave_to, doctor_name, remarks, certificate_number)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        "#
    )
    .bind(req.visit_id)
    .bind(req.student_id)
    .bind(institution_id)
    .bind(req.leave_from)
    .bind(req.leave_to)
    .bind(&req.doctor_name)
    .bind(&req.remarks)
    .bind(&cert_num)
    .fetch_one(db)
    .await?;
    Ok(row)
}

/// ── Stats ─────────────────────────────────────────────────────────────────────

pub async fn get_medical_stats(
    db: &PgPool,
    institution_id: Uuid,
) -> Result<MedicalStats> {
    let today = Local::now().date_naive();
    let month_start = today.with_day(1).unwrap_or(today);

    let total_visits_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM medical_visits WHERE institution_id = $1 AND visit_date = $2"
    ).bind(institution_id).bind(today).fetch_one(db).await?;

    let total_visits_month: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM medical_visits WHERE institution_id = $1 AND visit_date >= $2"
    ).bind(institution_id).bind(month_start).fetch_one(db).await?;

    let open_visits: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM medical_visits WHERE institution_id = $1 AND status = 'Open'"
    ).bind(institution_id).fetch_one(db).await?;

    let sick_leaves_issued: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM medical_sick_leaves WHERE institution_id = $1"
    ).bind(institution_id).fetch_one(db).await?;

    let low_stock_items: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM medical_inventory WHERE institution_id = $1 AND soft_deleted = FALSE AND quantity_in_stock <= reorder_level"
    ).bind(institution_id).fetch_one(db).await?;

    let expiry_cutoff = today + Duration::days(30);
    let expiring_soon_items: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM medical_inventory WHERE institution_id = $1 AND soft_deleted = FALSE AND expiry_date IS NOT NULL AND expiry_date <= $2"
    ).bind(institution_id).bind(expiry_cutoff).fetch_one(db).await?;

    Ok(MedicalStats {
        total_visits_today,
        total_visits_month,
        open_visits,
        sick_leaves_issued,
        low_stock_items,
        expiring_soon_items,
    })
}
