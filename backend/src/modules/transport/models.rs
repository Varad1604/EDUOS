use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, NaiveDate, Utc};
use validator::Validate;

// ── DB Row types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct TransportRoute {
    pub route_id:        Uuid,
    pub institution_id:   Uuid,
    pub route_code:      String,
    pub route_name:      String,
    pub start_location:  String,
    pub end_location:    String,
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
    pub soft_deleted:     bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct TransportStop {
    pub stop_id:         Uuid,
    pub route_id:        Uuid,
    pub stop_name:       String,
    pub pickup_time:     chrono::NaiveTime,
    pub fare_amount:     String, // NUMERIC(12,2) cast to TEXT
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
    pub soft_deleted:     bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct TransportVehicle {
    pub vehicle_id:      Uuid,
    pub institution_id:   Uuid,
    pub vehicle_number:  String,
    pub capacity:        i32,
    pub available_seats: i32,
    pub driver_name:     Option<String>,
    pub driver_phone:    Option<String>,
    pub status:          String, // Active | Maintenance | OutOfService
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
    pub soft_deleted:     bool,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct TransportAllocation {
    pub allocation_id:    Uuid,
    pub institution_id:   Uuid,
    pub student_id:       Uuid,
    pub route_id:        Uuid,
    pub stop_id:         Uuid,
    pub vehicle_id:      Uuid,
    pub start_date:       NaiveDate,
    pub end_date:         Option<NaiveDate>,
    pub status:           String, // Active | Vacated | Cancelled
    pub created_at:       DateTime<Utc>,
    pub updated_at:       DateTime<Utc>,
}

// ── Request/Response types ───────────────────────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct CreateRouteRequest {
    #[validate(length(min = 1, max = 50))]
    pub route_code:      String,
    #[validate(length(min = 1, max = 150))]
    pub route_name:      String,
    #[validate(length(min = 1, max = 150))]
    pub start_location:  String,
    #[validate(length(min = 1, max = 150))]
    pub end_location:    String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateStopRequest {
    pub route_id:        Uuid,
    #[validate(length(min = 1, max = 150))]
    pub stop_name:       String,
    pub pickup_time:     String, // "HH:MM:SS" or "HH:MM" parseable
    pub fare_amount:     f64,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateVehicleRequest {
    #[validate(length(min = 1, max = 50))]
    pub vehicle_number:  String,
    pub capacity:        i32,
    pub driver_name:     Option<String>,
    pub driver_phone:    Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AllocateTransportRequest {
    pub student_id:       Uuid,
    pub route_id:        Uuid,
    pub stop_id:         Uuid,
    pub vehicle_id:      Uuid,
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct TransportAllocationResponse {
    pub allocation_id:    Uuid,
    pub route_id:        Uuid,
    pub route_code:      String,
    pub route_name:      String,
    pub stop_id:         Uuid,
    pub stop_name:       String,
    pub pickup_time:     chrono::NaiveTime,
    pub vehicle_id:      Uuid,
    pub vehicle_number:  String,
    pub driver_name:     Option<String>,
    pub driver_phone:    Option<String>,
    pub student_id:       Uuid,
    pub student_name:     String,
    pub start_date:       NaiveDate,
    pub end_date:         Option<NaiveDate>,
    pub status:           String,
    pub fare_amount:      String,
}
