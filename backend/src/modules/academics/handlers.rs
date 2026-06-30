use axum::{extract::{Path, Query, State}, Extension, Json};
use serde_json::json;
use serde::Deserialize;
use uuid::Uuid;
use crate::{error::AppError, middleware::auth::Claims, modules::academics::{models::*, service}, response::ok, state::AppState};

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

pub async fn update_course(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(id): Path<Uuid>, Json(b): Json<CreateCourseRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::update_course(&s.db, &c, id, b).await?))
}

pub async fn delete_course(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    service::delete_course(&s.db, &c, id).await?;
    Ok(ok(json!({ "deleted": true })))
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

pub async fn get_attendance_defaulters(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_attendance_defaulters(&s.db, &c).await?))
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

pub async fn list_curriculums(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_curriculums(&s.db, &c).await?))
}

pub async fn set_course_prerequisite(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(course_id): Path<Uuid>, Json(b): Json<SetCoursePrerequisiteRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::set_course_prerequisite(&s.db, &c, course_id, b.prerequisite_course_id).await?))
}

pub async fn get_course_prerequisites(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::get_course_prerequisites(&s.db, &c, course_id).await?))
}

pub async fn add_curriculum_course(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(curriculum_id): Path<Uuid>, Json(b): Json<AddCurriculumCourseRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::add_curriculum_course(&s.db, &c, curriculum_id, b).await?))
}

pub async fn get_curriculum_courses(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(curriculum_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::get_curriculum_courses(&s.db, &c, curriculum_id).await?))
}

pub async fn create_leave_request(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateLeaveRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::create_leave_request(&s.db, &c, b).await?))
}

pub async fn list_leave_requests(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_leave_requests(&s.db, &c).await?))
}

pub async fn update_leave_status(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Path(leave_id): Path<Uuid>, Json(b): Json<UpdateLeaveStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::update_leave_status(&s.db, &c, leave_id, b.status).await?))
}

// ── Quizzes & Notifications Handlers ─────────────────────────────────────

pub async fn create_quiz(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateQuizRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    use validator::Validate;
    b.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    Ok(ok(service::create_quiz(&s.db, &c, b).await?))
}

pub async fn list_quizzes(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_quizzes(&s.db, &c).await?))
}

pub async fn create_notification(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
    Json(b): Json<CreateNotificationRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    use validator::Validate;
    b.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    Ok(ok(service::create_notification(&s.db, &c, b).await?))
}

pub async fn list_notifications(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_notifications(&s.db, &c).await?))
}

pub async fn list_faculty(
    State(s): State<AppState>, Extension(c): Extension<Claims>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(ok(service::list_faculty(&s.db, &c).await?))
}
