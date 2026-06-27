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

use super::super::student::service::log_event;

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
