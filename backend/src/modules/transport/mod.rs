pub mod handlers;
pub mod models;
pub mod service;

use axum::{routing::{get, post}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/transport/routes", post(handlers::create_route))
        .route("/transport/routes", get(handlers::list_routes))
        .route("/transport/stops", post(handlers::create_stop))
        .route("/transport/routes/:route_id/stops", get(handlers::list_stops))
        .route("/transport/vehicles", post(handlers::create_vehicle))
        .route("/transport/vehicles", get(handlers::list_vehicles))
        .route("/transport/allocations", post(handlers::allocate_transport))
        .route("/transport/allocations/:allocation_id/vacate", post(handlers::vacate_transport))
        .route("/transport/allocations", get(handlers::list_allocations))
        .route("/transport/allocations/student/:student_id", get(handlers::list_student_allocations))
}
