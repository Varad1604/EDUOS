use axum::{extract::{Path, Query, State}, Extension, Json};
use serde_json::json;
use serde::Deserialize;
use uuid::Uuid;
use crate::{error::AppError, middleware::auth::Claims, modules::academics::{models::*, service}, state::AppState};

fn ok<T: serde::Serialize>(data: T) -> Json<serde_json::Value> {
    Json(json!({ "success": true, "data": data, "meta": { "timestamp": chrono::Utc::now() } }))
}

#[derive(Deserialize)] pub struct CourseQuery { pub curriculum_id: Option<Uuid> }
#[derive(Deserialize)] pub struct WorkloadQuery { pub academic_year: Option<i32>, pub semester: Option<i32> }
#[derive(Deserialize)] #[allow(dead_code)] pub struct TimetableQuery { pub class_id: Uuid }
#[derive(Deserialize)] pub struct AttendanceSummaryQuery { pub course_id: Uuid }

// ── Courses ───────────────────────────────────────────────────────────────────
pub async fn create_course(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateCourseRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::create_course(&s.db, &s.bus, &c, b).await?))
}

pub async fn list_courses(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Query(q): Query<CourseQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_courses(&s.db, &c, q.curriculum_id).await?))
}

pub async fn get_course(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::get_course(&s.db, &c, id).await?))
}

// ── Classes ───────────────────────────────────────────────────────────────────
pub async fn create_class(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateClassRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::create_class(&s.db, &c, b).await?))
}

pub async fn list_classes(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_classes(&s.db, &c).await?))
}

// ── Faculty allocation ────────────────────────────────────────────────────────
pub async fn allocate_faculty(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(faculty_id): Path<Uuid>, Json(b): Json<AllocateFacultyRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let id = service::allocate_faculty(&s.db, &s.bus, &c, faculty_id, b).await?;
    Ok(ok(json!({ "allocation_id": id })))
}

pub async fn get_faculty_workload(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(faculty_id): Path<Uuid>, Query(q): Query<WorkloadQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let wl = service::get_faculty_workload(&s.db, &c, faculty_id,
        q.academic_year.unwrap_or(2024), q.semester.unwrap_or(1)).await?;
    Ok(ok(wl))
}

// ── Attendance ────────────────────────────────────────────────────────────────
pub async fn mark_attendance(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<MarkAttendanceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let id = service::mark_attendance(&s.db, &s.bus, &c, c.sub, b).await?;
    Ok(ok(json!({ "attendance_id": id })))
}

pub async fn bulk_mark_attendance(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<BulkAttendanceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let count = service::bulk_mark_attendance(&s.db, &s.bus, &c, c.sub, b).await?;
    Ok(ok(json!({ "marked_count": count })))
}

pub async fn get_attendance_summary(
    State(s): State<AppState>, Extension(_c): Extension<Claims>,
    Path(student_id): Path<Uuid>, Query(q): Query<AttendanceSummaryQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::get_attendance_summary(&s.db, student_id, q.course_id).await?))
}

// ── Timetable ─────────────────────────────────────────────────────────────────
pub async fn create_timetable_slot(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateTimetableSlotRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::create_timetable_slot(&s.db, &s.bus, &c, b).await?))
}

pub async fn get_timetable(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(class_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::get_timetable(&s.db, &c, class_id).await?))
}

pub async fn list_allocations(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_allocations(&s.db, &c).await?))
}
