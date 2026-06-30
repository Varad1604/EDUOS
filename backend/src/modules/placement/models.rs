use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, Utc};
use validator::Validate;

// ── DB Row types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PlacementCompany {
    pub company_id:       Uuid,
    pub institution_id:   Uuid,
    pub company_name:     String,
    pub industry:         String,
    pub website:          Option<String>,
    pub contact_person:   Option<String>,
    pub contact_email:    Option<String>,
    pub contact_phone:    Option<String>,
    pub description:      Option<String>,
    pub logo_url:         Option<String>,
    pub status:           String,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
    pub soft_deleted:     bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PlacementDrive {
    pub drive_id:             Uuid,
    pub institution_id:       Uuid,
    pub company_id:           Uuid,
    pub drive_title:          String,
    pub job_role:             String,
    pub job_type:             String,
    pub job_location:         Option<String>,
    pub package_lpa:          Option<f64>,
    pub stipend_pm:           Option<f64>,
    pub min_cgpa:             f64,
    pub backlogs_allowed:     i32,
    pub eligible_branches:    Vec<String>,
    pub description:          Option<String>,
    pub bond_years:           i32,
    pub drive_date:           NaiveDate,
    pub application_deadline: NaiveDate,
    pub status:               String,
    pub created_at:           DateTime<Utc>,
    pub updated_at:           DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PlacementApplication {
    pub application_id:   Uuid,
    pub drive_id:         Uuid,
    pub student_id:       Uuid,
    pub institution_id:   Uuid,
    pub applied_at:       DateTime<Utc>,
    pub status:           String,
    pub rejection_reason: Option<String>,
    pub resume_url:       Option<String>,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PlacementInterview {
    pub interview_id:     Uuid,
    pub institution_id:   Uuid,
    pub application_id:   Uuid,
    pub round_name:       String,
    pub scheduled_at:     DateTime<Utc>,
    pub duration_minutes: Option<i32>,
    pub location_or_url:  Option<String>,
    pub status:           String,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct AlumniPlacement {
    pub alumni_id:        Uuid,
    pub institution_id:   Uuid,
    pub student_id:       Uuid,
    pub company_name:     String,
    pub designation:      String,
    pub ctc_lpa:          String, // NUMERIC(8,2) cast to TEXT
    pub joining_date:     NaiveDate,
    pub created_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PlacementInterviewRound {
    pub round_id:         Uuid,
    pub application_id:   Uuid,
    pub round_number:     i32,
    pub round_type:       String,
    pub scheduled_at:     DateTime<Utc>,
    pub venue:            Option<String>,
    pub mode:             String,
    pub result:           String,
    pub feedback:         Option<String>,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PlacementOffer {
    pub offer_id:         Uuid,
    pub application_id:   Uuid,
    pub student_id:       Uuid,
    pub drive_id:         Uuid,
    pub institution_id:   Uuid,
    pub offer_date:       NaiveDate,
    pub joining_date:     Option<NaiveDate>,
    pub package_lpa:      Option<f64>,
    pub stipend_pm:       Option<f64>,
    pub offer_letter_ref: Option<String>,
    pub status:           String,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

// ── Rich response types (JOINs) ───────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PlacementDriveResponse {
    pub drive_id:             Uuid,
    pub company_id:           Uuid,
    pub company_name:         String,
    pub industry:             String,
    pub drive_title:          String,
    pub job_role:             String,
    pub job_type:             String,
    pub job_location:         Option<String>,
    pub package_lpa:          Option<f64>,
    pub stipend_pm:           Option<f64>,
    pub min_cgpa:             f64,
    pub backlogs_allowed:     i32,
    pub eligible_branches:    Vec<String>,
    pub bond_years:           i32,
    pub drive_date:           NaiveDate,
    pub application_deadline: NaiveDate,
    pub status:               String,
    pub application_count:    Option<i64>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PlacementApplicationResponse {
    pub application_id:   Uuid,
    pub drive_id:         Uuid,
    pub drive_title:      String,
    pub job_role:         String,
    pub company_name:     String,
    pub package_lpa:      Option<f64>,
    pub student_id:       Uuid,
    pub student_name:     String,
    pub roll_number:      String,
    pub applied_at:       DateTime<Utc>,
    pub status:           String,
    pub rejection_reason: Option<String>,
    pub resume_url:       Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PlacementOfferResponse {
    pub offer_id:         Uuid,
    pub student_id:       Uuid,
    pub student_name:     String,
    pub roll_number:      String,
    pub company_name:     String,
    pub job_role:         String,
    pub drive_title:      String,
    pub offer_date:       NaiveDate,
    pub joining_date:     Option<NaiveDate>,
    pub package_lpa:      Option<f64>,
    pub stipend_pm:       Option<f64>,
    pub status:           String,
}

// ── Request types ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct CreateCompanyRequest {
    #[validate(length(min = 1, max = 200))]
    pub company_name:   String,
    #[validate(length(min = 1, max = 100))]
    pub industry:       String,
    pub website:        Option<String>,
    pub contact_person: Option<String>,
    #[validate(email)]
    pub contact_email:  Option<String>,
    pub contact_phone:  Option<String>,
    pub description:    Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateDriveRequest {
    pub company_id:           Uuid,
    #[validate(length(min = 1, max = 200))]
    pub drive_title:          String,
    #[validate(length(min = 1, max = 150))]
    pub job_role:             String,
    pub job_type:             String,   // Full-Time | Internship | PPO | Contractual
    pub job_location:         Option<String>,
    pub package_lpa:          Option<f64>,
    pub stipend_pm:           Option<f64>,
    pub min_cgpa:             f64,
    pub backlogs_allowed:     i32,
    pub eligible_branches:    Vec<String>,
    pub description:          Option<String>,
    pub bond_years:           i32,
    pub drive_date:           NaiveDate,
    pub application_deadline: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct ApplyDriveRequest {
    pub drive_id:   Uuid,
    pub student_id: Uuid,
    pub resume_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateApplicationStatusRequest {
    pub status:           String,  // Shortlisted | Rejected | Interview | Offered | Accepted | Declined
    pub rejection_reason: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateInterviewRoundRequest {
    pub application_id: Uuid,
    pub round_number:   i32,
    pub round_type:     String, // Aptitude | Technical | HR | GD | Coding | Final
    pub scheduled_at:   DateTime<Utc>,
    pub venue:          Option<String>,
    pub mode:           String, // In-Person | Online | Hybrid
}

#[derive(Debug, Deserialize)]
pub struct UpdateInterviewResultRequest {
    pub result:   String, // Cleared | Rejected
    pub feedback: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOfferRequest {
    pub application_id:   Uuid,
    pub joining_date:     Option<NaiveDate>,
    pub package_lpa:      Option<f64>,
    pub stipend_pm:       Option<f64>,
    pub offer_letter_ref: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOfferStatusRequest {
    pub status: String, // Accepted | Declined | Revoked
}

// ── Summary / stats ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct PlacementStats {
    pub total_companies:    i64,
    pub total_drives:       i64,
    pub open_drives:        i64,
    pub total_applications: i64,
    pub total_offers:       i64,
    pub accepted_offers:    i64,
    pub avg_package_lpa:    Option<f64>,
    pub highest_package_lpa: Option<f64>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct EligibleStudent {
    pub student_id:        uuid::Uuid,
    pub roll_number:       Option<String>,
    pub student_name:      String,
    pub email:             Option<String>,
    pub phone:             Option<String>,
    pub branch_name:       Option<String>,
    pub branch_code:       Option<String>,
    pub cgpa:              Option<String>,
    pub backlogs_count:    i64,
    pub applied:           bool,
}

#[derive(Debug, Deserialize)]
pub struct ScheduleInterviewRequest {
    pub application_id:   Uuid,
    pub round_name:       String,
    pub scheduled_at:     DateTime<Utc>,
    pub duration_minutes: Option<i32>,
    pub location_or_url:  Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TrackAlumniPlacementRequest {
    pub student_id:       Uuid,
    pub company_name:     String,
    pub designation:      String,
    pub ctc_lpa:          f64,
    pub joining_date:     NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInterviewStatusRequest {
    pub status:           String,
}

