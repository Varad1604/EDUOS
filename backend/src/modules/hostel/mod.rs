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
        .route("/hostel/maintenance", post(handlers::create_maintenance_ticket))
        .route("/hostel/maintenance/:ticket_id", post(handlers::update_ticket_status))
        .route("/hostel/maintenance", get(handlers::list_maintenance_tickets))
        .route("/hostel/leaves", post(handlers::request_hostel_leave))
        .route("/hostel/leaves/:leave_id/approve", post(handlers::approve_hostel_leave))
        .route("/hostel/leaves/:leave_id/reject", post(handlers::reject_hostel_leave))
        .route("/hostel/leaves", get(handlers::list_leave_requests))
        .route("/hostel/mess-menu", post(handlers::create_mess_menu))
        .route("/hostel/mess-menu", get(handlers::get_mess_menus))
        .route("/hostel/mess-preference", post(handlers::set_mess_preference))
}
