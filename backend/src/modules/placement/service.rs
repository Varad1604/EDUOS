use sqlx::PgPool;
use uuid::Uuid;
use anyhow::Result;

use super::models::*;

/// ── Companies ─────────────────────────────────────────────────────────────────

pub async fn list_companies(db: &PgPool, institution_id: Uuid) -> Result<Vec<PlacementCompany>> {
    let rows = sqlx::query_as::<_, PlacementCompany>(
        r#"
        SELECT * FROM placement_companies
        WHERE institution_id = $1 AND soft_deleted = FALSE
        ORDER BY company_name ASC
        "#
    )
    .bind(institution_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn create_company(
    db: &PgPool,
    institution_id: Uuid,
    req: CreateCompanyRequest,
) -> Result<PlacementCompany> {
    let row = sqlx::query_as::<_, PlacementCompany>(
        r#"
        INSERT INTO placement_companies
            (institution_id, company_name, industry, website, contact_person,
             contact_email, contact_phone, description)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        "#
    )
    .bind(institution_id)
    .bind(&req.company_name)
    .bind(&req.industry)
    .bind(&req.website)
    .bind(&req.contact_person)
    .bind(&req.contact_email)
    .bind(&req.contact_phone)
    .bind(&req.description)
    .fetch_one(db)
    .await?;
    Ok(row)
}

pub async fn update_company_status(
    db: &PgPool,
    company_id: Uuid,
    status: &str,
) -> Result<PlacementCompany> {
    let row = sqlx::query_as::<_, PlacementCompany>(
        r#"
        UPDATE placement_companies SET status = $1, updated_at = NOW()
        WHERE company_id = $2 AND soft_deleted = FALSE
        RETURNING *
        "#
    )
    .bind(status)
    .bind(company_id)
    .fetch_one(db)
    .await?;
    Ok(row)
}

/// ── Drives ────────────────────────────────────────────────────────────────────

pub async fn list_drives(db: &PgPool, institution_id: Uuid) -> Result<Vec<PlacementDriveResponse>> {
    let rows = sqlx::query_as::<_, PlacementDriveResponse>(
        r#"
        SELECT
            d.drive_id,
            d.company_id,
            c.company_name,
            c.industry,
            d.drive_title,
            d.job_role,
            d.job_type,
            d.job_location,
            d.package_lpa::float8 AS package_lpa,
            d.stipend_pm::float8 AS stipend_pm,
            d.min_cgpa::float8 AS min_cgpa,
            d.backlogs_allowed,
            d.eligible_branches,
            d.bond_years,
            d.drive_date,
            d.application_deadline,
            d.status,
            COUNT(a.application_id) AS application_count
        FROM placement_drives d
        JOIN placement_companies c ON c.company_id = d.company_id
        LEFT JOIN placement_applications a ON a.drive_id = d.drive_id
        WHERE d.institution_id = $1 AND d.soft_deleted = FALSE
        GROUP BY d.drive_id, c.company_id
        ORDER BY d.drive_date DESC
        "#
    )
    .bind(institution_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn create_drive(
    db: &PgPool,
    institution_id: Uuid,
    req: CreateDriveRequest,
) -> Result<PlacementDrive> {
    let row = sqlx::query_as::<_, PlacementDrive>(
        r#"
        INSERT INTO placement_drives
            (institution_id, company_id, drive_title, job_role, job_type,
             job_location, package_lpa, stipend_pm, min_cgpa, backlogs_allowed,
             eligible_branches, description, bond_years, drive_date, application_deadline)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING
            drive_id,
            institution_id,
            company_id,
            drive_title,
            job_role,
            job_type,
            job_location,
            package_lpa::float8 AS package_lpa,
            stipend_pm::float8 AS stipend_pm,
            min_cgpa::float8 AS min_cgpa,
            backlogs_allowed,
            eligible_branches,
            description,
            bond_years,
            drive_date,
            application_deadline,
            status,
            created_at,
            updated_at
        "#
    )
    .bind(institution_id)
    .bind(req.company_id)
    .bind(&req.drive_title)
    .bind(&req.job_role)
    .bind(&req.job_type)
    .bind(&req.job_location)
    .bind(req.package_lpa)
    .bind(req.stipend_pm)
    .bind(req.min_cgpa)
    .bind(req.backlogs_allowed)
    .bind(&req.eligible_branches)
    .bind(&req.description)
    .bind(req.bond_years)
    .bind(req.drive_date)
    .bind(req.application_deadline)
    .fetch_one(db)
    .await?;
    Ok(row)
}

pub async fn close_drive(db: &PgPool, drive_id: Uuid) -> Result<PlacementDrive> {
    let row = sqlx::query_as::<_, PlacementDrive>(
        r#"
        UPDATE placement_drives SET status = 'Closed', updated_at = NOW()
        WHERE drive_id = $1
        RETURNING
            drive_id,
            institution_id,
            company_id,
            drive_title,
            job_role,
            job_type,
            job_location,
            package_lpa::float8 AS package_lpa,
            stipend_pm::float8 AS stipend_pm,
            min_cgpa::float8 AS min_cgpa,
            backlogs_allowed,
            eligible_branches,
            description,
            bond_years,
            drive_date,
            application_deadline,
            status,
            created_at,
            updated_at
        "#
    )
    .bind(drive_id)
    .fetch_one(db)
    .await?;
    Ok(row)
}

/// ── Applications ──────────────────────────────────────────────────────────────

pub async fn list_applications(
    db: &PgPool,
    institution_id: Uuid,
    drive_id: Option<Uuid>,
) -> Result<Vec<PlacementApplicationResponse>> {
    let rows = sqlx::query_as::<_, PlacementApplicationResponse>(
        r#"
        SELECT
            a.application_id,
            a.drive_id,
            d.drive_title,
            d.job_role,
            c.company_name,
            d.package_lpa::float8 AS package_lpa,
            a.student_id,
            p.first_name || ' ' || p.last_name AS student_name,
            s.enrollment_number AS roll_number,
            a.applied_at,
            a.status,
            a.rejection_reason
        FROM placement_applications a
        JOIN placement_drives d ON d.drive_id = a.drive_id
        JOIN placement_companies c ON c.company_id = d.company_id
        JOIN student_profiles s ON s.student_id = a.student_id
        JOIN persons p ON p.person_id = s.person_id
        WHERE a.institution_id = $1
          AND ($2::UUID IS NULL OR a.drive_id = $2)
        ORDER BY a.applied_at DESC
        "#
    )
    .bind(institution_id)
    .bind(drive_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn get_my_applications(
    db: &PgPool,
    student_id: Uuid,
) -> Result<Vec<PlacementApplicationResponse>> {
    let rows = sqlx::query_as::<_, PlacementApplicationResponse>(
        r#"
        SELECT
            a.application_id,
            a.drive_id,
            d.drive_title,
            d.job_role,
            c.company_name,
            d.package_lpa::float8 AS package_lpa,
            a.student_id,
            p.first_name || ' ' || p.last_name AS student_name,
            s.enrollment_number AS roll_number,
            a.applied_at,
            a.status,
            a.rejection_reason
        FROM placement_applications a
        JOIN placement_drives d ON d.drive_id = a.drive_id
        JOIN placement_companies c ON c.company_id = d.company_id
        JOIN student_profiles s ON s.student_id = a.student_id
        JOIN persons p ON p.person_id = s.person_id
        WHERE a.student_id = $1
        ORDER BY a.applied_at DESC
        "#
    )
    .bind(student_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn apply_to_drive(
    db: &PgPool,
    institution_id: Uuid,
    req: ApplyDriveRequest,
) -> Result<PlacementApplication> {
    // Check drive is still open
    let drive_status: Option<String> = sqlx::query_scalar(
        "SELECT status FROM placement_drives WHERE drive_id = $1 AND soft_deleted = FALSE"
    )
    .bind(req.drive_id)
    .fetch_optional(db)
    .await?;

    match drive_status.as_deref() {
        Some("Open") => {}
        Some(_) => return Err(anyhow::anyhow!("Drive is not accepting applications")),
        None => return Err(anyhow::anyhow!("Drive not found")),
    }

    let row = sqlx::query_as::<_, PlacementApplication>(
        r#"
        INSERT INTO placement_applications (drive_id, student_id, institution_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (drive_id, student_id) DO UPDATE SET updated_at = NOW()
        RETURNING *
        "#
    )
    .bind(req.drive_id)
    .bind(req.student_id)
    .bind(institution_id)
    .fetch_one(db)
    .await?;
    Ok(row)
}

pub async fn update_application_status(
    db: &PgPool,
    application_id: Uuid,
    req: UpdateApplicationStatusRequest,
) -> Result<PlacementApplication> {
    let row = sqlx::query_as::<_, PlacementApplication>(
        r#"
        UPDATE placement_applications
        SET status = $1, rejection_reason = $2, updated_at = NOW()
        WHERE application_id = $3
        RETURNING *
        "#
    )
    .bind(&req.status)
    .bind(&req.rejection_reason)
    .bind(application_id)
    .fetch_one(db)
    .await?;
    Ok(row)
}

/// ── Interview Rounds ──────────────────────────────────────────────────────────

pub async fn list_rounds(
    db: &PgPool,
    application_id: Uuid,
) -> Result<Vec<PlacementInterviewRound>> {
    let rows = sqlx::query_as::<_, PlacementInterviewRound>(
        r#"
        SELECT * FROM placement_interview_rounds
        WHERE application_id = $1
        ORDER BY round_number ASC
        "#
    )
    .bind(application_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn create_round(
    db: &PgPool,
    req: CreateInterviewRoundRequest,
) -> Result<PlacementInterviewRound> {
    let row = sqlx::query_as::<_, PlacementInterviewRound>(
        r#"
        INSERT INTO placement_interview_rounds
            (application_id, round_number, round_type, scheduled_at, venue, mode)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
        "#
    )
    .bind(req.application_id)
    .bind(req.round_number)
    .bind(&req.round_type)
    .bind(req.scheduled_at)
    .bind(&req.venue)
    .bind(&req.mode)
    .fetch_one(db)
    .await?;
    Ok(row)
}

pub async fn update_round_result(
    db: &PgPool,
    round_id: Uuid,
    req: UpdateInterviewResultRequest,
) -> Result<PlacementInterviewRound> {
    let row = sqlx::query_as::<_, PlacementInterviewRound>(
        r#"
        UPDATE placement_interview_rounds
        SET result = $1, feedback = $2, updated_at = NOW()
        WHERE round_id = $3
        RETURNING *
        "#
    )
    .bind(&req.result)
    .bind(&req.feedback)
    .bind(round_id)
    .fetch_one(db)
    .await?;
    Ok(row)
}

/// ── Offers ───────────────────────────────────────────────────────────────────

pub async fn list_offers(db: &PgPool, institution_id: Uuid) -> Result<Vec<PlacementOfferResponse>> {
    let rows = sqlx::query_as::<_, PlacementOfferResponse>(
        r#"
        SELECT
            o.offer_id,
            o.student_id,
            p.first_name || ' ' || p.last_name AS student_name,
            s.enrollment_number AS roll_number,
            c.company_name,
            d.job_role,
            d.drive_title,
            o.offer_date,
            o.joining_date,
            o.package_lpa::float8 AS package_lpa,
            o.stipend_pm::float8 AS stipend_pm,
            o.status
        FROM placement_offers o
        JOIN placement_drives d ON d.drive_id = o.drive_id
        JOIN placement_companies c ON c.company_id = d.company_id
        JOIN student_profiles s ON s.student_id = o.student_id
        JOIN persons p ON p.person_id = s.person_id
        WHERE o.institution_id = $1
        ORDER BY o.offer_date DESC
        "#
    )
    .bind(institution_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn create_offer(
    db: &PgPool,
    institution_id: Uuid,
    req: CreateOfferRequest,
) -> Result<PlacementOffer> {
    // Fetch student_id and drive_id from application
    let (student_id, drive_id): (Uuid, Uuid) = sqlx::query_as(
        "SELECT student_id, drive_id FROM placement_applications WHERE application_id = $1"
    )
    .bind(req.application_id)
    .fetch_one(db)
    .await?;

    let row = sqlx::query_as::<_, PlacementOffer>(
        r#"
        INSERT INTO placement_offers
            (application_id, student_id, drive_id, institution_id,
             joining_date, package_lpa, stipend_pm, offer_letter_ref)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (application_id) DO UPDATE
            SET joining_date = EXCLUDED.joining_date,
                package_lpa  = EXCLUDED.package_lpa,
                stipend_pm   = EXCLUDED.stipend_pm,
                updated_at   = NOW()
        RETURNING
            offer_id,
            application_id,
            student_id,
            drive_id,
            institution_id,
            offer_date,
            joining_date,
            package_lpa::float8 AS package_lpa,
            stipend_pm::float8 AS stipend_pm,
            offer_letter_ref,
            status,
            created_at,
            updated_at
        "#
    )
    .bind(req.application_id)
    .bind(student_id)
    .bind(drive_id)
    .bind(institution_id)
    .bind(req.joining_date)
    .bind(req.package_lpa)
    .bind(req.stipend_pm)
    .bind(&req.offer_letter_ref)
    .fetch_one(db)
    .await?;

    // Auto-update application status to Offered
    sqlx::query(
        "UPDATE placement_applications SET status = 'Offered', updated_at = NOW() WHERE application_id = $1"
    )
    .bind(req.application_id)
    .execute(db)
    .await?;

    Ok(row)
}

pub async fn update_offer_status(
    db: &PgPool,
    offer_id: Uuid,
    req: UpdateOfferStatusRequest,
) -> Result<PlacementOffer> {
    let row = sqlx::query_as::<_, PlacementOffer>(
        r#"
        UPDATE placement_offers SET status = $1, updated_at = NOW()
        WHERE offer_id = $2
        RETURNING
            offer_id,
            application_id,
            student_id,
            drive_id,
            institution_id,
            offer_date,
            joining_date,
            package_lpa::float8 AS package_lpa,
            stipend_pm::float8 AS stipend_pm,
            offer_letter_ref,
            status,
            created_at,
            updated_at
        "#
    )
    .bind(&req.status)
    .bind(offer_id)
    .fetch_one(db)
    .await?;

    // Sync status to application
    let app_status = match req.status.as_str() {
        "Accepted" => "Accepted",
        "Declined" => "Declined",
        _ => "Offered",
    };
    sqlx::query(
        "UPDATE placement_applications SET status = $1, updated_at = NOW() WHERE application_id = $2"
    )
    .bind(app_status)
    .bind(row.application_id)
    .execute(db)
    .await?;

    Ok(row)
}

/// ── Stats ─────────────────────────────────────────────────────────────────────

pub async fn get_placement_stats(db: &PgPool, institution_id: Uuid) -> Result<PlacementStats> {
    let total_companies: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM placement_companies WHERE institution_id = $1 AND soft_deleted = FALSE"
    ).bind(institution_id).fetch_one(db).await?;

    let total_drives: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM placement_drives WHERE institution_id = $1 AND soft_deleted = FALSE"
    ).bind(institution_id).fetch_one(db).await?;

    let open_drives: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM placement_drives WHERE institution_id = $1 AND status = 'Open' AND soft_deleted = FALSE"
    ).bind(institution_id).fetch_one(db).await?;

    let total_applications: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM placement_applications WHERE institution_id = $1"
    ).bind(institution_id).fetch_one(db).await?;

    let total_offers: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM placement_offers WHERE institution_id = $1"
    ).bind(institution_id).fetch_one(db).await?;

    let accepted_offers: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM placement_offers WHERE institution_id = $1 AND status = 'Accepted'"
    ).bind(institution_id).fetch_one(db).await?;

    let avg_package_lpa: Option<f64> = sqlx::query_scalar(
        "SELECT AVG(package_lpa)::FLOAT8 FROM placement_offers WHERE institution_id = $1 AND status = 'Accepted' AND package_lpa IS NOT NULL"
    ).bind(institution_id).fetch_one(db).await?;

    let highest_package_lpa: Option<f64> = sqlx::query_scalar(
        "SELECT MAX(package_lpa)::FLOAT8 FROM placement_offers WHERE institution_id = $1 AND package_lpa IS NOT NULL"
    ).bind(institution_id).fetch_one(db).await?;

    Ok(PlacementStats {
        total_companies,
        total_drives,
        open_drives,
        total_applications,
        total_offers,
        accepted_offers,
        avg_package_lpa,
        highest_package_lpa,
    })
}

pub async fn get_eligible_students(
    db: &PgPool,
    institution_id: Uuid,
    drive_id: Uuid,
) -> Result<Vec<EligibleStudent>> {
    let rows = sqlx::query_as::<_, EligibleStudent>(
        r#"
        SELECT
            sp.student_id,
            sp.enrollment_number AS roll_number,
            p.first_name || ' ' || COALESCE(p.last_name, '') AS student_name,
            p.email,
            p.phone,
            b.branch_name,
            b.branch_code,
            CAST(sp.cgpa AS TEXT) AS cgpa,
            COALESCE(
                (SELECT SUM(r.backlogs_count)
                 FROM results r
                 WHERE r.student_id = sp.student_id AND r.soft_deleted = false),
                0
            )::int8 AS backlogs_count,
            EXISTS (
                SELECT 1 FROM placement_applications pa
                WHERE pa.drive_id = d.drive_id AND pa.student_id = sp.student_id
            ) AS applied
        FROM student_profiles sp
        JOIN persons p ON p.person_id = sp.person_id
        LEFT JOIN branches b ON b.branch_id = sp.branch_id
        CROSS JOIN placement_drives d
        WHERE d.drive_id = $1
          AND sp.institution_id = $2
          AND sp.soft_deleted = false
          AND COALESCE(sp.cgpa, 0.0) >= d.min_cgpa
          AND COALESCE(
                (SELECT SUM(r.backlogs_count)
                 FROM results r
                 WHERE r.student_id = sp.student_id AND r.soft_deleted = false),
                0
              ) <= d.backlogs_allowed
          AND (
            coalesce(cardinality(d.eligible_branches), 0) = 0
            OR b.branch_code = ANY(d.eligible_branches)
          )
        ORDER BY student_name ASC
        "#
    )
    .bind(drive_id)
    .bind(institution_id)
    .fetch_all(db)
    .await?;

    Ok(rows)
}

