use uuid::Uuid;
use chrono::Utc;
use sqlx::PgPool;
use serde_json::json;
use chrono::Datelike;
use crate::{
    audit::log_event,
    error::AppError,
    events::{bus::EventBus, types::*},
    middleware::auth::Claims,
    modules::student::models::*,
};

pub async fn create_student(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: CreateStudentRequest,
) -> Result<StudentProfile, AppError> {
    let person_id  = Uuid::new_v4();
    let student_id = Uuid::new_v4();

    // 1. Create Person
    sqlx::query(
        r#"
        INSERT INTO persons
            (person_id, institution_id, first_name, last_name, date_of_birth,
             gender, aadhar, phone, email, address)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        "#,
    )
    .bind(person_id)
    .bind(claims.institution_id)
    .bind(&req.first_name)
    .bind(&req.last_name)
    .bind(req.date_of_birth)
    .bind(&req.gender)
    .bind(&req.aadhar)
    .bind(&req.phone)
    .bind(&req.email)
    .bind(&req.address)
    .execute(db)
    .await
    .map_err(AppError::Database)?;

    // 2. Create StudentProfile
    let status = req.enrollment_status.as_deref().unwrap_or("Applicant");
    let student = sqlx::query_as::<_, StudentProfile>(
        r#"
        INSERT INTO student_profiles
            (student_id, person_id, institution_id, enrollment_number,
             enrollment_status, enrollment_date, branch_id, current_semester,
             current_academic_year, category, quota, guardian_name,
             guardian_phone, guardian_relation)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING student_id, person_id, institution_id, enrollment_number,
                  enrollment_status, enrollment_date, branch_id, current_semester,
                  current_academic_year, CAST(cgpa AS TEXT) AS cgpa, category, quota,
                  guardian_name, guardian_phone, guardian_relation, created_at,
                  updated_at, soft_deleted
        "#,
    )
    .bind(student_id)
    .bind(person_id)
    .bind(claims.institution_id)
    .bind(&req.enrollment_number)
    .bind(status)
    .bind(req.enrollment_date)
    .bind(req.branch_id)
    .bind(req.current_semester)
    .bind(req.current_academic_year)
    .bind(&req.category)
    .bind(&req.quota)
    .bind(&req.guardian_name)
    .bind(&req.guardian_phone)
    .bind(&req.guardian_relation)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    // 3. Optionally create academic record
    if let (Some(program_id), Some(enrollment_year)) = (req.program_id, req.enrollment_year) {
        sqlx::query(
            r#"
            INSERT INTO student_academic_records
                (student_id, program_id, enrollment_year, current_semester)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(student_id)
        .bind(program_id)
        .bind(enrollment_year)
        .bind(req.current_semester.unwrap_or(1))
        .execute(db)
        .await
        .map_err(AppError::Database)?;
    }

    // 4. Log event + publish to bus
    let payload = json!({
        "student_id": student_id,
        "person_id": person_id,
        "enrollment_status": status,
    });
    log_event(db, claims.institution_id, claims.sub, "StudentCreated", student_id, "Student", payload).await?;
    bus.publish(DomainEvent::StudentCreated(StudentCreatedPayload {
        student_id,
        institution_id: claims.institution_id,
        person_id,
        enrollment_status: status.to_string(),
        occurred_at: Utc::now(),
    }));

    Ok(student)
}


pub async fn get_student(
    db: &PgPool,
    claims: &Claims,
    student_id: Uuid,
) -> Result<(StudentProfile, Person), AppError> {
    let student = sqlx::query_as::<_, StudentProfile>(
        "SELECT student_id, person_id, institution_id, enrollment_number, enrollment_status, enrollment_date, branch_id, current_semester, current_academic_year, CAST(cgpa AS TEXT) AS cgpa, category, quota, guardian_name, guardian_phone, guardian_relation, created_at, updated_at, soft_deleted FROM student_profiles WHERE student_id = $1 AND institution_id = $2 AND soft_deleted = false"
    )
    .bind(student_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound(format!("Student {} not found", student_id)))?;

    let person = sqlx::query_as::<_, Person>(
        "SELECT * FROM persons WHERE person_id = $1 AND soft_deleted = false"
    )
    .bind(student.person_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok((student, person))
}

pub async fn list_students(
    db: &PgPool,
    claims: &Claims,
    query: &StudentListQuery,
) -> Result<(Vec<(StudentProfile, Person)>, i64), AppError> {
    let page  = query.page.unwrap_or(1).max(1) as i64;
    let limit = query.limit.unwrap_or(20).min(100) as i64;
    let offset = (page - 1) * limit;

    let semester_filter: Option<i32> = query.semester;
    let search_pattern = query.search.as_deref().map(|s| format!("%{}%", s));

    let filter_branch = if claims.branch_id.is_some() { claims.branch_id } else { query.branch_id };

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM student_profiles sp
        JOIN persons p ON sp.person_id = p.person_id
        WHERE sp.institution_id = $1
          AND sp.soft_deleted = false
          AND ($2::text IS NULL OR sp.enrollment_status = $2)
          AND ($3::int IS NULL OR sp.current_semester = $3)
          AND ($4::uuid IS NULL OR sp.branch_id = $4)
          AND ($5::int IS NULL OR sp.current_academic_year = $5)
          AND ($6::text IS NULL OR p.first_name ILIKE $6 OR p.last_name ILIKE $6 OR sp.enrollment_number ILIKE $6)
        "#,
    )
    .bind(claims.institution_id)
    .bind(query.status.as_deref())
    .bind(semester_filter)
    .bind(filter_branch)
    .bind(query.academic_year)
    .bind(search_pattern.as_deref())
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    let students = sqlx::query_as::<_, StudentProfile>(
        r#"
        SELECT sp.student_id, sp.person_id, sp.institution_id, sp.enrollment_number,
               sp.enrollment_status, sp.enrollment_date, sp.branch_id, sp.current_semester,
               sp.current_academic_year, CAST(sp.cgpa AS TEXT) AS cgpa, sp.category, sp.quota,
               sp.guardian_name, sp.guardian_phone, sp.guardian_relation, sp.created_at,
               sp.updated_at, sp.soft_deleted
        FROM student_profiles sp
        JOIN persons p ON sp.person_id = p.person_id
        WHERE sp.institution_id = $1
          AND sp.soft_deleted = false
          AND ($2::text IS NULL OR sp.enrollment_status = $2)
          AND ($3::int IS NULL OR sp.current_semester = $3)
          AND ($4::uuid IS NULL OR sp.branch_id = $4)
          AND ($5::int IS NULL OR sp.current_academic_year = $5)
          AND ($6::text IS NULL OR p.first_name ILIKE $6 OR p.last_name ILIKE $6 OR sp.enrollment_number ILIKE $6)
        ORDER BY sp.created_at DESC
        LIMIT $7 OFFSET $8
        "#,
    )
    .bind(claims.institution_id)
    .bind(query.status.as_deref())
    .bind(semester_filter)
    .bind(filter_branch)
    .bind(query.academic_year)
    .bind(search_pattern.as_deref())
    .bind(limit)
    .bind(offset)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let person_ids: Vec<Uuid> = students.iter().map(|s| s.person_id).collect();
    let persons = sqlx::query_as::<_, Person>(
        "SELECT * FROM persons WHERE person_id = ANY($1)"
    )
    .bind(&person_ids[..])
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let pairs = students.into_iter().map(|s| {
        let p = persons.iter().find(|p| p.person_id == s.person_id).cloned()
            .unwrap_or_else(|| Person {
                person_id: s.person_id,
                institution_id: s.institution_id,
                first_name: "Unknown".into(),
                last_name: None, date_of_birth: None, gender: None,
                aadhar: None, phone: None, email: None, address: None,
                created_at: Utc::now(), soft_deleted: false,
            });
        (s, p)
    }).collect();

    Ok((pairs, total))
}

pub async fn update_student(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    student_id: Uuid,
    req: UpdateStudentRequest,
) -> Result<StudentProfile, AppError> {
    // Verify exists
    let existing = sqlx::query_as::<_, StudentProfile>(
        "SELECT student_id, person_id, institution_id, enrollment_number, enrollment_status, enrollment_date, branch_id, current_semester, current_academic_year, CAST(cgpa AS TEXT) AS cgpa, category, quota, guardian_name, guardian_phone, guardian_relation, created_at, updated_at, soft_deleted FROM student_profiles WHERE student_id = $1 AND institution_id = $2 AND soft_deleted = false"
    )
    .bind(student_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound(format!("Student {} not found", student_id)))?;

    // Update person fields
    sqlx::query(
        r#"
        UPDATE persons SET
            first_name   = COALESCE($1, first_name),
            last_name    = COALESCE($2, last_name),
            phone        = COALESCE($3, phone),
            email        = COALESCE($4, email),
            address      = COALESCE($5, address),
            updated_at   = NOW()
        WHERE person_id = $6
        "#,
    )
    .bind(&req.first_name)
    .bind(&req.last_name)
    .bind(&req.phone)
    .bind(&req.email)
    .bind(&req.address)
    .bind(existing.person_id)
    .execute(db)
    .await
    .map_err(AppError::Database)?;

    // Update student fields
    let updated = sqlx::query_as::<_, StudentProfile>(
        r#"
        UPDATE student_profiles SET
            branch_id        = COALESCE($1, branch_id),
            current_semester = COALESCE($2, current_semester),
            category         = COALESCE($3, category),
            quota            = COALESCE($4, quota),
            guardian_name    = COALESCE($5, guardian_name),
            guardian_phone   = COALESCE($6, guardian_phone),
            updated_at       = NOW()
        WHERE student_id = $7
        RETURNING student_id, person_id, institution_id, enrollment_number,
                  enrollment_status, enrollment_date, branch_id, current_semester,
                  current_academic_year, CAST(cgpa AS TEXT) AS cgpa, category, quota,
                  guardian_name, guardian_phone, guardian_relation, created_at,
                  updated_at, soft_deleted
        "#,
    )
    .bind(req.branch_id)
    .bind(req.current_semester)
    .bind(&req.category)
    .bind(&req.quota)
    .bind(&req.guardian_name)
    .bind(&req.guardian_phone)
    .bind(student_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    // Audit + publish
    log_event(db, claims.institution_id, claims.sub, "StudentProfileUpdated", student_id, "Student",
        json!({ "student_id": student_id })).await?;
    bus.publish(DomainEvent::StudentProfileUpdated(StudentProfileUpdatedPayload {
        student_id,
        institution_id: claims.institution_id,
        changed_fields: json!({}),
        occurred_at: Utc::now(),
    }));

    Ok(updated)
}

pub async fn change_status(
    db: &PgPool,
    _bus: &EventBus,
    claims: &Claims,
    student_id: Uuid,
    req: ChangeStatusRequest,
) -> Result<StudentProfile, AppError> {
    if !is_valid_status(&req.new_status) {
        return Err(AppError::BadRequest(format!("Invalid status: {}", req.new_status)));
    }

    let current: String = sqlx::query_scalar(
        "SELECT enrollment_status FROM student_profiles WHERE student_id = $1 AND institution_id = $2 AND soft_deleted = false"
    )
    .bind(student_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound(format!("Student {} not found", student_id)))?;

    if !is_valid_transition(&current, &req.new_status) {
        return Err(AppError::UnprocessableEntity(
            format!("Cannot transition from '{}' to '{}'", current, req.new_status)
        ));
    }

    let updated = sqlx::query_as::<_, StudentProfile>(
        "UPDATE student_profiles SET enrollment_status = $1, updated_at = NOW() WHERE student_id = $2 RETURNING student_id, person_id, institution_id, enrollment_number, enrollment_status, enrollment_date, branch_id, current_semester, current_academic_year, CAST(cgpa AS TEXT) AS cgpa, category, quota, guardian_name, guardian_phone, guardian_relation, created_at, updated_at, soft_deleted"
    )
    .bind(&req.new_status)
    .bind(student_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    let event_type = match req.new_status.as_str() {
        "Detained" => "StudentDetained",
        "Alumni"   => "StudentAlumni",
        "Dropout"  => "StudentDropout",
        "Enrolled" => "StudentEnrolled",
        _          => "StudentStatusChanged",
    };

    log_event(db, claims.institution_id, claims.sub, event_type, student_id, "Student",
        json!({ "old_status": current, "new_status": req.new_status, "reason": req.reason })).await?;

    Ok(updated)
}

pub async fn soft_delete_student(
    db: &PgPool,
    claims: &Claims,
    student_id: Uuid,
) -> Result<(), AppError> {
    let rows = sqlx::query(
        "UPDATE student_profiles SET soft_deleted = true, deleted_at = NOW() WHERE student_id = $1 AND institution_id = $2 AND soft_deleted = false"
    )
    .bind(student_id)
    .bind(claims.institution_id)
    .execute(db)
    .await
    .map_err(AppError::Database)?;

    if rows.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Student {} not found", student_id)));
    }

    log_event(db, claims.institution_id, claims.sub, "StudentDeleted", student_id, "Student",
        json!({ "student_id": student_id })).await?;
    Ok(())
}

pub async fn list_documents(
    db: &PgPool,
    _claims: &Claims,
    student_id: Uuid,
) -> Result<Vec<StudentDocument>, AppError> {
    let docs = sqlx::query_as::<_, StudentDocument>(
        "SELECT * FROM student_documents WHERE student_id = $1 AND soft_deleted = false ORDER BY upload_date DESC"
    )
    .bind(student_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;
    Ok(docs)
}

pub async fn get_academic_records(
    db: &PgPool,
    student_id: Uuid,
) -> Result<Vec<StudentAcademicRecord>, AppError> {
    let records = sqlx::query_as::<_, StudentAcademicRecord>(
        "SELECT record_id, student_id, program_id, enrollment_year, current_semester, CAST(cgpa AS TEXT) AS cgpa, eligibility_status, created_at FROM student_academic_records WHERE student_id = $1 ORDER BY enrollment_year DESC"
    )
    .bind(student_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;
    Ok(records)
}

pub async fn get_student_by_user_id(
    db: &PgPool,
    user_id: Uuid,
    institution_id: Uuid,
) -> Result<(StudentProfile, Person), AppError> {
    let person_id: Uuid = sqlx::query_scalar(
        "SELECT person_id FROM users WHERE user_id = $1 AND institution_id = $2 AND is_active = true"
    )
    .bind(user_id)
    .bind(institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound(format!("User {} not found", user_id)))?;

    let student = sqlx::query_as::<_, StudentProfile>(
        "SELECT student_id, person_id, institution_id, enrollment_number, enrollment_status, enrollment_date, branch_id, current_semester, current_academic_year, CAST(cgpa AS TEXT) AS cgpa, category, quota, guardian_name, guardian_phone, guardian_relation, created_at, updated_at, soft_deleted FROM student_profiles WHERE person_id = $1 AND institution_id = $2 AND soft_deleted = false"
    )
    .bind(person_id)
    .bind(institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound(format!("Student profile for user {} not found", user_id)))?;

    let person = sqlx::query_as::<_, Person>(
        "SELECT * FROM persons WHERE person_id = $1 AND soft_deleted = false"
    )
    .bind(person_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok((student, person))
}

pub async fn upload_document(
    db: &PgPool,
    claims: &Claims,
    student_id: Uuid,
    document_type: &str,
    file_name: &str,
    file_data: &[u8],
) -> Result<StudentDocument, AppError> {
    // Basic file write (for MVP)
    let upload_dir = "uploads";
    std::fs::create_dir_all(upload_dir).map_err(|_| AppError::Internal(anyhow::anyhow!("Cannot create uploads dir")))?;
    
    let file_id = Uuid::new_v4();
    let safe_name = file_name.replace(" ", "_");
    let file_path = format!("{}/{}_{}", upload_dir, file_id, safe_name);
    
    std::fs::write(&file_path, file_data).map_err(|_| AppError::Internal(anyhow::anyhow!("Failed to save file")))?;
    
    let doc = sqlx::query_as::<_, StudentDocument>(
        r#"
        INSERT INTO student_documents (document_id, student_id, document_type, file_url, file_name, file_size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING document_id, student_id, document_type, file_url, file_name, upload_date, version_number, soft_deleted
        "#,
    )
    .bind(file_id)
    .bind(student_id)
    .bind(document_type)
    .bind(&file_path)
    .bind(file_name)
    .bind(file_data.len() as i64)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(doc)
}

pub async fn bulk_import_students(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    students: Vec<CreateStudentRequest>,
) -> Result<usize, AppError> {
    let mut imported = 0;
    // Transaction could be used here, but for simplicity we'll just loop and use create_student
    for req in students {
        if let Ok(_) = create_student(db, bus, claims, req).await {
            imported += 1;
        }
    }
    Ok(imported)
}

pub async fn generate_transfer_certificate(
    db: &PgPool,
    claims: &Claims,
    student_id: Uuid,
) -> Result<serde_json::Value, AppError> {
    let (sp, p) = get_student(db, claims, student_id).await?;
    
    // In a real system, this would generate a PDF. We return JSON metadata for frontend rendering.
    let tc_data = json!({
        "certificate_no": format!("TC-{}-{}", chrono::Utc::now().year(), rand::random::<u16>()),
        "issue_date": chrono::Utc::now().to_rfc3339(),
        "student_name": format!("{} {}", p.first_name, p.last_name.unwrap_or_default()).trim(),
        "enrollment_number": sp.enrollment_number.unwrap_or_default(),
        "guardian_name": sp.guardian_name.unwrap_or_default(),
        "leaving_reason": "Course Completion",
        "conduct": "Good"
    });
    
    // Log TC generation
    log_event(db, claims.institution_id, claims.sub, "TCGenerated", student_id, "Student", tc_data.clone()).await?;
    
    Ok(tc_data)
}
