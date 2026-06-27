use uuid::Uuid;
use chrono::Utc;
use sqlx::PgPool;
use serde_json::json;
use crate::{
    error::AppError,
    events::{bus::EventBus, types::*},
    middleware::auth::Claims,
    modules::finance::models::*,
};
use super::super::student::service::log_event;

pub async fn create_fee_structure(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: CreateFeeStructureRequest,
) -> Result<FeeStructure, AppError> {
    let total: f64 = req.semesters.iter().map(|s| s.amount).sum();
    let semesters_json = serde_json::to_value(&req.semesters)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("JSON error: {}", e)))?;

    let structure = sqlx::query_as::<_, FeeStructure>(
        r#"
        INSERT INTO fee_structures
            (fee_structure_id, institution_id, academic_year, branch_id,
             category, quota, semesters, total_amount)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
        RETURNING fee_structure_id, institution_id, academic_year, branch_id,
                  category, quota, semesters,
                  CAST(total_amount AS TEXT) AS total_amount, created_at
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.academic_year)
    .bind(req.branch_id)
    .bind(&req.category)
    .bind(&req.quota)
    .bind(semesters_json)
    .bind(total)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    bus.publish(DomainEvent::FeeStructureCreated(FeeStructureCreatedPayload {
        fee_structure_id: structure.fee_structure_id,
        institution_id: claims.institution_id,
        academic_year: req.academic_year,
        occurred_at: Utc::now(),
    }));

    Ok(structure)
}

pub async fn allocate_fee(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: AllocateFeeRequest,
) -> Result<FeeAllocation, AppError> {
    // Get structure total as f64
    let total: f64 = sqlx::query_scalar(
        "SELECT CAST(total_amount AS FLOAT8) FROM fee_structures WHERE fee_structure_id = $1 AND institution_id = $2"
    )
    .bind(req.fee_structure_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Fee structure not found".into()))?;

    let alloc = sqlx::query_as::<_, FeeAllocation>(
        r#"
        INSERT INTO fee_allocations
            (fee_allocation_id, institution_id, student_id, fee_structure_id,
             academic_year, semester, total_amount, due_date, status)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'Generated')
        RETURNING fee_allocation_id, institution_id, student_id, fee_structure_id,
                  academic_year, semester,
                  CAST(total_amount AS TEXT) AS total_amount,
                  CAST(paid_amount AS TEXT) AS paid_amount,
                  due_date, status,
                  CAST(waiver_amount AS TEXT) AS waiver_amount,
                  waiver_reason, created_at, soft_deleted
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.student_id)
    .bind(req.fee_structure_id)
    .bind(req.academic_year)
    .bind(req.semester)
    .bind(total)
    .bind(req.due_date)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    log_event(db, claims.institution_id, claims.sub, "FeeAllocated",
        alloc.fee_allocation_id, "Finance",
        json!({ "student_id": req.student_id, "total_amount": total })).await?;

    bus.publish(DomainEvent::FeeAllocated(FeeAllocatedPayload {
        fee_allocation_id: alloc.fee_allocation_id,
        student_id: req.student_id,
        institution_id: claims.institution_id,
        total_amount: total,
        occurred_at: Utc::now(),
    }));

    Ok(alloc)
}

pub async fn initiate_payment(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: InitiatePaymentRequest,
) -> Result<FeePayment, AppError> {
    // Verify allocation and get amounts
    let (student_id, paid_f64, total_f64, status_str): (Uuid, f64, f64, String) = sqlx::query_as(
        "SELECT student_id, CAST(paid_amount AS FLOAT8), CAST(total_amount AS FLOAT8), status FROM fee_allocations WHERE fee_allocation_id = $1 AND institution_id = $2 AND soft_deleted = false"
    )
    .bind(req.fee_allocation_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Fee allocation not found".into()))?;

    if status_str == "Paid" {
        return Err(AppError::Conflict("Fee already fully paid".into()));
    }

    let receipt_num = format!(
        "RCP-{}-{}",
        chrono::Utc::now().format("%Y%m%d"),
        &uuid::Uuid::new_v4().to_string()[..8].to_uppercase()
    );

    // All payment modes are treated as immediately successful in this ERP
    // (no real payment gateway — Razorpay/UPI webhooks would change this in production)
    let status = "Success";

    let payment = sqlx::query_as::<_, FeePayment>(
        r#"
        INSERT INTO fee_payments
            (payment_id, institution_id, fee_allocation_id, student_id,
             amount, payment_mode, payment_gateway, transaction_id,
             payment_date, status, receipt_number, receipt_generated)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10)
        RETURNING payment_id, institution_id, fee_allocation_id, student_id,
                  CAST(amount AS TEXT) AS amount,
                  payment_mode, payment_gateway, transaction_id,
                  payment_date, status, receipt_number, receipt_generated,
                  created_at, soft_deleted
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.fee_allocation_id)
    .bind(student_id)
    .bind(req.amount)
    .bind(&req.payment_mode)
    .bind(&req.payment_gateway)
    .bind(&req.transaction_id)
    .bind(status)
    .bind(&receipt_num)
    .bind(status == "Success")
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    if status == "Success" {
        let new_paid = paid_f64 + req.amount;
        let new_status = if new_paid >= total_f64 { "Paid" } else { "Partial" };
        sqlx::query(
            "UPDATE fee_allocations SET paid_amount = $1, status = $2, updated_at = NOW() WHERE fee_allocation_id = $3"
        )
        .bind(new_paid).bind(new_status).bind(req.fee_allocation_id)
        .execute(db).await.map_err(AppError::Database)?;

        post_fee_journal_entry(db, claims, payment.payment_id, req.amount, &req.payment_mode).await?;

        bus.publish(DomainEvent::PaymentSucceeded(PaymentSucceededPayload {
            payment_id: payment.payment_id,
            student_id,
            institution_id: claims.institution_id,
            amount: req.amount,
            transaction_id: receipt_num,
            occurred_at: Utc::now(),
        }));
    }

    Ok(payment)
}

async fn post_fee_journal_entry(
    db: &PgPool,
    claims: &Claims,
    payment_id: Uuid,
    amount: f64,
    mode: &str,
) -> Result<(), AppError> {
    let debit_account: Option<Uuid> = sqlx::query_scalar(
        "SELECT account_id FROM chart_of_accounts WHERE institution_id = $1 AND account_type = 'Asset' AND is_active = true LIMIT 1"
    )
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    let credit_account: Option<Uuid> = sqlx::query_scalar(
        "SELECT account_id FROM chart_of_accounts WHERE institution_id = $1 AND account_type = 'Income' AND is_active = true LIMIT 1"
    )
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    if let (Some(debit_id), Some(credit_id)) = (debit_account, credit_account) {
        let journal_id: Uuid = sqlx::query_scalar(
            r#"INSERT INTO journal_entries (journal_id, institution_id, reference, description, status, created_by_user_id, posted_at)
               VALUES (gen_random_uuid(), $1, $2, $3, 'Posted', $4, NOW())
               RETURNING journal_id"#,
        )
        .bind(claims.institution_id)
        .bind(format!("FEE_PAYMENT_{}", payment_id))
        .bind(format!("Fee payment received via {}", mode))
        .bind(claims.sub)
        .fetch_one(db)
        .await
        .map_err(AppError::Database)?;

        sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount) VALUES (gen_random_uuid(), $1, $2, $3, 0)")
            .bind(journal_id).bind(debit_id).bind(amount).execute(db).await.map_err(AppError::Database)?;
        sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount) VALUES (gen_random_uuid(), $1, $2, 0, $3)")
            .bind(journal_id).bind(credit_id).bind(amount).execute(db).await.map_err(AppError::Database)?;

        sqlx::query("UPDATE chart_of_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE account_id = $2")
            .bind(amount).bind(debit_id).execute(db).await.map_err(AppError::Database)?;
        sqlx::query("UPDATE chart_of_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE account_id = $2")
            .bind(amount).bind(credit_id).execute(db).await.map_err(AppError::Database)?;
    }

    Ok(())
}

pub async fn get_student_fee_summary(
    db: &PgPool,
    claims: &Claims,
    student_id: Uuid,
) -> Result<FeeSummary, AppError> {
    let allocs = sqlx::query_as::<_, FeeAllocation>(
        r#"SELECT fee_allocation_id, institution_id, student_id, fee_structure_id,
                  academic_year, semester,
                  CAST(total_amount AS TEXT) AS total_amount,
                  CAST(paid_amount AS TEXT) AS paid_amount,
                  due_date, status,
                  CAST(waiver_amount AS TEXT) AS waiver_amount,
                  waiver_reason, created_at, soft_deleted
           FROM fee_allocations
           WHERE student_id = $1 AND institution_id = $2 AND soft_deleted = false
           ORDER BY academic_year, semester"#,
    )
    .bind(student_id)
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let total_due: f64  = allocs.iter().filter_map(|a| a.total_amount.parse::<f64>().ok()).sum();
    let total_paid: f64 = allocs.iter().filter_map(|a| a.paid_amount.parse::<f64>().ok()).sum();
    let outstanding = total_due - total_paid;

    Ok(FeeSummary { student_id, total_due, total_paid, outstanding, allocations: allocs })
}

pub async fn create_scholarship(
    db: &PgPool,
    claims: &Claims,
    req: CreateScholarshipRequest,
) -> Result<Scholarship, AppError> {
    sqlx::query_as::<_, Scholarship>(
        r#"INSERT INTO scholarships
               (scholarship_id, institution_id, scholarship_name, scholarship_type,
                amount, eligibility_criteria, academic_year, total_beneficiaries, application_deadline)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING scholarship_id, institution_id, scholarship_name, scholarship_type,
                     CAST(amount AS TEXT) AS amount,
                     eligibility_criteria, academic_year, total_beneficiaries,
                     application_deadline, created_at"#,
    )
    .bind(claims.institution_id)
    .bind(&req.scholarship_name)
    .bind(&req.scholarship_type)
    .bind(req.amount)
    .bind(req.eligibility_criteria)
    .bind(req.academic_year)
    .bind(req.total_beneficiaries)
    .bind(req.application_deadline)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)
}

pub async fn allocate_scholarship(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    scholarship_id: Uuid,
    req: AllocateScholarshipRequest,
) -> Result<ScholarshipAllotment, AppError> {
    let allotment = sqlx::query_as::<_, ScholarshipAllotment>(
        r#"INSERT INTO scholarship_allotments
               (allotment_id, institution_id, student_id, scholarship_id, amount, status)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Approved')
           RETURNING allotment_id, institution_id, student_id, scholarship_id,
                     allotment_date, CAST(amount AS TEXT) AS amount, status,
                     disbursal_date, disbursal_mode, bank_reference, created_at"#,
    )
    .bind(claims.institution_id)
    .bind(req.student_id)
    .bind(scholarship_id)
    .bind(req.amount)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    bus.publish(DomainEvent::ScholarshipAllocated(ScholarshipAllocatedPayload {
        allotment_id: allotment.allotment_id,
        student_id: req.student_id,
        scholarship_id,
        amount: req.amount,
        occurred_at: Utc::now(),
    }));

    Ok(allotment)
}

pub async fn create_account(
    db: &PgPool,
    claims: &Claims,
    req: CreateAccountRequest,
) -> Result<Account, AppError> {
    sqlx::query_as::<_, Account>(
        r#"INSERT INTO chart_of_accounts
               (account_id, institution_id, account_code, account_name, account_type,
                opening_balance, current_balance, fiscal_year, parent_account_id)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $5, $6, $7)
           RETURNING account_id, institution_id, account_code, account_name, account_type,
                     CAST(opening_balance AS TEXT) AS opening_balance,
                     CAST(current_balance AS TEXT) AS current_balance,
                     fiscal_year, is_active, created_at"#,
    )
    .bind(claims.institution_id)
    .bind(&req.account_code)
    .bind(&req.account_name)
    .bind(&req.account_type)
    .bind(req.opening_balance.unwrap_or(0.0))
    .bind(req.fiscal_year)
    .bind(req.parent_account_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)
}

pub async fn create_journal_entry(
    db: &PgPool,
    _bus: &EventBus,
    claims: &Claims,
    req: CreateJournalEntryRequest,
) -> Result<JournalEntry, AppError> {
    let total_debit: f64  = req.items.iter().map(|i| i.debit_amount.unwrap_or(0.0)).sum();
    let total_credit: f64 = req.items.iter().map(|i| i.credit_amount.unwrap_or(0.0)).sum();
    let diff = (total_debit - total_credit).abs();
    if diff > 0.01 {
        return Err(AppError::UnprocessableEntity(
            format!("Journal entry imbalanced: debits={:.2}, credits={:.2}", total_debit, total_credit)
        ));
    }

    let entry = sqlx::query_as::<_, JournalEntry>(
        r#"INSERT INTO journal_entries
               (journal_id, institution_id, entry_date, reference, description, status, created_by_user_id)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Draft', $5)
           RETURNING journal_id, institution_id, entry_date, reference, description, status, posted_at, created_at"#,
    )
    .bind(claims.institution_id)
    .bind(req.entry_date)
    .bind(&req.reference)
    .bind(&req.description)
    .bind(claims.sub)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    for item in &req.items {
        sqlx::query("INSERT INTO journal_items (item_id, journal_id, account_id, debit_amount, credit_amount, narration) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)")
            .bind(entry.journal_id)
            .bind(item.account_id)
            .bind(item.debit_amount.unwrap_or(0.0))
            .bind(item.credit_amount.unwrap_or(0.0))
            .bind(&item.narration)
            .execute(db).await.map_err(AppError::Database)?;
    }

    Ok(entry)
}

pub async fn approve_journal_entry(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    journal_id: Uuid,
) -> Result<JournalEntry, AppError> {
    let entry = sqlx::query_as::<_, JournalEntry>(
        r#"UPDATE journal_entries
           SET status = 'Posted', approved_by_user_id = $1, posted_at = NOW(), updated_at = NOW()
           WHERE journal_id = $2 AND institution_id = $3 AND status = 'Draft'
           RETURNING journal_id, institution_id, entry_date, reference, description, status, posted_at, created_at"#,
    )
    .bind(claims.sub)
    .bind(journal_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Journal entry not found or already posted".into()))?;

    let items: Vec<(Uuid, f64, f64)> = sqlx::query_as(
        "SELECT account_id, CAST(debit_amount AS FLOAT8), CAST(credit_amount AS FLOAT8) FROM journal_items WHERE journal_id = $1"
    )
    .bind(journal_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    for (account_id, debit, credit) in items {
        sqlx::query(
            r#"
            UPDATE chart_of_accounts
            SET current_balance = current_balance + CASE
                WHEN account_type IN ('Asset', 'Expense') THEN ($1 - $2)
                ELSE ($2 - $1)
            END,
            updated_at = NOW()
            WHERE account_id = $3
            "#
        )
        .bind(debit)
        .bind(credit)
        .bind(account_id)
        .execute(db)
        .await
        .map_err(AppError::Database)?;
    }

    bus.publish(DomainEvent::JournalEntryPosted(JournalEntryPostedPayload {
        journal_id,
        institution_id: claims.institution_id,
        reference: entry.reference.clone().unwrap_or_default(),
        occurred_at: Utc::now(),
    }));

    Ok(entry)
}
