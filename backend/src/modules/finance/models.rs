use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, Utc};
use validator::Validate;

// ── DB Row Types ──────────────────────────────────────────────────────────────
// We map NUMERIC columns to String (sqlx decodes NUMERIC→String reliably) so
// we avoid the bigdecimal version-mismatch and serde problems entirely.

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct FeeStructure {
    pub fee_structure_id: Uuid,
    pub institution_id:   Uuid,
    pub academic_year:    i32,
    pub branch_id:        Option<Uuid>,
    pub category:         Option<String>,
    pub quota:            Option<String>,
    pub semesters:        serde_json::Value,
    pub total_amount:     String,
    pub created_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct FeeAllocation {
    pub fee_allocation_id: Uuid,
    pub institution_id:    Uuid,
    pub student_id:        Uuid,
    pub fee_structure_id:  Uuid,
    pub academic_year:     i32,
    pub semester:          i32,
    pub total_amount:      String,
    pub paid_amount:       String,
    pub due_date:          NaiveDate,
    pub status:            String,
    pub waiver_amount:     String,
    pub waiver_reason:     Option<String>,
    pub created_at:        DateTime<Utc>,
    pub soft_deleted:      bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct FeePayment {
    pub payment_id:        Uuid,
    pub institution_id:    Uuid,
    pub fee_allocation_id: Uuid,
    pub student_id:        Uuid,
    pub amount:            String,
    pub payment_mode:      String,
    pub payment_gateway:   Option<String>,
    pub transaction_id:    Option<String>,
    pub payment_date:      Option<DateTime<Utc>>,
    pub status:            String,
    pub receipt_number:    Option<String>,
    pub receipt_generated: bool,
    pub created_at:        DateTime<Utc>,
    pub soft_deleted:      bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Scholarship {
    pub scholarship_id:       Uuid,
    pub institution_id:       Uuid,
    pub scholarship_name:     String,
    pub scholarship_type:     String,
    pub amount:               Option<String>,
    pub eligibility_criteria: serde_json::Value,
    pub academic_year:        Option<i32>,
    pub total_beneficiaries:  Option<i32>,
    pub application_deadline: Option<NaiveDate>,
    pub created_at:           DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct ScholarshipAllotment {
    pub allotment_id:   Uuid,
    pub institution_id: Uuid,
    pub student_id:     Uuid,
    pub scholarship_id: Uuid,
    pub allotment_date: NaiveDate,
    pub amount:         String,
    pub status:         String,
    pub disbursal_date: Option<NaiveDate>,
    pub disbursal_mode: Option<String>,
    pub bank_reference: Option<String>,
    pub created_at:     DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Account {
    pub account_id:      Uuid,
    pub institution_id:  Uuid,
    pub account_code:    String,
    pub account_name:    String,
    pub account_type:    String,
    pub opening_balance: String,
    pub current_balance: String,
    pub fiscal_year:     i32,
    pub is_active:       bool,
    pub created_at:      DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct JournalEntry {
    pub journal_id:     Uuid,
    pub institution_id: Uuid,
    pub entry_date:     NaiveDate,
    pub reference:      Option<String>,
    pub description:    Option<String>,
    pub status:         String,
    pub posted_at:      Option<DateTime<Utc>>,
    pub created_at:     DateTime<Utc>,
}

// ── Request Types ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
#[allow(dead_code)]
pub struct CreateFeeStructureRequest {
    pub academic_year: i32,
    pub branch_id:     Option<Uuid>,
    pub category:      Option<String>,
    pub quota:         Option<String>,
    pub program_id:    Option<Uuid>,
    pub semesters:     Vec<SemesterFee>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SemesterFee {
    pub semester: i32,
    pub amount:   f64,
}

#[derive(Debug, Deserialize)]
pub struct AllocateFeeRequest {
    pub student_id:       Uuid,
    pub fee_structure_id: Uuid,
    pub academic_year:    i32,
    pub semester:         i32,
    pub due_date:         NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct InitiatePaymentRequest {
    pub fee_allocation_id: Uuid,
    pub amount:            f64,
    pub payment_mode:      String,
    pub payment_gateway:   Option<String>,
    pub transaction_id:    Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ReconcilePaymentRequest {
    pub bank_amount:   f64,
    pub reconciled_by: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateScholarshipRequest {
    #[validate(length(min = 2))]
    pub scholarship_name:     String,
    pub scholarship_type:     String,
    pub amount:               Option<f64>,
    pub eligibility_criteria: serde_json::Value,
    pub academic_year:        Option<i32>,
    pub total_beneficiaries:  Option<i32>,
    pub application_deadline: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct AllocateScholarshipRequest {
    pub student_id: Uuid,
    pub amount:     f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccountRequest {
    pub account_code:      String,
    pub account_name:      String,
    pub account_type:      String,
    pub opening_balance:   Option<f64>,
    pub fiscal_year:       i32,
    pub parent_account_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateJournalEntryRequest {
    pub entry_date:  NaiveDate,
    pub reference:   Option<String>,
    pub description: Option<String>,
    pub items:       Vec<JournalItemRequest>,
}

#[derive(Debug, Deserialize)]
pub struct JournalItemRequest {
    pub account_id:    Uuid,
    pub debit_amount:  Option<f64>,
    pub credit_amount: Option<f64>,
    pub narration:     Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct FeeListQuery {
    pub student_id:    Option<Uuid>,
    pub status:        Option<String>,
    pub academic_year: Option<i32>,
    pub page:          Option<u32>,
    pub limit:         Option<u32>,
}

// ── Response ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct FeeSummary {
    pub student_id:  Uuid,
    pub total_due:   f64,
    pub total_paid:  f64,
    pub outstanding: f64,
    pub allocations: Vec<FeeAllocation>,
}
