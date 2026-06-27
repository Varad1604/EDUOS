pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::{get, post}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/hostel/rooms", post(handlers::create_room))
        .route("/hostel/rooms", get(handlers::list_rooms))
        .route("/hostel/allocations", post(handlers::allocate_room))
        .route("/hostel/allocations/:allocation_id/vacate", post(handlers::vacate_room))
        .route("/hostel/allocations", get(handlers::list_allocations))
        .route("/hostel/allocations/student/:student_id", get(handlers::list_student_allocations))
}
