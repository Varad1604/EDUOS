pub mod models;
pub mod service;
pub mod handlers;

use axum::{routing::{get, post, patch}, Router};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // Stats
        .route("/medical/stats", get(handlers::get_medical_stats))
        // Visits (OPD)
        .route("/medical/visits",
            get(handlers::list_visits).post(handlers::create_visit))
        .route("/medical/visits/:visit_id/close",
            patch(handlers::close_visit))
        // Vitals
        .route("/medical/visits/:visit_id/vitals",
            get(handlers::get_vitals).post(handlers::record_vitals))
        // Prescriptions
        .route("/medical/prescriptions", post(handlers::create_prescription))
        .route("/medical/visits/:visit_id/prescriptions",
            get(handlers::get_prescriptions))
        // Inventory
        .route("/medical/inventory",
            get(handlers::list_inventory).post(handlers::create_inventory_item))
        .route("/medical/inventory/:item_id/stock",
            patch(handlers::adjust_stock))
        // Sick Leaves
        .route("/medical/sick-leaves",
            get(handlers::list_sick_leaves).post(handlers::issue_sick_leave))
}
