use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, Utc};
use validator::Validate;

// ── DB Row types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Person {
    pub person_id:      Uuid,
    pub institution_id: Uuid,
    pub first_name:     String,
    pub last_name:      Option<String>,
    pub date_of_birth:  Option<NaiveDate>,
    pub gender:         Option<String>,
    pub aadhar:         Option<String>,
    pub phone:          Option<String>,
    pub email:          Option<String>,
    pub address:        Option<serde_json::Value>,
    pub created_at:     DateTime<Utc>,
    pub soft_deleted:   bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct StudentProfile {
    pub student_id:            Uuid,
    pub person_id:             Uuid,
    pub institution_id:        Uuid,
    pub enrollment_number:     Option<String>,
    pub enrollment_status:     String,
    pub enrollment_date:       Option<NaiveDate>,
    pub branch_id:             Option<Uuid>,
    pub current_semester:      Option<i32>,
    pub current_academic_year: Option<i32>,
    pub cgpa:                  Option<String>,
    pub category:              Option<String>,
    pub quota:                 Option<String>,
    pub guardian_name:         Option<String>,
    pub guardian_phone:        Option<String>,
    pub guardian_relation:     Option<String>,
    pub created_at:            DateTime<Utc>,
    pub updated_at:            DateTime<Utc>,
    pub soft_deleted:          bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct StudentDocument {
    pub document_id:    Uuid,
    pub student_id:     Uuid,
    pub document_type:  String,
    pub file_url:       Option<String>,
    pub file_name:      Option<String>,
    pub upload_date:    DateTime<Utc>,
    pub version_number: i32,
    pub soft_deleted:   bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct StudentAcademicRecord {
    pub record_id:          Uuid,
    pub student_id:         Uuid,
    pub program_id:         Uuid,
    pub enrollment_year:    i32,
    pub current_semester:   Option<i32>,
    pub cgpa:               Option<String>,
    pub eligibility_status: Option<String>,
    pub created_at:         DateTime<Utc>,
}

// ── Request types ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct CreateStudentRequest {
    // Person fields
    #[validate(length(min = 1, max = 100))]
    pub first_name:  String,
    pub last_name:   Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub gender:      Option<String>,
    #[validate(length(min = 12, max = 12))]
    pub aadhar:      Option<String>,
    pub phone:       Option<String>,
    #[validate(email)]
    pub email:       Option<String>,
    pub address:     Option<serde_json::Value>,

    // Student-specific
    pub enrollment_number:  Option<String>,
    pub enrollment_date:    Option<NaiveDate>,
    pub branch_id:          Option<Uuid>,
    pub current_semester:   Option<i32>,
    pub current_academic_year: Option<i32>,
    pub category:           Option<String>,
    pub quota:              Option<String>,
    pub guardian_name:      Option<String>,
    pub guardian_phone:     Option<String>,
    pub guardian_relation:  Option<String>,
    pub program_id:         Option<Uuid>,
    pub enrollment_year:    Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateStudentRequest {
    pub first_name:      Option<String>,
    pub last_name:       Option<String>,
    pub phone:           Option<String>,
    #[validate(email)]
    pub email:           Option<String>,
    pub address:         Option<serde_json::Value>,
    pub branch_id:       Option<Uuid>,
    pub current_semester: Option<i32>,
    pub category:        Option<String>,
    pub quota:           Option<String>,
    pub guardian_name:   Option<String>,
    pub guardian_phone:  Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChangeStatusRequest {
    pub new_status: String,
    pub reason:     Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StudentListQuery {
    pub page:              Option<u32>,
    pub limit:             Option<u32>,
    pub status:            Option<String>,
    pub branch_id:         Option<Uuid>,
    pub semester:          Option<i32>,
    pub search:            Option<String>,
    pub academic_year:     Option<i32>,
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct StudentResponse {
    pub student_id:        Uuid,
    pub person:            Person,
    pub enrollment_number: Option<String>,
    pub enrollment_status: String,
    pub enrollment_date:   Option<NaiveDate>,
    pub branch_id:         Option<Uuid>,
    pub current_semester:  Option<i32>,
    pub category:          Option<String>,
    pub quota:             Option<String>,
    pub cgpa:              Option<String>,
    pub guardian_name:     Option<String>,
    pub guardian_phone:    Option<String>,
    pub created_at:        DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct PaginatedStudents {
    pub data:  Vec<StudentResponse>,
    pub total: i64,
    pub page:  u32,
    pub limit: u32,
}

// ── Valid enrollment statuses ─────────────────────────────────────────────────

pub const VALID_STATUSES: &[&str] = &[
    "Inquiry", "Applicant", "Admitted", "Active",
    "Detained", "Alumni", "Dropout", "Cancelled",
];

pub fn is_valid_status(status: &str) -> bool {
    VALID_STATUSES.contains(&status)
}

/// Validate status transitions (state machine)
pub fn is_valid_transition(from: &str, to: &str) -> bool {
    match (from, to) {
        ("Inquiry",    "Applicant")  => true,
        ("Applicant",  "Admitted")   => true,
        ("Applicant",  "Cancelled")  => true,
        ("Admitted",   "Active")     => true,
        ("Admitted",   "Cancelled")  => true,
        ("Active",     "Detained")   => true,
        ("Active",     "Alumni")     => true,
        ("Active",     "Dropout")    => true,
        ("Active",     "Cancelled")  => true,
        ("Detained",   "Active")     => true,
        ("Detained",   "Dropout")    => true,
        ("Detained",   "Cancelled")  => true,
        _                            => false,
    }
}
