use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, Utc};
use validator::Validate;

// ── DB Row types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct HostelRoom {
    pub room_id:          Uuid,
    pub institution_id:   Uuid,
    pub hostel_name:      String,
    pub room_number:      String,
    pub room_type:        String, // AC Double | Non-AC Triple | Single
    pub capacity:         i32,
    pub available_beds:   i32,
    pub rent_amount:      String, // NUMERIC(12,2) cast to TEXT
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
    pub soft_deleted:     bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct HostelAllocation {
    pub allocation_id:    Uuid,
    pub institution_id:   Uuid,
    pub room_id:          Uuid,
    pub student_id:       Uuid,
    pub start_date:       NaiveDate,
    pub end_date:         Option<NaiveDate>,
    pub mess_plan:        String, // Veg | Non-Veg | None
    pub status:           String, // Active | Vacated | Cancelled
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MaintenanceTicket {
    pub ticket_id:        Uuid,
    pub institution_id:   Uuid,
    pub room_id:          Uuid,
    pub reported_by:      Uuid,
    pub issue_type:       String,
    pub description:      String,
    pub status:           String,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct HostelLeave {
    pub leave_id:         Uuid,
    pub institution_id:   Uuid,
    pub student_id:       Uuid,
    pub departure_date:   NaiveDate,
    pub return_date:      NaiveDate,
    pub reason:           String,
    pub status:           String,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MessMenu {
    pub menu_id:          Uuid,
    pub institution_id:   Uuid,
    pub day_of_week:      String,
    pub meal_type:        String,
    pub items:            String,
    pub created_at:       DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct MessPreference {
    pub preference_id:      Uuid,
    pub institution_id:     Uuid,
    pub student_id:         Uuid,
    pub dietary_preference: String,
    pub created_at:         DateTime<Utc>,
}

// ── Request/Response types ───────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct CreateRoomRequest {
    #[validate(length(min = 1, max = 100))]
    pub hostel_name:      String,
    #[validate(length(min = 1, max = 50))]
    pub room_number:      String,
    #[validate(length(min = 1, max = 100))]
    pub room_type:        String,
    pub capacity:         i32,
    pub rent_amount:      f64,
}

#[derive(Debug, Deserialize)]
pub struct AllocateRoomRequest {
    pub room_id:          Uuid,
    pub student_id:       Uuid,
    pub mess_plan:        String, // Veg | Non-Veg | None
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct RoomAllocationResponse {
    pub allocation_id:    Uuid,
    pub room_id:          Uuid,
    pub hostel_name:      String,
    pub room_number:      String,
    pub room_type:        String,
    pub student_id:       Uuid,
    pub student_name:     String,
    pub start_date:       NaiveDate,
    pub end_date:         Option<NaiveDate>,
    pub mess_plan:        String,
    pub status:           String,
    pub rent_amount:      String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMaintenanceTicketRequest {
    pub room_id:          Uuid,
    pub issue_type:       String,
    pub description:      String,
}

#[derive(Debug, Deserialize)]
pub struct CreateHostelLeaveRequest {
    pub departure_date:   NaiveDate,
    pub return_date:      NaiveDate,
    pub reason:           String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMessMenuRequest {
    pub day_of_week:      String,
    pub meal_type:        String,
    pub items:            String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTicketStatusRequest {
    pub status:           String,
}

#[derive(Debug, Deserialize)]
pub struct MessPreferenceRequest {
    pub dietary_preference: String,
}
