use axum::{extract::{Path, Query, State}, Extension, Json};
use serde_json::json;
use uuid::Uuid;
use crate::{error::AppError, middleware::auth::Claims, modules::finance::{models::*, service}, state::AppState};

fn ok<T: serde::Serialize>(data: T) -> Json<serde_json::Value> {
    Json(json!({ "success": true, "data": data, "meta": { "timestamp": chrono::Utc::now() } }))
}

// ── Fee Structures ────────────────────────────────────────────────────────────
pub async fn create_fee_structure(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateFeeStructureRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::create_fee_structure(&s.db, &s.bus, &c, b).await?))
}

pub async fn list_fee_structures(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Query(q): Query<FeeListQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let structures = sqlx::query_as::<_, FeeStructure>(
        r#"SELECT fee_structure_id, institution_id, academic_year, branch_id,
                  category, quota, semesters,
                  CAST(total_amount AS TEXT) AS total_amount, created_at
           FROM fee_structures
           WHERE institution_id = $1 AND ($2::int IS NULL OR academic_year = $2)
           ORDER BY academic_year DESC"#
    )
    .bind(c.institution_id).bind(q.academic_year).fetch_all(&s.db).await.map_err(AppError::Database)?;
    Ok(ok(structures))
}

// ── Fee Allocations ───────────────────────────────────────────────────────────
pub async fn allocate_fee(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<AllocateFeeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::allocate_fee(&s.db, &s.bus, &c, b).await?))
}

pub async fn get_student_fee_summary(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::get_student_fee_summary(&s.db, &c, student_id).await?))
}

// ── Payments ──────────────────────────────────────────────────────────────────
pub async fn initiate_payment(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<InitiatePaymentRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::initiate_payment(&s.db, &s.bus, &c, b).await?))
}

pub async fn get_payments(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(student_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let payments = sqlx::query_as::<_, FeePayment>(
        r#"SELECT payment_id, institution_id, fee_allocation_id, student_id,
                  CAST(amount AS TEXT) AS amount,
                  payment_mode, payment_gateway, transaction_id,
                  payment_date, status, receipt_number, receipt_generated,
                  created_at, soft_deleted
           FROM fee_payments
           WHERE student_id = $1 AND institution_id = $2 AND soft_deleted = false
           ORDER BY created_at DESC"#
    )
    .bind(student_id).bind(c.institution_id).fetch_all(&s.db).await.map_err(AppError::Database)?;
    Ok(ok(payments))
}

// ── Scholarships ──────────────────────────────────────────────────────────────
pub async fn create_scholarship(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateScholarshipRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::create_scholarship(&s.db, &c, b).await?))
}

pub async fn list_scholarships(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let s_list = sqlx::query_as::<_, Scholarship>(
        r#"SELECT scholarship_id, institution_id, scholarship_name, scholarship_type,
                  CAST(amount AS TEXT) AS amount,
                  eligibility_criteria, academic_year, total_beneficiaries,
                  application_deadline, created_at
           FROM scholarships WHERE institution_id = $1 ORDER BY created_at DESC"#
    )
    .bind(c.institution_id).fetch_all(&s.db).await.map_err(AppError::Database)?;
    Ok(ok(s_list))
}

pub async fn allocate_scholarship(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(scholarship_id): Path<Uuid>, Json(b): Json<AllocateScholarshipRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::allocate_scholarship(&s.db, &s.bus, &c, scholarship_id, b).await?))
}

// ── Accounting ────────────────────────────────────────────────────────────────
pub async fn create_account(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateAccountRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::create_account(&s.db, &c, b).await?))
}

pub async fn list_accounts(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let accounts = sqlx::query_as::<_, Account>(
        r#"SELECT account_id, institution_id, account_code, account_name, account_type,
                  CAST(opening_balance AS TEXT) AS opening_balance,
                  CAST(current_balance AS TEXT) AS current_balance,
                  fiscal_year, is_active, created_at
           FROM chart_of_accounts WHERE institution_id = $1 AND is_active = true ORDER BY account_code"#
    )
    .bind(c.institution_id).fetch_all(&s.db).await.map_err(AppError::Database)?;
    Ok(ok(accounts))
}

pub async fn create_journal_entry(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateJournalEntryRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::create_journal_entry(&s.db, &s.bus, &c, b).await?))
}

pub async fn approve_journal_entry(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(journal_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::approve_journal_entry(&s.db, &s.bus, &c, journal_id).await?))
}

pub async fn list_journal_entries(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT 
            je.journal_id,
            je.institution_id,
            je.entry_date,
            je.reference,
            je.description,
            je.status,
            je.posted_at,
            je.created_at,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'item_id', ji.item_id,
                            'account_id', ji.account_id,
                            'account_code', coa.account_code,
                            'account_name', coa.account_name,
                            'debit_amount', ji.debit_amount::TEXT,
                            'credit_amount', ji.credit_amount::TEXT,
                            'narration', ji.narration
                        )
                        ORDER BY ji.debit_amount DESC
                    )
                    FROM journal_items ji
                    JOIN chart_of_accounts coa ON ji.account_id = coa.account_id
                    WHERE ji.journal_id = je.journal_id
                ),
                '[]'::json
            ) as items
        FROM journal_entries je
        WHERE je.institution_id = $1
        ORDER BY je.entry_date DESC, je.created_at DESC
        LIMIT 100
        "#
    )
    .bind(c.institution_id)
    .fetch_all(&s.db)
    .await
    .map_err(AppError::Database)?;

    let entries: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        let entry_date: chrono::NaiveDate = row.get("entry_date");
        let posted_at: Option<chrono::DateTime<chrono::Utc>> = row.get("posted_at");
        let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
        json!({
            "journal_id": row.get::<Uuid, _>("journal_id"),
            "institution_id": row.get::<Uuid, _>("institution_id"),
            "entry_date": entry_date.to_string(),
            "reference": row.get::<Option<String>, _>("reference"),
            "description": row.get::<Option<String>, _>("description"),
            "status": row.get::<String, _>("status"),
            "posted_at": posted_at.map(|t| t.to_rfc3339()),
            "created_at": created_at.to_rfc3339(),
            "items": row.get::<serde_json::Value, _>("items"),
        })
    }).collect();

    Ok(ok(entries))
}

// ── Reports ───────────────────────────────────────────────────────────────────
pub async fn balance_sheet(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let accounts = sqlx::query_as::<_, Account>(
        r#"SELECT account_id, institution_id, account_code, account_name, account_type,
                  CAST(opening_balance AS TEXT) AS opening_balance,
                  CAST(current_balance AS TEXT) AS current_balance,
                  fiscal_year, is_active, created_at
           FROM chart_of_accounts
           WHERE institution_id = $1 AND is_active = true
           ORDER BY account_type, account_code"#
    )
    .bind(c.institution_id).fetch_all(&s.db).await.map_err(AppError::Database)?;

    let assets:      Vec<_> = accounts.iter().filter(|a| a.account_type == "Asset").collect();
    let liabilities: Vec<_> = accounts.iter().filter(|a| a.account_type == "Liability").collect();
    let equity:      Vec<_> = accounts.iter().filter(|a| a.account_type == "Equity").collect();

    Ok(ok(json!({ "assets": assets, "liabilities": liabilities, "equity": equity })))
}

pub async fn income_statement(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let accounts = sqlx::query_as::<_, Account>(
        r#"SELECT account_id, institution_id, account_code, account_name, account_type,
                  CAST(opening_balance AS TEXT) AS opening_balance,
                  CAST(current_balance AS TEXT) AS current_balance,
                  fiscal_year, is_active, created_at
           FROM chart_of_accounts
           WHERE institution_id = $1 AND account_type IN ('Income','Expense') AND is_active = true
           ORDER BY account_type, account_code"#
    )
    .bind(c.institution_id).fetch_all(&s.db).await.map_err(AppError::Database)?;

    let income:   Vec<_> = accounts.iter().filter(|a| a.account_type == "Income").collect();
    let expenses: Vec<_> = accounts.iter().filter(|a| a.account_type == "Expense").collect();

    Ok(ok(json!({ "income": income, "expenses": expenses })))
}

pub async fn audit_logs(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT
            e.event_id,
            e.event_type,
            e.aggregate_id,
            e.aggregate_type,
            e.event_payload,
            e.created_at,
            u.username
        FROM event_log e
        LEFT JOIN users u ON e.user_id = u.user_id
        WHERE e.institution_id = $1
        ORDER BY e.created_at DESC
        LIMIT 200
        "#
    )
    .bind(c.institution_id)
    .fetch_all(&s.db)
    .await
    .map_err(AppError::Database)?;

    let logs: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        let created: chrono::DateTime<chrono::Utc> = row.get("created_at");
        json!({
            "event_id": row.get::<Uuid, _>("event_id"),
            "event_type": row.get::<String, _>("event_type"),
            "aggregate_id": row.get::<Uuid, _>("aggregate_id"),
            "aggregate_type": row.get::<Option<String>, _>("aggregate_type"),
            "event_payload": row.get::<serde_json::Value, _>("event_payload"),
            "created_at": created.to_rfc3339(),
            "username": row.get::<Option<String>, _>("username"),
        })
    }).collect();

    Ok(ok(logs))
}

