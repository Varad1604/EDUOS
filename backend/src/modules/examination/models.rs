use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use validator::Validate;

// ── DB Row Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Exam {
    pub exam_id:             Uuid,
    pub institution_id:      Uuid,
    pub exam_code:           Option<String>,
    pub course_id:           Uuid,
    pub class_id:            Uuid,
    pub exam_type:           String,
    pub scheduled_date:      NaiveDate,
    pub scheduled_time:      NaiveTime,
    pub duration_minutes:    i32,
    pub exam_mode:           String,
    pub max_marks:           i32,
    pub min_marks:           i32,
    pub invigilator_faculty_id: Option<Uuid>,
    pub hall_tickets_generated: bool,
    pub require_seating:     bool,
    pub created_at:          DateTime<Utc>,
    pub soft_deleted:        bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct HallTicket {
    pub hall_ticket_id: Uuid,
    pub institution_id: Uuid,
    pub exam_id:        Uuid,
    pub student_id:     Uuid,
    pub hall_no:        Option<String>,
    pub seat_no:        Option<String>,
    pub qr_code:        Option<String>,
    pub printed_date:   Option<DateTime<Utc>>,
    pub created_at:     DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MarksRow {
    pub marks_id:            Uuid,
    pub institution_id:      Uuid,
    pub exam_id:             Uuid,
    pub student_id:          Uuid,
    pub course_id:           Uuid,
    pub obtained_marks:      String,
    pub is_grace_marks:      bool,
    pub grace_marks_applied: Option<String>,
    pub revaluation_status:  String,
    pub revaluation_marks:   Option<String>,
    pub entered_by_faculty_id: Uuid,
    pub status:              String,
    pub entered_at:          DateTime<Utc>,
    pub soft_deleted:        bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct ResultRow {
    pub result_id:                Uuid,
    pub institution_id:           Uuid,
    pub student_id:               Uuid,
    pub semester:                 i32,
    pub academic_year:            i32,
    pub sgpa:                     String,
    pub cgpa:                     String,
    pub grade_points:             Option<String>,
    pub total_credits_earned:     Option<String>,
    pub total_credits_attempted:  Option<String>,
    pub status:                   String,
    pub backlogs_count:           i32,
    pub published_date:           Option<DateTime<Utc>>,
    pub created_at:               DateTime<Utc>,
    pub soft_deleted:             bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Transcript {
    pub transcript_id:       Uuid,
    pub institution_id:      Uuid,
    pub student_id:          Uuid,
    pub generated_at:        DateTime<Utc>,
    pub transcript_type:     String,
    pub file_url:            Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct GracePolicy {
    pub policy_id:          Uuid,
    pub institution_id:     Uuid,
    pub course_id:          Option<Uuid>,
    pub max_grace_marks:    i32,
    pub min_original_marks: i32,
    pub created_at:         DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct SeatingArrangement {
    pub arrangement_id: Uuid,
    pub exam_id:        Uuid,
    pub student_id:     Uuid,
    pub room_number:    String,
    pub seat_number:    String,
    pub created_at:     DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct SupplementaryExam {
    pub supp_exam_id:     Uuid,
    pub original_exam_id: Uuid,
    pub student_id:       Uuid,
    pub fee_paid:         bool,
    pub scheduled_date:   Option<NaiveDate>,
    pub scheduled_time:   Option<NaiveTime>,
    pub status:           String,
    pub created_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MarkModeration {
    pub moderation_id:   Uuid,
    pub exam_id:         Uuid,
    pub student_id:      Uuid,
    pub original_marks:  f64,
    pub moderated_marks: f64,
    pub reason:          String,
    pub created_by:      Option<Uuid>,
    pub created_at:      DateTime<Utc>,
}

// ── Request Types ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct CreateExamRequest {
    pub exam_code:       Option<String>,
    pub course_id:       Uuid,
    pub class_id:        Uuid,
    pub exam_type:       String,  // Internal | External | Backlog | MakeUp | Quiz
    pub scheduled_date:  NaiveDate,
    pub scheduled_time:  NaiveTime,
    pub duration_minutes: Option<i32>,
    pub exam_mode:       Option<String>,
    pub max_marks:       Option<i32>,
    pub min_marks:       Option<i32>,
    pub invigilator_faculty_id: Option<Uuid>,
    pub require_seating: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct EnterMarksRequest {
    pub exam_id:       Uuid,
    pub student_id:    Uuid,
    pub course_id:     Uuid,
    pub obtained_marks: f64,
}

#[derive(Debug, Deserialize)]
pub struct BulkMarksRequest {
    pub exam_id:  Uuid,
    pub course_id: Uuid,
    pub entries:  Vec<MarkEntry>,
}

#[derive(Debug, Deserialize)]
pub struct MarkEntry {
    pub student_id:     Uuid,
    pub obtained_marks: f64,
}

#[derive(Debug, Deserialize)]
pub struct ProcessResultRequest {
    pub student_id:   Uuid,
    pub semester:     i32,
    pub academic_year: i32,
}

#[derive(Debug, Deserialize)]
pub struct RevaluationRequest {
    pub marks_id:  Uuid,
    pub reason:    Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GenerateTranscriptRequest {
    pub student_id:      Uuid,
    pub transcript_type: String,  // Provisional | Official
}

#[derive(Debug, Deserialize)]
pub struct CreateGracePolicyRequest {
    pub course_id:          Option<Uuid>,
    pub max_grace_marks:    i32,
    pub min_original_marks: i32,
}

#[derive(Debug, Deserialize)]
pub struct ScheduleSupplementaryExamRequest {
    pub original_exam_id: Uuid,
    pub student_id:       Uuid,
    pub scheduled_date:   NaiveDate,
    pub scheduled_time:   NaiveTime,
}

#[derive(Debug, Deserialize)]
pub struct ApplyModerationRequest {
    pub exam_id:         Uuid,
    pub student_id:      Uuid,
    pub moderated_marks: f64,
    pub reason:          String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ExamListQuery {
    pub course_id:  Option<Uuid>,
    pub class_id:   Option<Uuid>,
    pub exam_type:  Option<String>,
    pub page:       Option<u32>,
    pub limit:      Option<u32>,
}

// ── CGPA/SGPA computation types ───────────────────────────────────────────────

/// Grade point lookup from marks percentage
pub fn marks_to_grade_point(marks: f64, max_marks: f64) -> f64 {
    let pct = (marks / max_marks) * 100.0;
    match pct as u32 {
        90..=100 => 10.0,
        80..=89  => 9.0,
        70..=79  => 8.0,
        60..=69  => 7.0,
        50..=59  => 6.0,
        40..=49  => 5.0,
        _        => 0.0,  // Fail
    }
}

pub fn compute_sgpa(course_marks: &[(f64, f64, f64)]) -> f64 {
    // (obtained, max, credits)
    let total_credits: f64 = course_marks.iter().map(|(_, _, c)| c).sum();
    if total_credits == 0.0 { return 0.0; }
    let weighted: f64 = course_marks.iter()
        .map(|(marks, max, credits)| marks_to_grade_point(*marks, *max) * credits)
        .sum();
        (weighted / total_credits * 100.0).round() / 100.0
}

#[derive(Debug, Deserialize)]
pub struct ApproveRevaluationRequest {
    pub status: String, // Approved | Rejected
    pub new_marks: Option<f64>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct RevaluationRequestRow {
    pub revaluation_id: Uuid,
    pub institution_id: Uuid,
    pub marks_id:       Uuid,
    pub student_id:     Uuid,
    pub request_date:   NaiveDate,
    pub reason:         Option<String>,
    pub status:         String,
    pub old_marks:      Option<String>,
    pub new_marks:      Option<String>,
    pub completed_at:   Option<DateTime<Utc>>,
    pub created_at:     DateTime<Utc>,
    pub student_name:   String,
    pub course_code:    String,
    pub course_name:    String,
}

