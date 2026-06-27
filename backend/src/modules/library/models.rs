use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, Utc};
use validator::Validate;

// ── DB Row types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Book {
    pub book_id:          Uuid,
    pub institution_id:   Uuid,
    pub isbn:             String,
    pub title:            String,
    pub author:           String,
    pub publisher:        Option<String>,
    pub category:         Option<String>,
    pub total_copies:     i32,
    pub available_copies: i32,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
    pub soft_deleted:     bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct BookTransaction {
    pub transaction_id:   Uuid,
    pub institution_id:   Uuid,
    pub book_id:          Uuid,
    pub student_id:       Uuid,
    pub issue_date:       NaiveDate,
    pub due_date:         NaiveDate,
    pub return_date:      Option<NaiveDate>,
    pub fine_amount:      String, // NUMERIC(12,2) cast to TEXT
    pub status:           String, // Issued | Returned | Overdue | Lost
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

// ── Request/Response types ───────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct CreateBookRequest {
    #[validate(length(min = 10, max = 30))]
    pub isbn:             String,
    #[validate(length(min = 1, max = 255))]
    pub title:            String,
    #[validate(length(min = 1, max = 255))]
    pub author:           String,
    pub publisher:        Option<String>,
    pub category:         Option<String>,
    pub total_copies:     i32,
}

#[derive(Debug, Deserialize)]
pub struct IssueBookRequest {
    pub isbn:             String,
    pub student_id:       Uuid,
    pub days_to_due:      Option<i32>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ReturnBookRequest {
    pub transaction_id:   Uuid,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct BookTransactionResponse {
    pub transaction_id:   Uuid,
    pub book_id:          Uuid,
    pub book_title:       String,
    pub book_author:      String,
    pub isbn:             String,
    pub student_id:       Uuid,
    pub student_name:     String,
    pub issue_date:       NaiveDate,
    pub due_date:         NaiveDate,
    pub return_date:      Option<NaiveDate>,
    pub fine_amount:      String,
    pub status:           String,
}
