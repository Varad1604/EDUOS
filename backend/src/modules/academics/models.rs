use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use validator::Validate;

// ── DB Row Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Course {
    pub course_id:      Uuid,
    pub institution_id: Uuid,
    pub curriculum_id:  Uuid,
    pub course_code:    String,
    pub course_name:    String,
    pub credits:        String,
    pub course_type:    String,
    pub semester:       Option<i32>,
    pub min_marks:      i32,
    pub max_marks:      i32,
    pub internal_max:   i32,
    pub external_max:   i32,
    pub course_outcomes: Option<serde_json::Value>,
    pub weekly_hours:   i32,
    pub created_at:     DateTime<Utc>,
    pub soft_deleted:   bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
#[allow(dead_code)]
pub struct Faculty {
    pub faculty_id:     Uuid,
    pub person_id:      Uuid,
    pub institution_id: Uuid,
    pub employee_code:  Option<String>,
    pub designation:    String,
    pub department_id:  Option<Uuid>,
    pub qualification:  Option<String>,
    pub specialization: Option<String>,
    pub joining_date:   Option<NaiveDate>,
    pub created_at:     DateTime<Utc>,
    pub soft_deleted:   bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Class {
    pub class_id:       Uuid,
    pub institution_id: Uuid,
    pub branch_id:      Option<Uuid>,
    pub semester:       i32,
    pub section:        String,
    pub academic_year:  i32,
    pub created_at:     DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct TimetableSlot {
    pub slot_id:              Uuid,
    pub institution_id:       Uuid,
    pub class_id:             Uuid,
    pub course_allocation_id: Uuid,
    pub day_of_week:          i32,
    pub start_time:           NaiveTime,
    pub end_time:             NaiveTime,
    pub room:                 Option<String>,
    pub building:             Option<String>,
    pub created_at:           DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
#[allow(dead_code)]
pub struct AttendanceRecord {
    pub attendance_id:       Uuid,
    pub student_id:          Uuid,
    pub course_id:           Uuid,
    pub class_id:            Uuid,
    pub attendance_date:     NaiveDate,
    pub status:              String,
    pub marked_by_faculty_id: Option<Uuid>,
    pub marked_at:           DateTime<Utc>,
    pub soft_deleted:        bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
#[allow(dead_code)]
pub struct CurriculumVersion {
    pub curriculum_id:  Uuid,
    pub institution_id: Uuid,
    pub year:           i32,
    pub pattern:        String,
    pub effective_from: NaiveDate,
    pub created_at:     DateTime<Utc>,
}

// ── Request Types ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct CreateCourseRequest {
    pub curriculum_id:   Uuid,
    #[validate(length(min = 2, max = 20))]
    pub course_code:     String,
    #[validate(length(min = 2, max = 150))]
    pub course_name:     String,
    pub credits:         f64,   // request field — bound as f64 in INSERT
    pub course_type:     String,  // Theory | Practical | Project | Seminar
    pub semester:        Option<i32>,
    pub min_marks:       Option<i32>,
    pub max_marks:       Option<i32>,
    pub internal_max:    Option<i32>,
    pub external_max:    Option<i32>,
    pub course_outcomes: Option<serde_json::Value>,
    pub weekly_hours:    Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
#[allow(dead_code)]
pub struct CreateFacultyRequest {
    // Person fields
    #[validate(length(min = 1))]
    pub first_name:    String,
    pub last_name:     Option<String>,
    pub phone:         Option<String>,
    #[validate(email)]
    pub email:         Option<String>,
    pub aadhar:        Option<String>,
    // Faculty fields
    pub employee_code: Option<String>,
    pub designation:   String,
    pub department_id: Option<Uuid>,
    pub qualification: Option<String>,
    pub specialization: Option<String>,
    pub joining_date:  Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct MarkAttendanceRequest {
    pub student_id:  Uuid,
    pub course_id:   Uuid,
    pub class_id:    Uuid,
    pub date:        NaiveDate,
    pub status:      String,   // Present | Absent | Leave | Sick | Duty
}

#[derive(Debug, Deserialize)]
pub struct BulkAttendanceRequest {
    pub course_id:   Uuid,
    pub class_id:    Uuid,
    pub date:        NaiveDate,
    pub records:     Vec<AttendanceEntry>,
}

#[derive(Debug, Deserialize)]
pub struct AttendanceEntry {
    pub student_id: Uuid,
    pub status:     String,
}

#[derive(Debug, Deserialize)]
pub struct CreateClassRequest {
    pub branch_id:    Option<Uuid>,
    pub semester:     i32,
    pub section:      Option<String>,
    pub academic_year: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateTimetableSlotRequest {
    pub class_id:              Uuid,
    pub course_allocation_id:  Uuid,
    pub day_of_week:           i32,
    pub start_time:            NaiveTime,
    pub end_time:              NaiveTime,
    pub room:                  Option<String>,
    pub building:              Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AllocateFacultyRequest {
    pub course_id:       Uuid,
    pub class_id:        Uuid,
    pub academic_year:   i32,
    pub semester:        i32,
    pub allocation_type: Option<String>,
    pub weekly_hours:    Option<i32>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct AttendanceQuery {
    pub course_id:    Option<Uuid>,
    pub class_id:     Option<Uuid>,
    pub from_date:    Option<NaiveDate>,
    pub to_date:      Option<NaiveDate>,
}

// ── Response Types ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct AttendanceSummary {
    pub student_id:     Uuid,
    pub course_id:      Uuid,
    pub total_classes:  i64,
    pub present_count:  i64,
    pub absent_count:   i64,
    pub percentage:     f64,
    pub is_eligible:    bool,  // >= 75%
}

#[derive(Debug, Serialize)]
pub struct FacultyWorkload {
    pub faculty_id:      Uuid,
    pub total_hours:     i64,
    pub is_overloaded:   bool,   // > 16 hours/week (AICTE)
    pub courses:         Vec<serde_json::Value>,
}
