use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, Utc};
use validator::Validate;

// ── DB Row types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MedicalVisit {
    pub visit_id:        Uuid,
    pub institution_id:  Uuid,
    pub student_id:      Uuid,
    pub visit_date:      NaiveDate,
    pub chief_complaint: String,
    pub doctor_name:     String,
    pub diagnosis:       Option<String>,
    pub notes:           Option<String>,
    pub follow_up_date:  Option<NaiveDate>,
    pub status:          String,
    pub created_at:      DateTime<Utc>,
    pub updated_at:      DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MedicalVital {
    pub vital_id:       Uuid,
    pub visit_id:       Uuid,
    pub temperature_c:  Option<f64>,
    pub pulse_bpm:      Option<i32>,
    pub bp_systolic:    Option<i32>,
    pub bp_diastolic:   Option<i32>,
    pub spo2_pct:       Option<f64>,
    pub weight_kg:      Option<f64>,
    pub height_cm:      Option<f64>,
    pub recorded_at:    DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MedicalPrescription {
    pub prescription_id: Uuid,
    pub visit_id:        Uuid,
    pub medicine_name:   String,
    pub dosage:          String,
    pub frequency:       String,
    pub duration_days:   i32,
    pub route:           String,
    pub instructions:    Option<String>,
    pub created_at:      DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MedicalInventoryItem {
    pub item_id:           Uuid,
    pub institution_id:    Uuid,
    pub item_name:         String,
    pub item_category:     String,
    pub unit:              String,
    pub quantity_in_stock: i32,
    pub reorder_level:     i32,
    pub expiry_date:       Option<NaiveDate>,
    pub batch_number:      Option<String>,
    pub manufacturer:      Option<String>,
    pub created_at:        DateTime<Utc>,
    pub updated_at:        DateTime<Utc>,
    pub soft_deleted:      bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MedicalSickLeave {
    pub sick_leave_id:      Uuid,
    pub visit_id:           Uuid,
    pub student_id:         Uuid,
    pub institution_id:     Uuid,
    pub leave_from:         NaiveDate,
    pub leave_to:           NaiveDate,
    pub days:               i32,
    pub doctor_name:        String,
    pub remarks:            Option<String>,
    pub certificate_number: Option<String>,
    pub issued_at:          DateTime<Utc>,
}

// ── Rich response types ───────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MedicalVisitResponse {
    pub visit_id:        Uuid,
    pub student_id:      Uuid,
    pub student_name:    String,
    pub roll_number:     String,
    pub visit_date:      NaiveDate,
    pub chief_complaint: String,
    pub doctor_name:     String,
    pub diagnosis:       Option<String>,
    pub notes:           Option<String>,
    pub follow_up_date:  Option<NaiveDate>,
    pub status:          String,
    pub created_at:      DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct SickLeaveResponse {
    pub sick_leave_id:      Uuid,
    pub student_id:         Uuid,
    pub student_name:       String,
    pub roll_number:        String,
    pub leave_from:         NaiveDate,
    pub leave_to:           NaiveDate,
    pub days:               i32,
    pub doctor_name:        String,
    pub remarks:            Option<String>,
    pub certificate_number: Option<String>,
    pub issued_at:          DateTime<Utc>,
}

// ── Request types ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct CreateVisitRequest {
    pub student_id:      Uuid,
    #[validate(length(min = 1, max = 500))]
    pub chief_complaint: String,
    #[validate(length(min = 1, max = 200))]
    pub doctor_name:     String,
    pub diagnosis:       Option<String>,
    pub notes:           Option<String>,
    pub follow_up_date:  Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct CloseVisitRequest {
    pub diagnosis:      Option<String>,
    pub notes:          Option<String>,
    pub follow_up_date: Option<NaiveDate>,
    pub status:         String, // Closed | FollowUp
}

#[derive(Debug, Deserialize)]
pub struct RecordVitalsRequest {
    pub temperature_c: Option<f64>,
    pub pulse_bpm:     Option<i32>,
    pub bp_systolic:   Option<i32>,
    pub bp_diastolic:  Option<i32>,
    pub spo2_pct:      Option<f64>,
    pub weight_kg:     Option<f64>,
    pub height_cm:     Option<f64>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreatePrescriptionRequest {
    pub visit_id:      Uuid,
    #[validate(length(min = 1, max = 200))]
    pub medicine_name: String,
    #[validate(length(min = 1, max = 100))]
    pub dosage:        String,
    #[validate(length(min = 1, max = 50))]
    pub frequency:     String,    // OD | BD | TDS | QID | SOS | PRN
    pub duration_days: i32,
    pub route:         String,    // Oral | Topical | IV | IM | Sublingual | Inhalation | Other
    pub instructions:  Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateInventoryItemRequest {
    #[validate(length(min = 1, max = 200))]
    pub item_name:      String,
    pub item_category:  String,   // Medicine | Consumable | Equipment | Vaccine | Other
    #[validate(length(min = 1, max = 50))]
    pub unit:           String,
    pub quantity_in_stock: i32,
    pub reorder_level:  i32,
    pub expiry_date:    Option<NaiveDate>,
    pub batch_number:   Option<String>,
    pub manufacturer:   Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct AdjustStockRequest {
    pub delta:  i32,    // positive = stock in, negative = dispense
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct IssueSickLeaveRequest {
    pub visit_id:    Uuid,
    pub student_id:  Uuid,
    pub leave_from:  NaiveDate,
    pub leave_to:    NaiveDate,
    #[validate(length(min = 1, max = 200))]
    pub doctor_name: String,
    pub remarks:     Option<String>,
}

// ── Stats ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct MedicalStats {
    pub total_visits_today:     i64,
    pub total_visits_month:     i64,
    pub open_visits:            i64,
    pub sick_leaves_issued:     i64,
    pub low_stock_items:        i64,
    pub expiring_soon_items:    i64,
}
