use uuid::Uuid;
use chrono::Utc;
use sqlx::PgPool;
use serde_json::json;
use crate::{
    error::AppError,
    events::{bus::EventBus, types::*},
    middleware::auth::Claims,
    modules::academics::models::*,
};

use crate::audit::log_event;

pub async fn create_course(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    req: CreateCourseRequest,
) -> Result<Course, AppError> {
    let course_type = req.course_type.clone();
    if !["Theory","Practical","Project","Seminar"].contains(&course_type.as_str()) {
        return Err(AppError::BadRequest(format!("Invalid course_type: {}", course_type)));
    }

    let course = sqlx::query_as::<_, Course>(
        r#"
        INSERT INTO courses
            (course_id, institution_id, curriculum_id, course_code, course_name,
             credits, course_type, semester, min_marks, max_marks, internal_max,
             external_max, course_outcomes, weekly_hours)
        VALUES
            (gen_random_uuid(), $1, $2, $3, $4,
             $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING
            course_id, institution_id, curriculum_id, course_code, course_name,
            credits::TEXT AS credits, course_type, semester, min_marks, max_marks,
            internal_max, external_max, course_outcomes, weekly_hours, created_at, soft_deleted
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.curriculum_id)
    .bind(&req.course_code)
    .bind(&req.course_name)
    .bind(req.credits)
    .bind(&req.course_type)
    .bind(req.semester)
    .bind(req.min_marks.unwrap_or(35))
    .bind(req.max_marks.unwrap_or(100))
    .bind(req.internal_max.unwrap_or(30))
    .bind(req.external_max.unwrap_or(70))
    .bind(req.course_outcomes)
    .bind(req.weekly_hours.unwrap_or(3))
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    log_event(db, claims.institution_id, claims.sub, "CourseCreated",
        course.course_id, "Academics", json!({ "course_code": course.course_code })).await?;
    bus.publish(DomainEvent::CourseCreated(CourseCreatedPayload {
        course_id: course.course_id,
        institution_id: claims.institution_id,
        course_code: course.course_code.clone(),
        occurred_at: Utc::now(),
    }));

    Ok(course)
}

pub async fn list_courses(db: &PgPool, claims: &Claims, curriculum_id: Option<Uuid>) -> Result<Vec<Course>, AppError> {
    let courses = sqlx::query_as::<_, Course>(
        r#"
        SELECT course_id, institution_id, curriculum_id, course_code, course_name,
               credits::TEXT AS credits, course_type, semester, min_marks, max_marks,
               internal_max, external_max, course_outcomes, weekly_hours, created_at, soft_deleted
        FROM courses
        WHERE institution_id = $1
          AND soft_deleted = false
          AND ($2::uuid IS NULL OR curriculum_id = $2)
        ORDER BY course_code
        "#,
    )
    .bind(claims.institution_id)
    .bind(curriculum_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;
    Ok(courses)
}

pub async fn get_course(db: &PgPool, claims: &Claims, course_id: Uuid) -> Result<Course, AppError> {
    sqlx::query_as::<_, Course>(
        r#"SELECT course_id, institution_id, curriculum_id, course_code, course_name,
               credits::TEXT AS credits, course_type, semester, min_marks, max_marks,
               internal_max, external_max, course_outcomes, weekly_hours, created_at, soft_deleted
        FROM courses WHERE course_id = $1 AND institution_id = $2 AND soft_deleted = false"#
    )
    .bind(course_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::NotFound(format!("Course {} not found", course_id)))
}

pub async fn update_course(
    db: &PgPool,
    claims: &Claims,
    course_id: Uuid,
    req: CreateCourseRequest,
) -> Result<Course, AppError> {
    let course_type = req.course_type.clone();
    if !["Theory","Practical","Project","Seminar"].contains(&course_type.as_str()) {
        return Err(AppError::BadRequest(format!("Invalid course_type: {}", course_type)));
    }

    let course = sqlx::query_as::<_, Course>(
        r#"
        UPDATE courses
        SET curriculum_id = $1, course_code = $2, course_name = $3,
            credits = $4, course_type = $5, semester = $6, min_marks = $7, max_marks = $8
        WHERE course_id = $9 AND institution_id = $10 AND soft_deleted = false
        RETURNING
            course_id, institution_id, curriculum_id, course_code, course_name,
            credits::TEXT AS credits, course_type, semester, min_marks, max_marks,
            internal_max, external_max, course_outcomes, weekly_hours, created_at, soft_deleted
        "#,
    )
    .bind(req.curriculum_id)
    .bind(&req.course_code)
    .bind(&req.course_name)
    .bind(req.credits)
    .bind(&req.course_type)
    .bind(req.semester)
    .bind(req.min_marks.unwrap_or(35))
    .bind(req.max_marks.unwrap_or(100))
    .bind(course_id)
    .bind(claims.institution_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(course)
}

pub async fn delete_course(
    db: &PgPool,
    claims: &Claims,
    course_id: Uuid,
) -> Result<(), AppError> {
    let result = sqlx::query(
        "UPDATE courses SET soft_deleted = true WHERE course_id = $1 AND institution_id = $2 AND soft_deleted = false"
    )
    .bind(course_id)
    .bind(claims.institution_id)
    .execute(db)
    .await
    .map_err(AppError::Database)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Course {} not found or already deleted", course_id)));
    }

    Ok(())
}

pub async fn create_class(db: &PgPool, claims: &Claims, req: CreateClassRequest) -> Result<Class, AppError> {
    sqlx::query_as::<_, Class>(
        r#"
        INSERT INTO classes (class_id, institution_id, branch_id, semester, section, academic_year)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.branch_id)
    .bind(req.semester)
    .bind(req.section.unwrap_or_else(|| "A".into()))
    .bind(req.academic_year)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)
}

pub async fn list_classes(db: &PgPool, claims: &Claims) -> Result<Vec<Class>, AppError> {
    let classes = sqlx::query_as::<_, Class>(
        "SELECT * FROM classes WHERE institution_id = $1 ORDER BY semester, section"
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;
    Ok(classes)
}

pub async fn allocate_faculty(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    faculty_id: Uuid,
    req: AllocateFacultyRequest,
) -> Result<Uuid, AppError> {
    // Check AICTE workload cap (max 16 hours/week)
    let current_hours: Option<i64> = sqlx::query_scalar(
        "SELECT COALESCE(SUM(weekly_hours), 0) FROM course_allocations WHERE faculty_id = $1 AND academic_year = $2 AND semester = $3"
    )
    .bind(faculty_id)
    .bind(req.academic_year)
    .bind(req.semester)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    let new_hours = req.weekly_hours.unwrap_or(3) as i64;
    if current_hours.unwrap_or(0) + new_hours > 16 {
        return Err(AppError::UnprocessableEntity(
            format!("Faculty would exceed AICTE weekly limit of 16 hours (current: {})", current_hours.unwrap_or(0))
        ));
    }

    let allocation_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO course_allocations
            (allocation_id, institution_id, course_id, faculty_id, class_id,
             academic_year, semester, allocation_type, weekly_hours)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING allocation_id
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.course_id)
    .bind(faculty_id)
    .bind(req.class_id)
    .bind(req.academic_year)
    .bind(req.semester)
    .bind(req.allocation_type.unwrap_or_else(|| "Lecture".into()))
    .bind(req.weekly_hours.unwrap_or(3))
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    bus.publish(DomainEvent::FacultyAssigned(FacultyAssignedPayload {
        faculty_id,
        course_id: req.course_id,
        class_id: req.class_id,
        institution_id: claims.institution_id,
        occurred_at: Utc::now(),
    }));

    Ok(allocation_id)
}

pub async fn get_faculty_workload(db: &PgPool, claims: &Claims, faculty_id: Uuid, academic_year: i32, semester: i32) -> Result<FacultyWorkload, AppError> {
    let total_hours: Option<i64> = sqlx::query_scalar(
        "SELECT COALESCE(SUM(weekly_hours), 0) FROM course_allocations WHERE faculty_id = $1 AND institution_id = $2 AND academic_year = $3 AND semester = $4"
    )
    .bind(faculty_id)
    .bind(claims.institution_id)
    .bind(academic_year)
    .bind(semester)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    let hours = total_hours.unwrap_or(0);
    Ok(FacultyWorkload {
        faculty_id,
        total_hours: hours,
        is_overloaded: hours > 16,
        courses: vec![],
    })
}

pub async fn mark_attendance(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    faculty_id: Uuid,
    req: MarkAttendanceRequest,
) -> Result<Uuid, AppError> {
    let valid_statuses = ["Present", "Absent", "Leave", "Sick", "Duty"];
    if !valid_statuses.contains(&req.status.as_str()) {
        return Err(AppError::BadRequest(format!("Invalid status: {}", req.status)));
    }

    let attendance_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO attendance
            (attendance_id, institution_id, student_id, course_id, class_id,
             attendance_date, status, marked_by_faculty_id, marked_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (student_id, course_id, attendance_date)
        DO UPDATE SET status = $6, marked_by_faculty_id = $7, marked_at = NOW()
        RETURNING attendance_id
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.student_id)
    .bind(req.course_id)
    .bind(req.class_id)
    .bind(req.date)
    .bind(&req.status)
    .bind(faculty_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    log_event(db, claims.institution_id, claims.sub, "AttendanceMarked",
        attendance_id, "Academics",
        json!({ "student_id": req.student_id, "status": req.status, "date": req.date })).await?;

    bus.publish(DomainEvent::AttendanceMarked(AttendanceMarkedPayload {
        attendance_id,
        student_id: req.student_id,
        course_id: req.course_id,
        class_id: req.class_id,
        date: req.date.to_string(),
        status: req.status,
        occurred_at: Utc::now(),
    }));

    Ok(attendance_id)
}

pub async fn bulk_mark_attendance(
    db: &PgPool,
    bus: &EventBus,
    claims: &Claims,
    faculty_id: Uuid,
    req: BulkAttendanceRequest,
) -> Result<usize, AppError> {
    let mut count = 0usize;
    for entry in req.records {
        mark_attendance(db, bus, claims, faculty_id, MarkAttendanceRequest {
            student_id: entry.student_id,
            course_id: req.course_id,
            class_id: req.class_id,
            date: req.date,
            status: entry.status,
        }).await?;
        count += 1;
    }
    Ok(count)
}

pub async fn get_attendance_summary(
    db: &PgPool,
    student_id: Uuid,
    course_id: Uuid,
) -> Result<AttendanceSummary, AppError> {
    let (total, present, absent): (i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'Present') as present_count,
            COUNT(*) FILTER (WHERE status = 'Absent') as absent_count
        FROM attendance
        WHERE student_id = $1 AND course_id = $2 AND soft_deleted = false
        "#,
    )
    .bind(student_id)
    .bind(course_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    let pct = if total > 0 { (present as f64 / total as f64) * 100.0 } else { 0.0 };
    Ok(AttendanceSummary {
        student_id,
        course_id,
        total_classes: total,
        present_count: present,
        absent_count: absent,
        percentage: (pct * 100.0).round() / 100.0,
        is_eligible: pct >= 75.0,
    })
}

pub async fn list_attendance_defaulters(db: &PgPool, claims: &Claims) -> Result<Vec<serde_json::Value>, AppError> {
    #[derive(sqlx::FromRow)]
    struct DefaulterRow {
        student_id:        uuid::Uuid,
        first_name:        String,
        last_name:         Option<String>,
        enrollment_number: Option<String>,
        course_code:       String,
        course_name:       String,
        total_classes:     Option<i64>,
        present_count:     Option<i64>,
    }

    let rows = sqlx::query_as::<_, DefaulterRow>(
        r#"
        SELECT
            s.student_id, p.first_name, p.last_name, s.enrollment_number,
            c.course_code, c.course_name,
            COUNT(a.attendance_id) as total_classes,
            COUNT(a.attendance_id) FILTER (WHERE a.status = 'Present') as present_count
        FROM attendance a
        JOIN student_profiles s ON a.student_id = s.student_id
        JOIN persons p ON s.person_id = p.person_id
        JOIN courses c ON a.course_id = c.course_id
        WHERE a.institution_id = $1 AND a.soft_deleted = false
        GROUP BY s.student_id, p.first_name, p.last_name, s.enrollment_number, c.course_code, c.course_name
        HAVING (COUNT(a.attendance_id) FILTER (WHERE a.status = 'Present')::float / NULLIF(COUNT(a.attendance_id), 0)) < 0.75
        "#,
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let mut result = Vec::new();
    for row in rows {
        let total   = row.total_classes.unwrap_or(0);
        let present = row.present_count.unwrap_or(0);
        let pct = if total > 0 { (present as f64 / total as f64) * 100.0 } else { 0.0 };
        result.push(serde_json::json!({
            "student_id":        row.student_id,
            "first_name":        row.first_name,
            "last_name":         row.last_name,
            "enrollment_number": row.enrollment_number,
            "course_code":       row.course_code,
            "course_name":       row.course_name,
            "total_classes":     total,
            "present_count":     present,
            "percentage":        (pct * 100.0).round() / 100.0
        }));
    }

    Ok(result)
}

pub async fn create_timetable_slot(
    db: &PgPool,
    _bus: &EventBus,
    claims: &Claims,
    req: CreateTimetableSlotRequest,
) -> Result<TimetableSlot, AppError> {
    // 1. Get faculty_id and name for this course_allocation_id to check faculty clashes
    let faculty_info: Option<(Uuid, String, String)> = sqlx::query_as(
        r#"
        SELECT ca.faculty_id, p.first_name, c.course_code
        FROM course_allocations ca
        JOIN faculty f ON ca.faculty_id = f.faculty_id
        JOIN persons p ON f.person_id = p.person_id
        JOIN courses c ON ca.course_id = c.course_id
        WHERE ca.allocation_id = $1 AND ca.institution_id = $2
        "#
    )
    .bind(req.course_allocation_id)
    .bind(claims.institution_id)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    let (faculty_id, faculty_name, _course_code) = match faculty_info {
        Some(info) => info,
        None => return Err(AppError::NotFound("Course allocation not found".into())),
    };

    // 2. Class Clash: Check if this class/section is already busy at this time
    let class_clash: Option<String> = sqlx::query_scalar(
        r#"
        SELECT c.course_code FROM timetable_slots ts
        JOIN course_allocations ca ON ts.course_allocation_id = ca.allocation_id
        JOIN courses c ON ca.course_id = c.course_id
        WHERE ts.institution_id = $1
          AND ts.day_of_week = $2
          AND ts.class_id = $3
          AND ts.start_time < $5
          AND ts.end_time > $4
        LIMIT 1
        "#
    )
    .bind(claims.institution_id)
    .bind(req.day_of_week)
    .bind(req.class_id)
    .bind(req.start_time)
    .bind(req.end_time)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    if let Some(code) = class_clash {
        return Err(AppError::Conflict(format!(
            "Class Clash: This class section already has a lecture ({}) scheduled at this time.",
            code
        )));
    }

    // 3. Faculty Clash: Check if the teacher is already teaching another class at this time
    let faculty_clash: Option<String> = sqlx::query_scalar(
        r#"
        SELECT c.course_code FROM timetable_slots ts
        JOIN course_allocations ca ON ts.course_allocation_id = ca.allocation_id
        JOIN courses c ON ca.course_id = c.course_id
        WHERE ts.institution_id = $1
          AND ts.day_of_week = $2
          AND ca.faculty_id = $3
          AND ts.start_time < $5
          AND ts.end_time > $4
        LIMIT 1
        "#
    )
    .bind(claims.institution_id)
    .bind(req.day_of_week)
    .bind(faculty_id)
    .bind(req.start_time)
    .bind(req.end_time)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    if let Some(code) = faculty_clash {
        return Err(AppError::Conflict(format!(
            "Faculty Clash: Professor {} is already assigned to teach ({}) at this time.",
            faculty_name, code
        )));
    }

    // 4. Room Clash: Check if room is occupied (if room is provided)
    if let Some(ref room_num) = req.room {
        if !room_num.trim().is_empty() {
            let room_clash: Option<String> = sqlx::query_scalar(
                r#"
                SELECT c.course_code FROM timetable_slots ts
                JOIN course_allocations ca ON ts.course_allocation_id = ca.allocation_id
                JOIN courses c ON ca.course_id = c.course_id
                WHERE ts.institution_id = $1
                  AND ts.day_of_week = $2
                  AND ts.room = $3
                  AND ts.start_time < $5
                  AND ts.end_time > $4
                LIMIT 1
                "#
            )
            .bind(claims.institution_id)
            .bind(req.day_of_week)
            .bind(room_num)
            .bind(req.start_time)
            .bind(req.end_time)
            .fetch_optional(db)
            .await
            .map_err(AppError::Database)?;

            if let Some(code) = room_clash {
                return Err(AppError::Conflict(format!(
                    "Room Clash: Room {} is already occupied by lecture ({}) at this time.",
                    room_num, code
                )));
            }
        }
    }

    let slot = sqlx::query_as::<_, TimetableSlot>(
        r#"
        INSERT INTO timetable_slots
            (slot_id, institution_id, class_id, course_allocation_id,
             day_of_week, start_time, end_time, room, building)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(claims.institution_id)
    .bind(req.class_id)
    .bind(req.course_allocation_id)
    .bind(req.day_of_week)
    .bind(req.start_time)
    .bind(req.end_time)
    .bind(&req.room)
    .bind(&req.building)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(slot)
}

pub async fn get_timetable(db: &PgPool, claims: &Claims, class_id: Uuid) -> Result<Vec<serde_json::Value>, AppError> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT
            ts.slot_id,
            ts.class_id,
            ts.course_allocation_id,
            ts.day_of_week,
            ts.start_time,
            ts.end_time,
            ts.room,
            ts.building,
            c.course_code,
            c.course_name,
            (p.first_name || ' ' || COALESCE(p.last_name, '')) as faculty_name
        FROM timetable_slots ts
        JOIN course_allocations ca ON ts.course_allocation_id = ca.allocation_id
        JOIN courses c ON ca.course_id = c.course_id
        JOIN faculty f ON ca.faculty_id = f.faculty_id
        JOIN persons p ON f.person_id = p.person_id
        WHERE ts.class_id = $1 AND ts.institution_id = $2
        ORDER BY ts.day_of_week, ts.start_time
        "#
    )
    .bind(class_id)
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let mut slots = Vec::new();
    for r in rows {
        let start: chrono::NaiveTime = r.get("start_time");
        let end: chrono::NaiveTime = r.get("end_time");
        slots.push(serde_json::json!({
            "slot_id": r.get::<Uuid, _>("slot_id"),
            "class_id": r.get::<Uuid, _>("class_id"),
            "course_allocation_id": r.get::<Uuid, _>("course_allocation_id"),
            "day_of_week": r.get::<i32, _>("day_of_week"),
            "start_time": start.to_string(),
            "end_time": end.to_string(),
            "room": r.get::<Option<String>, _>("room"),
            "building": r.get::<Option<String>, _>("building"),
            "course_code": r.get::<String, _>("course_code"),
            "course_name": r.get::<String, _>("course_name"),
            "faculty_name": r.get::<String, _>("faculty_name"),
        }));
    }
    Ok(slots)
}

pub async fn list_allocations(db: &PgPool, claims: &Claims) -> Result<Vec<serde_json::Value>, AppError> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT
            ca.allocation_id,
            ca.class_id,
            ca.course_id,
            ca.faculty_id,
            c.course_code,
            c.course_name,
            (p.first_name || ' ' || COALESCE(p.last_name, '')) as faculty_name
        FROM course_allocations ca
        JOIN courses c ON ca.course_id = c.course_id
        JOIN faculty f ON ca.faculty_id = f.faculty_id
        JOIN persons p ON f.person_id = p.person_id
        WHERE ca.institution_id = $1
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let mut allocations = Vec::new();
    for r in rows {
        allocations.push(serde_json::json!({
            "allocation_id": r.get::<Uuid, _>("allocation_id"),
            "class_id": r.get::<Uuid, _>("class_id"),
            "course_id": r.get::<Uuid, _>("course_id"),
            "faculty_id": r.get::<Uuid, _>("faculty_id"),
            "course_code": r.get::<String, _>("course_code"),
            "course_name": r.get::<String, _>("course_name"),
            "faculty_name": r.get::<String, _>("faculty_name"),
        }));
    }
    Ok(allocations)
}

pub async fn list_curriculums(db: &PgPool, claims: &Claims) -> Result<Vec<CurriculumVersion>, AppError> {
    let rows = sqlx::query_as::<_, CurriculumVersion>(
        "SELECT curriculum_id, institution_id, year, pattern, effective_from, created_at
         FROM curriculum_versions
         WHERE institution_id = $1"
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;
    Ok(rows)
}

pub async fn set_course_prerequisite(
    db: &PgPool,
    claims: &Claims,
    course_id: Uuid,
    prerequisite_course_id: Uuid,
) -> Result<serde_json::Value, AppError> {
    sqlx::query(
        "INSERT INTO course_prerequisites (course_id, prerequisite_course_id) VALUES ($1, $2)"
    )
    .bind(course_id)
    .bind(prerequisite_course_id)
    .execute(db)
    .await
    .map_err(AppError::Database)?;

    Ok(serde_json::json!({ "course_id": course_id, "prerequisite_course_id": prerequisite_course_id }))
}

pub async fn get_course_prerequisites(
    db: &PgPool,
    claims: &Claims,
    course_id: Uuid,
) -> Result<Vec<CoursePrerequisite>, AppError> {
    let rows = sqlx::query_as::<_, CoursePrerequisite>(
        "SELECT id, course_id, prerequisite_course_id, created_at FROM course_prerequisites WHERE course_id = $1"
    )
    .bind(course_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;
    Ok(rows)
}

pub async fn add_curriculum_course(
    db: &PgPool,
    claims: &Claims,
    curriculum_id: Uuid,
    req: AddCurriculumCourseRequest,
) -> Result<CurriculumCourse, AppError> {
    let row = sqlx::query_as::<_, CurriculumCourse>(
        r#"
        INSERT INTO curriculum_courses (curriculum_id, course_id, semester, is_mandatory)
        VALUES ($1, $2, $3, $4)
        RETURNING curriculum_course_id, curriculum_id, course_id, semester, is_mandatory
        "#
    )
    .bind(curriculum_id)
    .bind(req.course_id)
    .bind(req.semester)
    .bind(req.is_mandatory)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(row)
}

pub async fn get_curriculum_courses(
    db: &PgPool,
    claims: &Claims,
    curriculum_id: Uuid,
) -> Result<Vec<serde_json::Value>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT cc.curriculum_course_id, cc.course_id, cc.semester, cc.is_mandatory,
               c.course_code, c.course_name
        FROM curriculum_courses cc
        JOIN courses c ON cc.course_id = c.course_id
        WHERE cc.curriculum_id = $1
        ORDER BY cc.semester, c.course_code
        "#
    )
    .bind(curriculum_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    use sqlx::Row;
    let mut results = Vec::new();
    for r in rows {
        results.push(serde_json::json!({
            "curriculum_course_id": r.get::<Uuid, _>("curriculum_course_id"),
            "course_id": r.get::<Uuid, _>("course_id"),
            "semester": r.get::<i32, _>("semester"),
            "is_mandatory": r.get::<bool, _>("is_mandatory"),
            "course_code": r.get::<String, _>("course_code"),
            "course_name": r.get::<String, _>("course_name"),
        }));
    }
    Ok(results)
}

pub async fn create_leave_request(
    db: &PgPool,
    claims: &Claims,
    req: CreateLeaveRequest,
) -> Result<LeaveRequest, AppError> {
    let student_id: Option<Uuid> = sqlx::query_scalar(
        r#"
        SELECT sp.student_id
        FROM users u
        JOIN student_profiles sp ON u.person_id = sp.person_id
        WHERE u.user_id = $1
        "#
    )
    .bind(claims.sub)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    let faculty_id: Option<Uuid> = sqlx::query_scalar(
        r#"
        SELECT f.faculty_id
        FROM users u
        JOIN faculty f ON u.person_id = f.person_id
        WHERE u.user_id = $1
        "#
    )
    .bind(claims.sub)
    .fetch_optional(db)
    .await
    .map_err(AppError::Database)?;

    if student_id.is_none() && faculty_id.is_none() {
        return Err(AppError::BadRequest("Only students and faculty members can apply for leave".into()));
    }

    let row = sqlx::query_as::<_, LeaveRequest>(
        r#"
        INSERT INTO leave_requests (student_id, faculty_id, start_date, end_date, leave_type, reason)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING leave_id, student_id, faculty_id, start_date, end_date, leave_type, reason, status, approved_by, created_at, updated_at
        "#
    )
    .bind(student_id)
    .bind(faculty_id)
    .bind(req.start_date)
    .bind(req.end_date)
    .bind(req.leave_type)
    .bind(req.reason)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(row)
}

pub async fn list_leave_requests(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<LeaveRequest>, AppError> {
    let rows = sqlx::query_as::<_, LeaveRequest>(
        "SELECT * FROM leave_requests ORDER BY created_at DESC"
    )
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(rows)
}

pub async fn update_leave_status(
    db: &PgPool,
    claims: &Claims,
    leave_id: Uuid,
    status: String,
) -> Result<LeaveRequest, AppError> {
    let row = sqlx::query_as::<_, LeaveRequest>(
        r#"
        UPDATE leave_requests
        SET status = $1, approved_by = $2, updated_at = NOW()
        WHERE leave_id = $3
        RETURNING leave_id, student_id, faculty_id, start_date, end_date, leave_type, reason, status, approved_by, created_at, updated_at
        "#
    )
    .bind(status)
    .bind(claims.sub)
    .bind(leave_id)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(row)
}

// ── Quizzes & Notifications Service Fns ───────────────────────────────────

pub async fn create_quiz(
    db: &PgPool,
    claims: &Claims,
    req: super::models::CreateQuizRequest,
) -> Result<super::models::Quiz, AppError> {
    let quiz = sqlx::query_as::<_, super::models::Quiz>(
        r#"
        INSERT INTO quizzes (institution_id, course_id, title, description, total_marks, quiz_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING quiz_id, institution_id, course_id, title, description, total_marks, quiz_date, created_at,
          (SELECT course_name FROM courses WHERE course_id = $2) as course_name,
          (SELECT course_code FROM courses WHERE course_id = $2) as course_code
        "#
    )
    .bind(claims.institution_id)
    .bind(req.course_id)
    .bind(req.title)
    .bind(req.description)
    .bind(req.total_marks)
    .bind(req.quiz_date)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(quiz)
}

pub async fn list_quizzes(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<super::models::Quiz>, AppError> {
    let quizzes = sqlx::query_as::<_, super::models::Quiz>(
        r#"
        SELECT q.quiz_id, q.institution_id, q.course_id, q.title, q.description, q.total_marks, q.quiz_date, q.created_at,
               c.course_name, c.course_code
        FROM quizzes q
        JOIN courses c ON q.course_id = c.course_id
        WHERE q.institution_id = $1
        ORDER BY q.quiz_date DESC, q.created_at DESC
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(quizzes)
}

pub async fn create_notification(
    db: &PgPool,
    claims: &Claims,
    req: super::models::CreateNotificationRequest,
) -> Result<super::models::Notification, AppError> {
    let notif = sqlx::query_as::<_, super::models::Notification>(
        r#"
        INSERT INTO notifications (institution_id, title, message, category, target_role, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING notification_id, institution_id, title, message, category, target_role, created_by, created_at,
          (SELECT username FROM users WHERE user_id = $6) as created_by_name
        "#
    )
    .bind(claims.institution_id)
    .bind(req.title)
    .bind(req.message)
    .bind(req.category)
    .bind(req.target_role)
    .bind(claims.sub)
    .fetch_one(db)
    .await
    .map_err(AppError::Database)?;

    Ok(notif)
}

pub async fn list_notifications(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<super::models::Notification>, AppError> {
    let notifs = sqlx::query_as::<_, super::models::Notification>(
        r#"
        SELECT n.notification_id, n.institution_id, n.title, n.message, n.category, n.target_role, n.created_by, n.created_at,
               u.username as created_by_name
        FROM notifications n
        LEFT JOIN users u ON n.created_by = u.user_id
        WHERE n.institution_id = $1
        ORDER BY n.created_at DESC
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    Ok(notifs)
}

pub async fn list_faculty(
    db: &PgPool,
    claims: &Claims,
) -> Result<Vec<serde_json::Value>, AppError> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"
        SELECT 
            f.faculty_id,
            f.employee_code,
            f.designation,
            f.qualification,
            f.specialization,
            f.joining_date,
            p.first_name,
            p.last_name,
            p.email,
            p.phone,
            d.department_name
        FROM faculty f
        JOIN persons p ON f.person_id = p.person_id
        LEFT JOIN departments d ON f.department_id = d.department_id
        WHERE f.institution_id = $1
        ORDER BY p.first_name ASC
        "#
    )
    .bind(claims.institution_id)
    .fetch_all(db)
    .await
    .map_err(AppError::Database)?;

    let mut list = Vec::new();
    for row in rows {
        let faculty_id: uuid::Uuid = row.get("faculty_id");
        let employee_code: Option<String> = row.get("employee_code");
        let designation: String = row.get("designation");
        let qualification: Option<String> = row.get("qualification");
        let specialization: Option<String> = row.get("specialization");
        let joining_date: Option<chrono::NaiveDate> = row.get("joining_date");
        let first_name: String = row.get("first_name");
        let last_name: Option<String> = row.get("last_name");
        let email: Option<String> = row.get("email");
        let phone: Option<String> = row.get("phone");
        let department_name: Option<String> = row.get("department_name");

        list.push(serde_json::json!({
            "faculty_id": faculty_id,
            "employee_code": employee_code,
            "designation": designation,
            "qualification": qualification,
            "specialization": specialization,
            "joining_date": joining_date,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone,
            "department_name": department_name,
        }));
    }
    Ok(list)
}
