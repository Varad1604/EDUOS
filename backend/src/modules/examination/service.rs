use uuid::Uuid;
use chrono::Utc;
use sqlx::PgPool;
use base64::Engine as _;
use serde_json::json;
use crate::{
    error::AppError,
    events::{bus::EventBus, types::*},
    middleware::auth::Claims,
    modules::examination::models::*,
};
use super::super::student::service::log_event;

pub async fn create_exam(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: CreateExamRequest,
) -> Result<Exam, AppError> {
    let exam = sqlx::query_as::<_, Exam>(
        r#"
        INSERT INTO exams
            (exam_id, institution_id, exam_code, course_id, class_id, exam_type,
             scheduled_date, scheduled_time, duration_minutes, exam_mode,
             max_marks, min_marks, invigilator_faculty_id)
        VALUES
            (gen_random_uuid(), $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
        "#,
    )
    .bind(claims.institution_id)
    .bind(&req.exam_code)
    .bind(req.course_id)
    .bind(req.class_id)
    .bind(&req.exam_type)
    .bind(req.scheduled_date)
    .bind(req.scheduled_time)
    .bind(req.duration_minutes.unwrap_or(180))
    .bind(req.exam_mode.as_deref().unwrap_or("Written"))
    .bind(req.max_marks.unwrap_or(100))
    .bind(req.min_marks.unwrap_or(35))
    .bind(req.invigilator_faculty_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    log_event(db, claims.institution_id, claims.sub, "ExamCreated",
        exam.exam_id, "Examination", json!({ "exam_type": exam.exam_type })).await?;
    bus.publish(DomainEvent::ExamCreated(ExamCreatedPayload {
        exam_id: exam.exam_id,
        course_id: exam.course_id,
        class_id: exam.class_id,
        institution_id: claims.institution_id,
        exam_type: exam.exam_type.clone(),
        occurred_at: Utc::now(),
    }));

    Ok(exam)
}

pub async fn generate_hall_tickets(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    exam_id: Uuid,
) -> Result<Vec<HallTicket>, AppError> {
    // Get exam
    let exam: Exam = sqlx::query_as::<_, Exam>(
        "SELECT * FROM exams WHERE exam_id = $1 AND institution_id = $2 AND soft_deleted = false"
    )
    .bind(exam_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound(format!("Exam {} not found", exam_id)))?;

    // Get enrolled students
    let student_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT student_id FROM class_enrollments WHERE class_id = $1"
    )
    .bind(exam.class_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let mut tickets = Vec::new();
    for (idx, student_id) in student_ids.iter().enumerate() {
        let seat_no = format!("{:03}", idx + 1);
        let hall_no = format!("H{:02}", (idx / 30) + 1);
        let qr_payload = format!("{{\"exam_id\":\"{}\",\"student_id\":\"{}\",\"seat\":\"{}\"}}", exam_id, student_id, seat_no);
        let qr_b64 = base64::engine::general_purpose::STANDARD.encode(qr_payload.as_bytes());

        let ticket = sqlx::query_as::<_, HallTicket>(
            r#"
            INSERT INTO exam_hall_tickets
                (hall_ticket_id, institution_id, exam_id, student_id, hall_no, seat_no, qr_code)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
            ON CONFLICT (exam_id, student_id)
            DO UPDATE SET hall_no = $4, seat_no = $5, qr_code = $6
            RETURNING *
            "#,
        )
        .bind(claims.institution_id)
        .bind(exam_id)
        .bind(student_id)
        .bind(&hall_no)
        .bind(&seat_no)
        .bind(&qr_b64)
        .fetch_one(db)
        .await
        .map_err(AppError::Database)?;

        tickets.push(ticket);
    }

    // Mark hall tickets generated
    sqlx::query("UPDATE exams SET hall_tickets_generated = true WHERE exam_id = $1")
        .bind(exam_id).execute(db).await.map_err(AppError::Database)?;

    let count = tickets.len() as i32;
    bus.publish(DomainEvent::HallTicketsGenerated(HallTicketsGeneratedPayload {
        exam_id, institution_id: claims.institution_id, count, occurred_at: Utc::now(),
    }));

    Ok(tickets)
}

pub async fn enter_marks(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    faculty_id: Uuid,
    req: EnterMarksRequest,
) -> Result<MarksRow, AppError> {
    // Validate against exam max_marks
    let max_marks: i32 = sqlx::query_scalar(
        "SELECT max_marks FROM exams WHERE exam_id = $1 AND institution_id = $2"
    )
    .bind(req.exam_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Exam not found".into()))?;

    if req.obtained_marks < 0.0 || req.obtained_marks > max_marks as f64 {
        return Err(AppError::UnprocessableEntity(
            format!("Marks must be between 0 and {} (max)", max_marks)
        ));
    }

    let marks = sqlx::query_as::<_, MarksRow>(
        r#"
        INSERT INTO marks
            (marks_id, institution_id, exam_id, student_id, course_id,
             obtained_marks, entered_by_faculty_id, entered_at)
        VALUES
            (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (exam_id, student_id, course_id)
        DO UPDATE SET obtained_marks = $5, entered_by_faculty_id = $6,
                      entered_at = NOW(), updated_at = NOW()
        RETURNING marks_id, institution_id, exam_id, student_id, course_id,
                  CAST(obtained_marks AS TEXT) AS obtained_marks,
                  is_grace_marks,
                  CAST(grace_marks_applied AS TEXT) AS grace_marks_applied,
                  revaluation_status,
                  CAST(revaluation_marks AS TEXT) AS revaluation_marks,
                  entered_by_faculty_id, entered_at, soft_deleted
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.exam_id)
    .bind(req.student_id)
    .bind(req.course_id)
    .bind(req.obtained_marks)
    .bind(faculty_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    log_event(db, claims.institution_id, claims.sub, "MarksEntered",
        marks.marks_id, "Examination",
        json!({ "exam_id": req.exam_id, "obtained_marks": req.obtained_marks })).await?;

    bus.publish(DomainEvent::MarksEntered(MarksEnteredPayload {
        marks_id: marks.marks_id,
        exam_id: req.exam_id,
        student_id: req.student_id,
        course_id: req.course_id,
        obtained_marks: req.obtained_marks,
        occurred_at: Utc::now(),
    }));

    Ok(marks)
}

pub async fn process_result(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: ProcessResultRequest,
) -> Result<ResultRow, AppError> {
    // Get all marks for this student in this semester
    let marks_data: Vec<(f64, f64, f64)> = sqlx::query_as(
        r#"
        SELECT
            CAST(m.obtained_marks AS float8) as obtained,
            CAST(e.max_marks AS float8) as max_m,
            CAST(c.credits AS float8) as credits
        FROM marks m
        JOIN exams e ON e.exam_id = m.exam_id
        JOIN courses c ON c.course_id = m.course_id
        WHERE m.student_id = $1
          AND m.institution_id = $2
          AND m.soft_deleted = false
          AND c.semester = $3
        "#,
    )
    .bind(req.student_id)
    .bind(claims.institution_id)
    .bind(req.semester)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let sgpa = compute_sgpa(&marks_data);

    // Get previous CGPA
    let prev_cgpa: Option<f64> = sqlx::query_scalar(
        "SELECT CAST(cgpa AS float8) FROM student_profiles WHERE student_id = $1"
    )
    .bind(req.student_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .flatten();

    // Simple CGPA: average of all SGPAs including this one
    let past_results_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM results WHERE student_id = $1 AND soft_deleted = false"
    )
    .bind(req.student_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    let cgpa = match prev_cgpa {
        Some(prev) if past_results_count > 0 => {
            ((prev * past_results_count as f64) + sgpa) / (past_results_count as f64 + 1.0)
        }
        _ => sgpa,
    };
    let cgpa = (cgpa * 100.0).round() / 100.0;

    // Determine backlogs (marks below min_marks)
    let backlogs: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM marks m
        JOIN exams e ON e.exam_id = m.exam_id
        JOIN courses c ON c.course_id = m.course_id
        WHERE m.student_id = $1 AND m.institution_id = $2
          AND c.semester = $3 AND m.soft_deleted = false
          AND CAST(m.obtained_marks AS int) < c.min_marks
        "#,
    )
    .bind(req.student_id)
    .bind(claims.institution_id)
    .bind(req.semester)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    let status = if sgpa == 0.0 { "Fail" } else if backlogs > 0 { "BacklogEligible" } else { "Pass" };

    let result = sqlx::query_as::<_, ResultRow>(
        r#"
        INSERT INTO results
            (result_id, institution_id, student_id, semester, academic_year,
             sgpa, cgpa, status, backlogs_count)
        VALUES
            (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (student_id, semester, academic_year)
        DO UPDATE SET sgpa = $5, cgpa = $6, status = $7, backlogs_count = $8, updated_at = NOW()
        RETURNING result_id, institution_id, student_id, semester, academic_year,
                  CAST(sgpa AS TEXT) AS sgpa, CAST(cgpa AS TEXT) AS cgpa,
                  CAST(grade_points AS TEXT) AS grade_points,
                  CAST(total_credits_earned AS TEXT) AS total_credits_earned,
                  CAST(total_credits_attempted AS TEXT) AS total_credits_attempted,
                  status, backlogs_count, published_date, created_at, soft_deleted
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.student_id)
    .bind(req.semester)
    .bind(req.academic_year)
    .bind(sgpa)
    .bind(cgpa)
    .bind(status)
    .bind(backlogs as i32)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    // Update student CGPA denormalized field
    sqlx::query("UPDATE student_profiles SET cgpa = $1, updated_at = NOW() WHERE student_id = $2")
        .bind(cgpa).bind(req.student_id).execute(db).await.map_err(AppError::Database)?;

    log_event(db, claims.institution_id, claims.sub, "ResultProcessed",
        result.result_id, "Examination",
        json!({ "sgpa": sgpa, "cgpa": cgpa, "status": status })).await?;

    bus.publish(DomainEvent::ResultProcessed(ResultProcessedPayload {
        result_id: result.result_id,
        student_id: req.student_id,
        institution_id: claims.institution_id,
        semester: req.semester,
        academic_year: req.academic_year,
        sgpa,
        cgpa,
        status: status.into(),
        occurred_at: Utc::now(),
    }));

    Ok(result)
}

pub async fn publish_result(
    db: &PgPool,
    claims: &Claims,
    result_id: Uuid,
) -> Result<ResultRow, AppError> {
    let result = sqlx::query_as::<_, ResultRow>(
        r#"UPDATE results SET published_date = NOW(), approved_by_registrar_id = $1, updated_at = NOW()
           WHERE result_id = $2 AND institution_id = $3
           RETURNING result_id, institution_id, student_id, semester, academic_year,
                     CAST(sgpa AS TEXT) AS sgpa, CAST(cgpa AS TEXT) AS cgpa,
                     CAST(grade_points AS TEXT) AS grade_points,
                     CAST(total_credits_earned AS TEXT) AS total_credits_earned,
                     CAST(total_credits_attempted AS TEXT) AS total_credits_attempted,
                     status, backlogs_count, published_date, created_at, soft_deleted"#,
    )
    .bind(claims.sub)
    .bind(result_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound(format!("Result {} not found", result_id)))?;

    Ok(result)
}

pub async fn get_student_results(
    db: &PgPool,
    claims: &Claims,
    student_id: Uuid,
    semester: Option<i32>,
) -> Result<Vec<ResultRow>, AppError> {
    sqlx::query_as::<_, ResultRow>(
        r#"SELECT result_id, institution_id, student_id, semester, academic_year,
                  CAST(sgpa AS TEXT) AS sgpa, CAST(cgpa AS TEXT) AS cgpa,
                  CAST(grade_points AS TEXT) AS grade_points,
                  CAST(total_credits_earned AS TEXT) AS total_credits_earned,
                  CAST(total_credits_attempted AS TEXT) AS total_credits_attempted,
                  status, backlogs_count, published_date, created_at, soft_deleted
           FROM results
           WHERE student_id = $1 AND institution_id = $2
             AND soft_deleted = false
             AND ($3::int IS NULL OR semester = $3)
           ORDER BY semester, academic_year"#,
    )
    .bind(student_id)
    .bind(claims.institution_id)
    .bind(semester)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)
}

pub async fn generate_transcript(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: GenerateTranscriptRequest,
) -> Result<Transcript, AppError> {
    let transcript = sqlx::query_as::<_, Transcript>(
        r#"
        INSERT INTO transcripts
            (transcript_id, institution_id, student_id, generated_by_user_id, transcript_type)
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.student_id)
    .bind(claims.sub)
    .bind(&req.transcript_type)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    bus.publish(DomainEvent::TranscriptGenerated(TranscriptGeneratedPayload {
        transcript_id: transcript.transcript_id,
        student_id: req.student_id,
        institution_id: claims.institution_id,
        transcript_type: req.transcript_type,
        occurred_at: Utc::now(),
    }));

    Ok(transcript)
}

pub async fn request_revaluation(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: RevaluationRequest,
) -> Result<Uuid, AppError> {
    // Verify marks belong to institution
    let marks: MarksRow = sqlx::query_as::<_, MarksRow>(
        r#"SELECT marks_id, institution_id, exam_id, student_id, course_id,
                  CAST(obtained_marks AS TEXT) AS obtained_marks,
                  is_grace_marks,
                  CAST(grace_marks_applied AS TEXT) AS grace_marks_applied,
                  revaluation_status,
                  CAST(revaluation_marks AS TEXT) AS revaluation_marks,
                  entered_by_faculty_id, entered_at, soft_deleted
           FROM marks WHERE marks_id = $1 AND institution_id = $2 AND soft_deleted = false"#
    )
    .bind(req.marks_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound("Marks record not found".into()))?;

    let rev_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO revaluation_requests
            (revaluation_id, institution_id, marks_id, student_id, reason, old_marks)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::numeric)
        RETURNING revaluation_id
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.marks_id)
    .bind(marks.student_id)
    .bind(req.reason.as_deref())
    .bind(&marks.obtained_marks)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    sqlx::query("UPDATE marks SET revaluation_status = 'Requested' WHERE marks_id = $1")
        .bind(req.marks_id).execute(db).await.map_err(AppError::Database)?;

    bus.publish(DomainEvent::RevaluationRequested(RevaluationRequestedPayload {
        revaluation_id: rev_id,
        student_id: marks.student_id,
        marks_id: req.marks_id,
        occurred_at: Utc::now(),
    }));

    Ok(rev_id)
}

pub async fn list_revaluations(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<RevaluationRequestRow>, AppError> {
    let list = sqlx::query_as::<_, RevaluationRequestRow>(
        r#"
        SELECT
            r.revaluation_id,
            r.institution_id,
            r.marks_id,
            r.student_id,
            r.request_date,
            r.reason,
            r.status,
            CAST(r.old_marks AS TEXT) AS old_marks,
            CAST(r.new_marks AS TEXT) AS new_marks,
            r.completed_at,
            r.created_at,
            CONCAT(p.first_name, ' ', p.last_name) AS student_name,
            c.course_code,
            c.course_name
        FROM revaluation_requests r
        JOIN student_profiles sp ON r.student_id = sp.student_id
        JOIN persons p ON sp.person_id = p.person_id
        JOIN marks m ON r.marks_id = m.marks_id
        JOIN courses c ON m.course_id = c.course_id
        WHERE r.institution_id = $1
        ORDER BY r.created_at DESC
        "#,
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(list)
}

pub async fn approve_revaluation(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    revaluation_id: Uuid,
    req: ApproveRevaluationRequest,
) -> Result<(), AppError> {
    // 1. Fetch revaluation request
    let request: Option<(Uuid, Uuid, f64, i32)> = sqlx::query_as(
        r#"
        SELECT r.marks_id, r.student_id, CAST(r.old_marks AS FLOAT8), c.semester
        FROM revaluation_requests r
        JOIN marks m ON r.marks_id = m.marks_id
        JOIN courses c ON m.course_id = c.course_id
        WHERE r.revaluation_id = $1 AND r.institution_id = $2 AND r.status = 'Pending'
        "#
    )
    .bind(revaluation_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    let (marks_id, student_id, old_marks, semester) = request.ok_or_else(|| AppError::NotFound("Pending revaluation request not found".into()))?;

    let is_approved = req.status == "Approved";

    if is_approved {
        let new_marks = req.new_marks.ok_or_else(|| AppError::BadRequest("new_marks required for approval".into()))?;

        // Update revaluation request
        sqlx::query(
            "UPDATE revaluation_requests SET status = 'Completed', new_marks = $1, approved_by = $2, completed_at = NOW() WHERE revaluation_id = $3"
        )
        .bind(new_marks)
        .bind(claims.sub)
        .bind(revaluation_id)
        .execute(db)
        .await
        .map_err(AppError::Database)?;

        // Update marks entry
        sqlx::query(
            "UPDATE marks SET obtained_marks = $1, revaluation_status = 'Approved', revaluation_marks = $1, updated_at = NOW() WHERE marks_id = $2"
        )
        .bind(new_marks)
        .bind(marks_id)
        .execute(db)
        .await
        .map_err(AppError::Database)?;

        // Log audit event
        log_event(db, claims.institution_id, claims.sub, "RevaluationApproved", revaluation_id, "Examination", json!({
            "student_id": student_id,
            "marks_id": marks_id,
            "old_marks": old_marks,
            "new_marks": new_marks,
        })).await?;

        // Saga: Recalculate results if already compiled for this semester
        let result_info: Option<(Uuid, i32)> = sqlx::query_as(
            "SELECT result_id, academic_year FROM results WHERE student_id = $1 AND semester = $2 AND soft_deleted = false"
        )
        .bind(student_id)
        .bind(semester)
        .fetch_optional(db)
        .await
        .map_err(AppError::Database)?;

        if let Some((_res_id, academic_year)) = result_info {
            process_result(db, bus, claims, ProcessResultRequest {
                student_id,
                semester,
                academic_year,
            }).await?;
        }

    } else {
        // Rejected
        sqlx::query(
            "UPDATE revaluation_requests SET status = 'Rejected', approved_by = $1, completed_at = NOW() WHERE revaluation_id = $2"
        )
        .bind(claims.sub)
        .bind(revaluation_id)
        .execute(db)
        .await
        .map_err(AppError::Database)?;

        // Update marks entry status
        sqlx::query(
            "UPDATE marks SET revaluation_status = 'Denied', updated_at = NOW() WHERE marks_id = $2"
        )
        .bind(marks_id)
        .execute(db)
        .await
        .map_err(AppError::Database)?;

        // Log audit event
        log_event(db, claims.institution_id, claims.sub, "RevaluationRejected", revaluation_id, "Examination", json!({
            "student_id": student_id,
            "marks_id": marks_id,
        })).await?;
    }

    Ok(())
}


pub async fn list_exams(db: &PgPool, claims: &Claims) -> Result<Vec<serde_json::Value>, AppError> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT
            e.exam_id,
            e.exam_code,
            e.exam_type,
            e.scheduled_date,
            e.scheduled_time,
            e.duration_minutes,
            e.exam_mode,
            e.max_marks,
            e.min_marks,
            e.invigilator_faculty_id,
            e.hall_tickets_generated,
            c.course_code,
            c.course_name,
            cl.semester,
            cl.section
        FROM exams e
        JOIN courses c ON e.course_id = c.course_id
        JOIN classes cl ON e.class_id = cl.class_id
        WHERE e.institution_id = $1 AND e.soft_deleted = false
        ORDER BY e.scheduled_date DESC
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let mut exams = Vec::new();
    for r in rows {
        let date: chrono::NaiveDate = r.get("scheduled_date");
        let time: chrono::NaiveTime = r.get("scheduled_time");
        exams.push(serde_json::json!({
            "exam_id": r.get::<Uuid, _>("exam_id"),
            "exam_code": r.get::<Option<String>, _>("exam_code"),
            "exam_type": r.get::<String, _>("exam_type"),
            "scheduled_date": date.to_string(),
            "scheduled_time": time.to_string(),
            "duration_minutes": r.get::<i32, _>("duration_minutes"),
            "exam_mode": r.get::<String, _>("exam_mode"),
            "max_marks": r.get::<i32, _>("max_marks"),
            "min_marks": r.get::<i32, _>("min_marks"),
            "hall_tickets_generated": r.get::<bool, _>("hall_tickets_generated"),
            "course_code": r.get::<String, _>("course_code"),
            "course_name": r.get::<String, _>("course_name"),
            "semester": r.get::<i32, _>("semester"),
            "section": r.get::<String, _>("section"),
        }));
    }
    Ok(exams)
}

pub async fn get_student_marks(
    db: &PgPool,
    claims: &Claims,
    student_id: Uuid,
) -> Result<Vec<serde_json::Value>, AppError> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT
            m.marks_id,
            m.obtained_marks,
            m.is_grace_marks,
            m.grace_marks_applied,
            m.revaluation_status,
            m.revaluation_marks,
            e.exam_code,
            e.exam_type,
            e.max_marks,
            c.course_code,
            c.course_name,
            c.semester,
            CAST(c.credits AS TEXT) AS credits
        FROM marks m
        JOIN exams e ON m.exam_id = e.exam_id
        JOIN courses c ON m.course_id = c.course_id
        WHERE m.student_id = $1 AND m.institution_id = $2 AND m.soft_deleted = false
        ORDER BY c.semester, c.course_code
        "#
    )
    .bind(student_id)
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let mut list = Vec::new();
    for r in rows {
        let obtained: sqlx::types::BigDecimal = r.get("obtained_marks");
        let grace: Option<sqlx::types::BigDecimal> = r.get("grace_marks_applied");
        let rev: Option<sqlx::types::BigDecimal> = r.get("revaluation_marks");
        list.push(serde_json::json!({
            "marks_id": r.get::<Uuid, _>("marks_id"),
            "obtained_marks": obtained.to_string(),
            "is_grace_marks": r.get::<bool, _>("is_grace_marks"),
            "grace_marks_applied": grace.map(|g| g.to_string()),
            "revaluation_status": r.get::<String, _>("revaluation_status"),
            "revaluation_marks": rev.map(|rv| rv.to_string()),
            "exam_code": r.get::<Option<String>, _>("exam_code"),
            "exam_type": r.get::<String, _>("exam_type"),
            "max_marks": r.get::<i32, _>("max_marks"),
            "course_code": r.get::<String, _>("course_code"),
            "course_name": r.get::<String, _>("course_name"),
            "semester": r.get::<i32, _>("semester"),
            "credits": r.get::<String, _>("credits"),
        }));
    }
    Ok(list)
}

